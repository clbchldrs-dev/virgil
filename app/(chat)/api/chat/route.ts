import { geolocation } from "@vercel/functions";
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
import { auth } from "@/app/(auth)/auth";
import type { FallbackTier } from "@/lib/ai/chat-fallback";
import {
  getFallbackGatewayModel,
  getFallbackGeminiModel,
  getFallbackTiers,
  isChatFallbackEnabled,
  isFallbackEligibleError,
} from "@/lib/ai/chat-fallback";
import { createModelMetricsStreamHooks } from "@/lib/ai/chat-stream-metrics";
import { buildCompanionSystemPrompt } from "@/lib/ai/companion-prompt";
import { buildLocalChatTitleFromUserMessage } from "@/lib/ai/local-title";
import { isMem0Configured, mem0Add } from "@/lib/ai/mem0-client";
import {
  DEFAULT_CHAT_MODEL,
  getChatModelWithLocalFallback,
  getResolvedLocalModelClass,
  isLocalModel,
} from "@/lib/ai/models";
import { isAllowedChatModelId } from "@/lib/ai/ollama-discovery";
import {
  getPlannerModelId,
  isPlannerModelLocal,
  isVirgilMultiAgentEnabled,
  mergePlannerOutlineIntoSystemPrompt,
  runPlannerOutline,
} from "@/lib/ai/orchestration/multi-agent";
import type { RequestHints } from "@/lib/ai/prompts";
import {
  assertOllamaReachable,
  getGatewayErrorStreamMessage,
  getGeminiLanguageModel,
  getLanguageModel,
  getOllamaBaseUrl,
  getOllamaErrorStreamMessage,
  getOllamaErrorUserPayload,
} from "@/lib/ai/providers";
import {
  buildCompactCompanionPrompt,
  buildSlimCompanionPrompt,
} from "@/lib/ai/slim-prompt";
import { approveOpenClawIntent } from "@/lib/ai/tools/approve-openclaw-intent";
import {
  getCompanionToolNames,
  getCompanionTools,
} from "@/lib/ai/tools/companion";
import { createDocument } from "@/lib/ai/tools/create-document";
import { delegateTaskToOpenClaw } from "@/lib/ai/tools/delegate-to-openclaw";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { recallMemory } from "@/lib/ai/tools/recall-memory";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { saveMemory } from "@/lib/ai/tools/save-memory";
import { setReminder } from "@/lib/ai/tools/set-reminder";
import { submitAgentTask } from "@/lib/ai/tools/submit-agent-task";
import { submitProductOpportunity } from "@/lib/ai/tools/submit-product-opportunity";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { estimateTokens, trimMessagesForBudget } from "@/lib/ai/trim-context";
import { loadChatPromptContext } from "@/lib/chat/load-prompt-context";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { VirgilError } from "@/lib/errors";
import { isProductOpportunityConfigured } from "@/lib/github/product-opportunity-issue";
import { isOpenClawConfigured } from "@/lib/integrations/openclaw-config";
import {
  type BotIdVerification,
  handleBotIdForChatPost,
  isBotIdEnforceEnabled,
} from "@/lib/security/botid-chat";
import { logChatApiException } from "@/lib/security/log-safe-error";
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
  } catch (_error: unknown) {
    return new VirgilError("bad_request:api").toResponse();
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

    const [botCheckResult, session] = await Promise.all([
      checkBotId().catch((): null => null),
      auth(),
    ]);

    if (!session?.user) {
      return new VirgilError("unauthorized:chat").toResponse();
    }

    const bot = botCheckResult as BotIdVerification | null;
    if (
      handleBotIdForChatPost({
        bot,
        enforce: isBotIdEnforceEnabled(),
      }) === "block"
    ) {
      return new VirgilError("forbidden:api").toResponse();
    }

    const chatModel = (await isAllowedChatModelId(selectedChatModel))
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;
    isOllamaRequest = isLocalModel(chatModel);

    const isToolApprovalFlow = Boolean(messages);
    const isOllamaLocal = isOllamaRequest;

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new VirgilError("forbidden:chat").toResponse();
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
    const { capabilities, recentMemories } = await loadChatPromptContext({
      userId: session.user.id,
      chatModel,
    });
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;
    const promptSupportsTools = supportsTools && !isOllamaLocal;

    const ownerName =
      session.user.name ?? session.user.email?.split("@")[0] ?? null;
    const promptVariant = modelConfig?.promptVariant ?? "slim";
    const localModelClass = getResolvedLocalModelClass(chatModel, modelConfig);

    const productOpportunityEnabled =
      !isOllamaLocal && isProductOpportunityConfigured();

    const agentTaskEnabled = !isOllamaLocal;

    const systemPromptText =
      isOllamaLocal && promptVariant === "compact"
        ? buildCompactCompanionPrompt({
            ownerName,
            memories: recentMemories,
            localModelClass,
          })
        : isOllamaLocal && promptVariant === "slim"
          ? buildSlimCompanionPrompt({
              ownerName,
              memories: recentMemories,
              localModelClass,
            })
          : buildCompanionSystemPrompt({
              ownerName,
              memories: recentMemories,
              requestHints,
              supportsTools: promptSupportsTools,
              productOpportunityEnabled,
              agentTaskEnabled,
              ...(isOllamaLocal ? { localModelClass } : {}),
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

    const fallbackEnabled = isOllamaLocal && isChatFallbackEnabled();
    if (isOllamaLocal && !fallbackEnabled) {
      await assertOllamaReachable();
    }

    let activeTier: FallbackTier = isOllamaLocal ? "ollama" : "gateway";

    const noActiveToolsForOrchestration = isReasoningModel && !supportsTools;
    const gatewayMultiAgentEligible =
      !isOllamaLocal &&
      isVirgilMultiAgentEnabled() &&
      supportsTools &&
      !noActiveToolsForOrchestration;

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

        let executorSystemPrompt = systemPromptText;
        if (gatewayMultiAgentEligible) {
          const plannerId = getPlannerModelId(chatModel);
          if (isPlannerModelLocal(plannerId)) {
            await assertOllamaReachable();
          }
          const plannerOllamaOptions = isPlannerModelLocal(plannerId)
            ? {
                ...modelConfig?.ollamaOptions,
                ...(showThinking ? { think: true as const } : {}),
              }
            : undefined;
          const plannerProviderOptions = {
            ...(modelConfig?.gatewayOrder && {
              gateway: { order: modelConfig.gatewayOrder },
            }),
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          };
          try {
            const outline = await runPlannerOutline({
              plannerModelId: plannerId,
              userMessages: modelMessages,
              ollamaLanguageOptions: plannerOllamaOptions,
              providerOptions:
                Object.keys(plannerProviderOptions).length > 0
                  ? plannerProviderOptions
                  : undefined,
            });
            executorSystemPrompt = mergePlannerOutlineIntoSystemPrompt(
              systemPromptText,
              outline
            );
          } catch {
            executorSystemPrompt = systemPromptText;
          }
        }

        const commonStreamArgsBase = {
          model: getLanguageModel(chatModel, ollamaLanguageOptions),
          system: executorSystemPrompt,
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
          ...getCompanionTools(),
        };

        const companionToolNames = [
          "saveMemory",
          "recallMemory",
          "setReminder",
          ...getCompanionToolNames(),
        ] as const;

        const noActiveTools = isReasoningModel && !supportsTools;

        const productOpportunityTool = submitProductOpportunity({
          userId: session.user.id,
          chatId: id,
          allowed: productOpportunityEnabled,
        });

        const agentTaskTool = submitAgentTask({
          userId: session.user.id,
          chatId: id,
          allowed: agentTaskEnabled,
        });

        const openClawPersonalEnabled = isOpenClawConfigured();

        const openClawToolsBlock = openClawPersonalEnabled
          ? {
              delegateTask: delegateTaskToOpenClaw({
                userId: session.user.id,
                chatId: id,
              }),
              approveOpenClawIntent: approveOpenClawIntent({
                userId: session.user.id,
              }),
            }
          : undefined;

        const openClawToolNames = openClawPersonalEnabled
          ? (["delegateTask", "approveOpenClawIntent"] as const)
          : [];

        const gatewayExtraTools = {
          ...(productOpportunityEnabled
            ? { submitProductOpportunity: productOpportunityTool }
            : {}),
          ...(agentTaskEnabled ? { submitAgentTask: agentTaskTool } : {}),
        };

        const gatewayExtraToolNames = [
          ...(productOpportunityEnabled
            ? (["submitProductOpportunity"] as const)
            : []),
          ...(agentTaskEnabled ? (["submitAgentTask"] as const) : []),
        ];

        if (fallbackEnabled) {
          try {
            await assertOllamaReachable();
          } catch (ollamaErr) {
            if (isFallbackEligibleError(ollamaErr)) {
              const tiers = getFallbackTiers();
              if (tiers.length === 0) {
                throw ollamaErr;
              }
              activeTier = tiers[0];
            } else {
              throw ollamaErr;
            }
          }
        }

        const escalatedFromLocal = activeTier !== "ollama" && isOllamaLocal;

        if (escalatedFromLocal) {
          const tierLabel = activeTier === "gemini" ? "Gemini" : "AI Gateway";
          dataStream.write({
            type: "data-fallback-notice",
            data: `Local model unavailable; using ${tierLabel}.`,
          });

          const fallbackModelId =
            activeTier === "gemini"
              ? getFallbackGeminiModel()
              : getFallbackGatewayModel();

          const fallbackModel =
            activeTier === "gemini"
              ? getGeminiLanguageModel(fallbackModelId)
              : getLanguageModel(fallbackModelId);

          const escalationPrompt = buildCompanionSystemPrompt({
            ownerName,
            memories: recentMemories,
            requestHints,
            supportsTools: true,
            productOpportunityEnabled: isProductOpportunityConfigured(),
            agentTaskEnabled: true,
          });

          const fallbackResult = streamText({
            model: fallbackModel,
            system: escalationPrompt,
            messages: convertedModelMessages,
            stopWhen: stepCountIs(5),
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: "stream-text",
            },
            ...metricsHooks,
            tools: {
              ...baseTools,
              ...companionTools,
              ...gatewayExtraTools,
              ...(openClawToolsBlock ?? {}),
            },
            experimental_activeTools: noActiveTools
              ? []
              : [
                  ...baseToolNames,
                  ...companionToolNames,
                  ...gatewayExtraToolNames,
                  ...openClawToolNames,
                ],
          });

          dataStream.merge(
            fallbackResult.toUIMessageStream({ sendReasoning: false })
          );
        } else if (isOllamaLocal) {
          const result = streamText({
            ...localCommonStreamArgs,
            ...(openClawToolsBlock
              ? {
                  tools: openClawToolsBlock,
                  experimental_activeTools: noActiveTools
                    ? []
                    : [...openClawToolNames],
                }
              : {}),
          });

          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning:
                showThinking && (isReasoningModel || isOllamaLocal),
            })
          );
        } else {
          const result = streamText({
            ...gatewayCommonStreamArgs,
            tools: {
              ...baseTools,
              ...companionTools,
              ...gatewayExtraTools,
              ...(openClawToolsBlock ?? {}),
            },
            experimental_activeTools: noActiveTools
              ? []
              : [
                  ...baseToolNames,
                  ...companionToolNames,
                  ...gatewayExtraToolNames,
                  ...openClawToolNames,
                ],
          });

          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning: showThinking && isReasoningModel,
            })
          );
        }

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

        const skipMem0ForLocalOllama =
          isOllamaLocal && process.env.MEM0_DISABLE_LOCAL_SYNC === "1";

        if (
          isMem0Configured() &&
          finishedMessages.length > 0 &&
          !skipMem0ForLocalOllama
        ) {
          try {
            const mem0Messages = finishedMessages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .flatMap((m) => {
                const textParts = m.parts
                  ?.filter(
                    (p: Record<string, unknown>) => p.type === "text" && p.text
                  )
                  .map((p: Record<string, unknown>) => String(p.text));
                if (!textParts || textParts.length === 0) {
                  return [];
                }
                return [
                  {
                    role: m.role as "user" | "assistant",
                    content: textParts.join("\n"),
                  },
                ];
              });

            if (mem0Messages.length > 0) {
              mem0Add(mem0Messages, session.user.id, { chatId: id }).catch(
                () => undefined
              );
            }
          } catch {
            /* non-critical */
          }
        }
      },
      onError: (error) => {
        logChatApiException("Chat UI message stream error", error, {});
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests"
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }
        const gatewayStreamMsg = getGatewayErrorStreamMessage(error);
        if (gatewayStreamMsg) {
          return gatewayStreamMsg;
        }
        if (activeTier === "ollama") {
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

    if (error instanceof VirgilError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new VirgilError("bad_request:activate_gateway").toResponse();
    }

    const gatewayHttpMsg = getGatewayErrorStreamMessage(error);
    if (gatewayHttpMsg) {
      return new VirgilError("bad_request:api", undefined, {
        overrideMessage: gatewayHttpMsg,
      }).toResponse();
    }

    if (isOllamaRequest) {
      const ollamaPayload = getOllamaErrorUserPayload(
        error,
        getOllamaBaseUrl()
      );
      if (ollamaPayload) {
        return new VirgilError("offline:ollama", ollamaPayload).toResponse();
      }
    }

    logChatApiException("Unhandled error in chat API", error, {
      vercelId: vercelId ?? undefined,
    });
    return new VirgilError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new VirgilError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new VirgilError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new VirgilError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
