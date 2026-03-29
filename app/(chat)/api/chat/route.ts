import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { createModelMetricsStreamHooks } from "@/lib/ai/chat-stream-metrics";
import { buildCompanionSystemPrompt } from "@/lib/ai/companion-prompt";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { buildFrontDeskSystemPrompt } from "@/lib/ai/front-desk-prompt";
import { buildLocalChatTitleFromUserMessage } from "@/lib/ai/local-title";
import {
  DEFAULT_CHAT_MODEL,
  getChatModelWithLocalFallback,
  getResolvedLocalModelClass,
  isLocalModel,
} from "@/lib/ai/models";
import { isAllowedChatModelId } from "@/lib/ai/ollama-discovery";
import type { RequestHints } from "@/lib/ai/prompts";
import {
  assertOllamaReachable,
  getLanguageModel,
  getOllamaBaseUrl,
  getOllamaErrorStreamMessage,
  getOllamaErrorUserPayload,
} from "@/lib/ai/providers";
import {
  buildCompactCompanionPrompt,
  buildCompactFrontDeskPrompt,
  buildSlimCompanionPrompt,
  buildSlimFrontDeskPrompt,
} from "@/lib/ai/slim-prompt";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { escalateToHuman } from "@/lib/ai/tools/escalate-to-human";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { recallMemory } from "@/lib/ai/tools/recall-memory";
import { recordIntake } from "@/lib/ai/tools/record-intake";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { saveMemory } from "@/lib/ai/tools/save-memory";
import { setReminder } from "@/lib/ai/tools/set-reminder";
import { submitProductOpportunity } from "@/lib/ai/tools/submit-product-opportunity";
import { summarizeOpportunity } from "@/lib/ai/tools/summarize-opportunity";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { estimateTokens, trimMessagesForBudget } from "@/lib/ai/trim-context";
import { loadChatPromptContext } from "@/lib/chat/load-prompt-context";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { isProductOpportunityConfigured } from "@/lib/github/product-opportunity-issue";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;
  let isOllamaRequest = false;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
      showThinking: showThinkingRaw,
    } = requestBody;
    const showThinking = showThinkingRaw === true;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = (await isAllowedChatModelId(selectedChatModel))
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;
    isOllamaRequest = isLocalModel(chatModel);

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const skipHourlyMessageCap =
      isLocalModel(chatModel) ||
      process.env.SKIP_CHAT_MESSAGE_RATE_LIMIT === "true";

    if (!skipHourlyMessageCap) {
      const messageCount = await getMessageCountByUserId({
        id: session.user.id,
        differenceInHours: 1,
      });

      if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
        return new ChatbotError("rate_limit:chat").toResponse();
      }
    }

    const isToolApprovalFlow = Boolean(messages);
    const isOllamaLocal = isOllamaRequest;

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = Promise.resolve(
        isOllamaLocal
          ? buildLocalChatTitleFromUserMessage(getTextFromMessage(message))
          : generateTitleFromUserMessage({ message })
      );
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelConfig = getChatModelWithLocalFallback(chatModel);
    const { capabilities, businessProfile, priorityNotes, recentMemories } =
      await loadChatPromptContext({
        userId: session.user.id,
        chatModel,
      });
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;
    const promptSupportsTools = supportsTools && !isOllamaLocal;

    const isBusinessMode =
      businessProfile !== null &&
      businessProfile.userId === session.user.id &&
      businessProfile.businessModeEnabled !== false;

    const ownerName =
      session.user.name ?? session.user.email?.split("@")[0] ?? null;
    const latestPriorityNote = priorityNotes[0]?.content ?? null;
    const promptVariant = modelConfig?.promptVariant ?? "slim";
    const localModelClass = getResolvedLocalModelClass(chatModel, modelConfig);

    const productOpportunityEnabled =
      !isOllamaLocal && isProductOpportunityConfigured();

    const systemPromptText =
      isOllamaLocal && promptVariant === "compact"
        ? isBusinessMode
          ? buildCompactFrontDeskPrompt({
              profile: businessProfile,
              priorityNote: latestPriorityNote,
              localModelClass,
            })
          : buildCompactCompanionPrompt({
              ownerName,
              memories: recentMemories,
              localModelClass,
            })
        : isOllamaLocal && promptVariant === "slim"
          ? isBusinessMode
            ? buildSlimFrontDeskPrompt({
                profile: businessProfile,
                priorityNote: latestPriorityNote,
                localModelClass,
              })
            : buildSlimCompanionPrompt({
                ownerName,
                memories: recentMemories,
                localModelClass,
              })
          : isBusinessMode
            ? buildFrontDeskSystemPrompt({
                profile: businessProfile,
                priorityNotes,
                requestHints,
                supportsTools: promptSupportsTools,
                productOpportunityEnabled,
              })
            : buildCompanionSystemPrompt({
                ownerName,
                memories: recentMemories,
                requestHints,
                supportsTools: promptSupportsTools,
                productOpportunityEnabled,
              });

    const convertedModelMessages = await convertToModelMessages(uiMessages);
    const systemTokenEstimate = estimateTokens(systemPromptText);
    const modelMessages = isOllamaLocal
      ? trimMessagesForBudget({
          messages: convertedModelMessages,
          systemTokenCount: systemTokenEstimate,
          maxContextTokens: modelConfig?.maxContextTokens ?? 2048,
        })
      : convertedModelMessages;

    if (isOllamaLocal) {
      await assertOllamaReachable();
    }

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const ollamaLanguageOptions = isOllamaLocal
          ? {
              ...modelConfig?.ollamaOptions,
              ...(showThinking ? { think: true as const } : {}),
            }
          : undefined;

        const metricsHooks = createModelMetricsStreamHooks({
          chatModel,
          dataStream,
        });

        const commonStreamArgsBase = {
          model: getLanguageModel(chatModel, ollamaLanguageOptions),
          system: systemPromptText,
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          ...metricsHooks,
        };

        const localCommonStreamArgs = {
          ...commonStreamArgsBase,
        };

        const gatewayCommonStreamArgs = {
          ...commonStreamArgsBase,
          providerOptions: {
            ...(modelConfig?.gatewayOrder && {
              gateway: { order: modelConfig.gatewayOrder },
            }),
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          },
        };

        const baseTools = {
          getWeather,
          createDocument: createDocument({
            session,
            dataStream,
            modelId: chatModel,
          }),
          editDocument: editDocument({ dataStream, session }),
          updateDocument: updateDocument({
            session,
            dataStream,
            modelId: chatModel,
          }),
          requestSuggestions: requestSuggestions({
            session,
            dataStream,
            modelId: chatModel,
          }),
        };

        const baseToolNames = [
          "getWeather",
          "createDocument",
          "editDocument",
          "updateDocument",
          "requestSuggestions",
        ] as const;

        const companionTools = {
          saveMemory: saveMemory({ userId: session.user.id, chatId: id }),
          recallMemory: recallMemory({ userId: session.user.id }),
          setReminder: setReminder({ userId: session.user.id, chatId: id }),
        };

        const companionToolNames = [
          "saveMemory",
          "recallMemory",
          "setReminder",
        ] as const;

        const noActiveTools = isReasoningModel && !supportsTools;

        const productOpportunityTool = submitProductOpportunity({
          userId: session.user.id,
          chatId: id,
          allowed: productOpportunityEnabled,
        });

        const result = isOllamaLocal
          ? streamText(localCommonStreamArgs)
          : isBusinessMode
            ? streamText({
                ...gatewayCommonStreamArgs,
                tools: {
                  ...baseTools,
                  recordIntake: recordIntake({
                    businessProfileId: businessProfile.id,
                    chatId: id,
                  }),
                  escalateToHuman: escalateToHuman({
                    businessProfileId: businessProfile.id,
                    chatId: id,
                    businessName: businessProfile.businessName,
                    ownerUserId: session.user.id,
                    businessOwnerUserId: businessProfile.userId,
                  }),
                  summarizeOpportunity,
                  ...(productOpportunityEnabled
                    ? { submitProductOpportunity: productOpportunityTool }
                    : {}),
                },
                experimental_activeTools: noActiveTools
                  ? []
                  : [
                      ...baseToolNames,
                      "recordIntake",
                      "escalateToHuman",
                      "summarizeOpportunity",
                      ...(productOpportunityEnabled
                        ? (["submitProductOpportunity"] as const)
                        : []),
                    ],
              })
            : streamText({
                ...gatewayCommonStreamArgs,
                tools: {
                  ...baseTools,
                  ...companionTools,
                  ...(productOpportunityEnabled
                    ? { submitProductOpportunity: productOpportunityTool }
                    : {}),
                },
                experimental_activeTools: noActiveTools
                  ? []
                  : [
                      ...baseToolNames,
                      ...companionToolNames,
                      ...(productOpportunityEnabled
                        ? (["submitProductOpportunity"] as const)
                        : []),
                    ],
              });

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: showThinking && (isReasoningModel || isOllamaLocal),
          })
        );

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: id, title });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: (error) => {
        console.error("Chat UI message stream error:", error);
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests"
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }
        if (isOllamaLocal) {
          const streamMsg = getOllamaErrorStreamMessage(
            error,
            getOllamaBaseUrl()
          );
          if (streamMsg) {
            return streamMsg;
          }
        }
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }

    if (isOllamaRequest) {
      const ollamaPayload = getOllamaErrorUserPayload(
        error,
        getOllamaBaseUrl()
      );
      if (ollamaPayload) {
        return new ChatbotError("offline:ollama", ollamaPayload).toResponse();
      }
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
