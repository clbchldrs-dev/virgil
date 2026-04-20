import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  MissingToolResultsError,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@/app/(auth)/auth";
import type { FallbackTier } from "@/lib/ai/chat-fallback";
import {
  getDefaultGatewayFallbackOllamaModelId,
  getFallbackGatewayModel,
  getFallbackGeminiModel,
  getFallbackTiers,
  getGatewayFallbackGeminiModel,
  isChatFallbackEnabled,
  isFallbackEligibleError,
  isGatewayFallbackEligibleError,
  isGatewayFallbackToOllamaEnabled,
  isGeminiDirectConfigured,
} from "@/lib/ai/chat-fallback";
import { createModelMetricsStreamHooks } from "@/lib/ai/chat-stream-metrics";
import { buildCompanionSystemPrompt } from "@/lib/ai/companion-prompt";
import { formatDayTasksForPrompt } from "@/lib/ai/day-task-context";
import { buildLocalChatTitleFromUserMessage } from "@/lib/ai/local-title";
import { isMem0Configured, mem0Add } from "@/lib/ai/mem0-client";
import { resolveAutoChatModel } from "@/lib/ai/model-routing";
import {
  DEFAULT_CHAT_MODEL,
  getChatModelWithLocalFallback,
  getResolvedLocalModelClass,
  isLocalModel,
  resolveRuntimeModelId,
  VIRGIL_AUTO_MODEL_ID,
} from "@/lib/ai/models";
import { isAllowedChatModelId } from "@/lib/ai/ollama-discovery";
import {
  isPlannerModelLocal,
  isVirgilMultiAgentEnabled,
  mergePlannerOutlineIntoSystemPrompt,
  resolvePlannerStages,
  runPlannerChain,
} from "@/lib/ai/orchestration/multi-agent";
import { formatActiveGoalsForPrompt } from "@/lib/ai/pivot-goal-context";
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
import { resolveChatRuntimeDecision } from "@/lib/ai/runtime-decision/resolve-chat-runtime-decision";
import {
  appendShadowSeamDivergenceRecord,
  chatRuntimeDecisionShadowDiffers,
  isRuntimeDecisionSeamAuthoritativeEnabled,
  isRuntimeDecisionSeamShadowEnabled,
} from "@/lib/ai/runtime-decision/shadow";
import {
  buildCompactCompanionPrompt,
  buildSlimCompanionPrompt,
} from "@/lib/ai/slim-prompt";
import { approveOpenClawIntent } from "@/lib/ai/tools/approve-openclaw-intent";
import { checkInGoal } from "@/lib/ai/tools/check-in-goal";
import {
  getCompanionToolNames,
  getCompanionTools,
} from "@/lib/ai/tools/companion";
import { createDocument } from "@/lib/ai/tools/create-document";
import { createGoal } from "@/lib/ai/tools/create-goal";
import { delegateTaskToOpenClaw } from "@/lib/ai/tools/delegate-to-openclaw";
import { embedViaDelegation } from "@/lib/ai/tools/delegation-embed";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { fetchUrl } from "@/lib/ai/tools/fetch-url";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { isJiraConfigured } from "@/lib/ai/tools/jira";
import { listGoals } from "@/lib/ai/tools/list-goals";
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
import {
  agentIngestLog,
  summarizeModelMessageRoles,
  summarizeUiMessagesToolState,
} from "@/lib/debug/agent-ingest-log";
import {
  buildDelegationCapabilityAppendix,
  getDelegationDeploymentSnapshot,
} from "@/lib/deployment/delegation-snapshot";
import { VirgilError } from "@/lib/errors";
import { isProductOpportunityConfigured } from "@/lib/github/product-opportunity-issue";
import { isDelegationEmbedToolEnabled } from "@/lib/integrations/delegation-embeddings";
import {
  getDelegationProvider,
  isDelegationConfigured,
} from "@/lib/integrations/delegation-provider";
import {
  logChatPathTelemetryEvent,
  normalizeChatTelemetryErrorCode,
} from "@/lib/reliability/chat-path-telemetry";
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
import { logGatewayCost } from "@/lib/v2-eval/cost-log";
import { extractToolNamesFromUIMessages } from "@/lib/v2-eval/extract-tools-from-ui-messages";
import type {
  FallbackTierLogged,
  PromptVariantLogged,
} from "@/lib/v2-eval/interaction-log";
import { logInteraction } from "@/lib/v2-eval/interaction-log";
import { logDecisionTrace } from "@/lib/v2-eval/trace-log";
import { getLastUserAndAssistantTextLengths } from "@/lib/v2-eval/turn-text-lengths";
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
      clientRoutingHints,
    } = requestBody;
    const showThinking = showThinkingRaw === true;
    const requestStartedAtMs = Date.now();
    let authAndBotCheckedAtMs: number | null = null;
    let promptContextLoadedAtMs: number | null = null;
    let firstModelCallAtMs: number | null = null;
    const markFirstModelCall = () => {
      if (firstModelCallAtMs === null) {
        firstModelCallAtMs = Date.now();
      }
    };

    const [botCheckResult, session] = await Promise.all([
      checkBotId().catch((): null => null),
      auth(),
    ]);
    authAndBotCheckedAtMs = Date.now();

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

    const selectedModelAllowed = await isAllowedChatModelId(selectedChatModel);

    let chatModel: string;
    if (isRuntimeDecisionSeamAuthoritativeEnabled()) {
      const seam = await resolveChatRuntimeDecision({
        selectedChatModel,
        isAllowedChatModelId,
        resolveAutoModel: (hints) => resolveAutoChatModel(hints),
        clientRoutingHints,
      });
      chatModel = seam.effectiveChatModelId;
      isOllamaRequest = seam.isOllamaLocal;
    } else {
      chatModel = selectedModelAllowed ? selectedChatModel : DEFAULT_CHAT_MODEL;
      if (chatModel === VIRGIL_AUTO_MODEL_ID) {
        const { modelId } = await resolveAutoChatModel(clientRoutingHints);
        const resolvedAllowed = await isAllowedChatModelId(modelId);
        chatModel = resolvedAllowed ? modelId : DEFAULT_CHAT_MODEL;
      }
      isOllamaRequest = isLocalModel(chatModel);
    }

    const isToolApprovalFlow = Boolean(messages);
    const isOllamaLocal = isOllamaRequest;

    if (isRuntimeDecisionSeamShadowEnabled()) {
      const legacyPromptVariant = (getChatModelWithLocalFallback(chatModel)
        ?.promptVariant ?? "slim") as "full" | "slim" | "compact";
      const legacyChatFallbackEnabled =
        isOllamaLocal && isChatFallbackEnabled();
      const legacyPostOllamaFailureTiers = legacyChatFallbackEnabled
        ? getFallbackTiers()
        : [];
      const legacyGatewayMayFallbackToOllamaAfterFailure =
        !isOllamaLocal && isGatewayFallbackToOllamaEnabled();

      (async () => {
        try {
          const seam = await resolveChatRuntimeDecision({
            selectedChatModel,
            isAllowedChatModelId,
            resolveAutoModel: (hints) => resolveAutoChatModel(hints),
            clientRoutingHints,
          });
          const legacy = {
            effectiveChatModelId: chatModel,
            isOllamaLocal,
            promptVariant: legacyPromptVariant,
            chatFallbackEnabled: legacyChatFallbackEnabled,
            postOllamaFailureTiers: legacyPostOllamaFailureTiers,
            gatewayMayFallbackToOllamaAfterFailure:
              legacyGatewayMayFallbackToOllamaAfterFailure,
          };
          if (chatRuntimeDecisionShadowDiffers({ seam, legacy })) {
            await appendShadowSeamDivergenceRecord({
              ts: new Date().toISOString(),
              chatId: id,
              selectedChatModelId: selectedChatModel,
              legacy,
              seam,
            });
            agentIngestLog({
              location: "app/(chat)/api/chat/route.ts",
              message: "Runtime decision seam shadow mismatch",
              hypothesisId: "runtime-decision-seam-iu4",
              data: {
                chatId: id,
                selectedChatModel,
                legacyEffective: legacy.effectiveChatModelId,
                seamEffective: seam.effectiveChatModelId,
                reasonCodes: seam.reasonCodes,
              },
            });
          }
        } catch {
          /* shadow compare must never affect chat */
        }
      })().catch(() => {
        /* shadow compare must never affect chat */
      });
    }

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
    const {
      capabilities,
      recentMemories,
      activeGoals,
      dayTasksToday,
      dayTaskCalendarKey,
      recentHealthSnapshots,
    } = await loadChatPromptContext({
      userId: session.user.id,
      chatModel,
    });
    promptContextLoadedAtMs = Date.now();
    const goalContextAppendix = [
      formatDayTasksForPrompt(dayTasksToday, dayTaskCalendarKey),
      formatActiveGoalsForPrompt(activeGoals),
    ]
      .filter((block) => block.length > 0)
      .join("\n\n");
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
    const jiraEnabled = isJiraConfigured();
    const delegationHint = {
      enabled: isDelegationConfigured(),
      backend: getDelegationProvider().backend,
      embedToolEnabled:
        isDelegationConfigured() && isDelegationEmbedToolEnabled(),
    };

    let delegationCapabilityAppendix = "";
    if (delegationHint.enabled) {
      const delegationSnap = await getDelegationDeploymentSnapshot();
      delegationCapabilityAppendix =
        buildDelegationCapabilityAppendix(delegationSnap);
    }

    const systemPromptText =
      isOllamaLocal && promptVariant === "compact"
        ? buildCompactCompanionPrompt({
            ownerName,
            memories: recentMemories,
            localModelClass,
            goalContextAppendix,
          })
        : isOllamaLocal && promptVariant === "slim"
          ? buildSlimCompanionPrompt({
              ownerName,
              memories: recentMemories,
              localModelClass,
              goalContextAppendix,
            })
          : buildCompanionSystemPrompt({
              ownerName,
              memories: recentMemories,
              recentHealthSnapshots: isOllamaLocal ? [] : recentHealthSnapshots,
              requestHints,
              supportsTools: promptSupportsTools,
              productOpportunityEnabled,
              agentTaskEnabled,
              jiraEnabled,
              delegationHint,
              delegationCapabilityAppendix,
              goalContextAppendix,
              ...(isOllamaLocal ? { localModelClass } : {}),
            });

    // #region agent log
    {
      const uiTool = summarizeUiMessagesToolState(uiMessages);
      agentIngestLog({
        location: "app/(chat)/api/chat/route.ts:pre-convert",
        message: "uiMessages tool snapshot before convertToModelMessages",
        hypothesisId: "H1",
        data: {
          chatId: id,
          isToolApprovalFlow,
          isOllamaLocal,
          ...uiTool,
        },
      });
    }
    // #endregion

    let convertedModelMessages: Awaited<
      ReturnType<typeof convertToModelMessages>
    >;
    try {
      convertedModelMessages = await convertToModelMessages(uiMessages);
    } catch (convertErr: unknown) {
      // #region agent log
      if (MissingToolResultsError.isInstance(convertErr)) {
        agentIngestLog({
          location: "app/(chat)/api/chat/route.ts:convertToModelMessages",
          message: "MissingToolResultsError during convertToModelMessages",
          hypothesisId: "H1",
          data: {
            chatId: id,
            toolCallIds: convertErr.toolCallIds,
            uiTool: summarizeUiMessagesToolState(uiMessages),
          },
        });
      }
      // #endregion
      throw convertErr;
    }

    const systemTokenEstimate = estimateTokens(systemPromptText);
    const modelMessages = isOllamaLocal
      ? trimMessagesForBudget({
          messages: convertedModelMessages,
          systemTokenCount: systemTokenEstimate,
          maxContextTokens: modelConfig?.maxContextTokens ?? 2048,
        })
      : convertedModelMessages;

    // #region agent log
    {
      const mm = summarizeModelMessageRoles(
        modelMessages as { role: string; content: unknown }[]
      );
      agentIngestLog({
        location: "app/(chat)/api/chat/route.ts:post-trim",
        message: "modelMessages roles after trim (local) or passthrough",
        hypothesisId: "H2",
        data: {
          chatId: id,
          isOllamaLocal,
          ...mm,
        },
      });
    }
    // #endregion

    const fallbackEnabled = isOllamaLocal && isChatFallbackEnabled();
    if (isOllamaLocal && !fallbackEnabled) {
      await assertOllamaReachable();
    }

    let activeTier: FallbackTier = isOllamaLocal ? "ollama" : "gateway";

    const v2EvalStreamMetrics: {
      effectiveModelId: string;
      fallbackTier: FallbackTierLogged;
      effectivePromptVariant: PromptVariantLogged;
    } = {
      effectiveModelId: chatModel,
      fallbackTier: isOllamaLocal ? "ollama" : "gateway",
      effectivePromptVariant: isOllamaLocal
        ? promptVariant === "compact"
          ? "compact"
          : "slim"
        : "full",
    };

    const noActiveToolsForOrchestration = isReasoningModel && !supportsTools;
    const gatewayMultiAgentEligible =
      !isOllamaLocal &&
      isVirgilMultiAgentEnabled() &&
      supportsTools &&
      !noActiveToolsForOrchestration;

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        if (!selectedModelAllowed) {
          dataStream.write({
            type: "data-fallback-notice",
            data: `"${selectedChatModel}" is not available on this server — using ${chatModel} instead. For local models, the Next.js server must reach Ollama at OLLAMA_BASE_URL (discovered tags require a running Ollama that lists them).`,
          });
        }

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
          const plannerStages = resolvePlannerStages(chatModel);
          if (
            plannerStages.some((stage) => isPlannerModelLocal(stage.modelId))
          ) {
            await assertOllamaReachable();
          }
          const plannerProviderOptions = {
            ...(modelConfig?.gatewayOrder && {
              gateway: { order: modelConfig.gatewayOrder },
            }),
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          };
          try {
            markFirstModelCall();
            const outline = await runPlannerChain({
              stages: plannerStages,
              userMessages: modelMessages,
              resolveOllamaLanguageOptionsForPlanner: (plannerModelId) =>
                isPlannerModelLocal(plannerModelId)
                  ? {
                      ...modelConfig?.ollamaOptions,
                      ...(showThinking ? { think: true as const } : {}),
                    }
                  : undefined,
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

        // Keep persona in `system` (not embedded in `messages`) so providers send the
        // frame before the conversation. `buildCompanionSystemPrompt` prefixes
        // `buildVirgilPersonaFrame` and uses VIRGIL_SYSTEM_PERSONA_DIVIDER so session/tool
        // text never precedes voice rules inside that string.
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
          fetchUrl: fetchUrl(),
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
          "fetchUrl",
          "createDocument",
          "editDocument",
          "updateDocument",
          "requestSuggestions",
        ] as const;

        const saveMemoryForUser = saveMemory({
          userId: session.user.id,
          chatId: id,
        });
        const recallMemoryForUser = recallMemory({
          userId: session.user.id,
        });

        const companionTools = {
          saveMemory: saveMemoryForUser,
          save_memory: saveMemoryForUser,
          recallMemory: recallMemoryForUser,
          recall_memory: recallMemoryForUser,
          setReminder: setReminder({ userId: session.user.id, chatId: id }),
          listGoals: listGoals({ userId: session.user.id }),
          createGoal: createGoal({ userId: session.user.id }),
          checkInGoal: checkInGoal({ userId: session.user.id }),
          ...getCompanionTools(),
        };

        const companionToolNames = [
          "saveMemory",
          "save_memory",
          "recallMemory",
          "recall_memory",
          "setReminder",
          "listGoals",
          "createGoal",
          "checkInGoal",
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

        const openClawPersonalEnabled = isDelegationConfigured();
        const embedViaDelegationEnabled =
          openClawPersonalEnabled && isDelegationEmbedToolEnabled();

        const openClawToolsBlock = openClawPersonalEnabled
          ? {
              delegateTask: delegateTaskToOpenClaw({
                userId: session.user.id,
                chatId: id,
              }),
              approveDelegationIntent: approveOpenClawIntent({
                userId: session.user.id,
              }),
              approveOpenClawIntent: approveOpenClawIntent({
                userId: session.user.id,
              }),
              ...(embedViaDelegationEnabled
                ? { embedViaDelegation: embedViaDelegation() }
                : {}),
            }
          : undefined;

        const openClawToolNames = openClawPersonalEnabled
          ? ([
              "delegateTask",
              "approveDelegationIntent",
              "approveOpenClawIntent",
              ...(embedViaDelegationEnabled
                ? (["embedViaDelegation"] as const)
                : []),
            ] as const)
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

          v2EvalStreamMetrics.effectiveModelId = fallbackModelId;
          v2EvalStreamMetrics.fallbackTier =
            activeTier === "gemini" ? "gemini" : "gateway";
          v2EvalStreamMetrics.effectivePromptVariant = "full";

          const fallbackModel =
            activeTier === "gemini"
              ? getGeminiLanguageModel(fallbackModelId)
              : getLanguageModel(fallbackModelId);

          const escalationPrompt = buildCompanionSystemPrompt({
            ownerName,
            memories: recentMemories,
            recentHealthSnapshots,
            requestHints,
            supportsTools: true,
            productOpportunityEnabled: isProductOpportunityConfigured(),
            agentTaskEnabled: true,
            jiraEnabled: isJiraConfigured(),
            delegationHint,
            delegationCapabilityAppendix,
            goalContextAppendix,
          });

          markFirstModelCall();
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
          markFirstModelCall();
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
          const gatewayTools = {
            ...baseTools,
            ...companionTools,
            ...gatewayExtraTools,
            ...(openClawToolsBlock ?? {}),
          };
          const gatewayActiveTools = noActiveTools
            ? []
            : [
                ...baseToolNames,
                ...companionToolNames,
                ...gatewayExtraToolNames,
                ...openClawToolNames,
              ];

          const mergeGatewayStream = () => {
            markFirstModelCall();
            const result = streamText({
              ...gatewayCommonStreamArgs,
              tools: gatewayTools,
              experimental_activeTools: gatewayActiveTools,
            });
            dataStream.merge(
              result.toUIMessageStream({
                sendReasoning: showThinking && isReasoningModel,
              })
            );
          };

          const mergeOllamaAfterGatewayFailure = async (notice: string) => {
            dataStream.write({
              type: "data-fallback-notice",
              data: notice,
            });

            await assertOllamaReachable();

            const fbModelId = getDefaultGatewayFallbackOllamaModelId();
            const fbConfig = getChatModelWithLocalFallback(fbModelId);
            const fbVariant = fbConfig?.promptVariant ?? "slim";
            const fbLocalClass = getResolvedLocalModelClass(
              fbModelId,
              fbConfig
            );
            const fbSystem =
              fbVariant === "compact"
                ? buildCompactCompanionPrompt({
                    ownerName,
                    memories: recentMemories,
                    localModelClass: fbLocalClass,
                    goalContextAppendix,
                  })
                : buildSlimCompanionPrompt({
                    ownerName,
                    memories: recentMemories,
                    localModelClass: fbLocalClass,
                    goalContextAppendix,
                  });
            const fbSystemTokens = estimateTokens(fbSystem);
            const fbMessages = trimMessagesForBudget({
              messages: convertedModelMessages,
              systemTokenCount: fbSystemTokens,
              maxContextTokens: fbConfig?.maxContextTokens ?? 2048,
            });
            const fbOllamaOptions = {
              ...fbConfig?.ollamaOptions,
              ...(showThinking ? { think: true as const } : {}),
            };

            v2EvalStreamMetrics.effectiveModelId = fbModelId;
            v2EvalStreamMetrics.fallbackTier = "ollama";
            v2EvalStreamMetrics.effectivePromptVariant =
              fbVariant === "compact" ? "compact" : "slim";

            markFirstModelCall();
            const fbResult = streamText({
              model: getLanguageModel(
                resolveRuntimeModelId(fbModelId),
                fbOllamaOptions
              ),
              system: fbSystem,
              messages: fbMessages,
              stopWhen: stepCountIs(5),
              experimental_telemetry: {
                isEnabled: isProductionEnvironment,
                functionId: "stream-text",
              },
              ...metricsHooks,
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
              fbResult.toUIMessageStream({
                sendReasoning: showThinking,
              })
            );
          };

          try {
            mergeGatewayStream();
          } catch (gatewayErr: unknown) {
            if (!isGatewayFallbackEligibleError(gatewayErr)) {
              throw gatewayErr;
            }

            if (isGeminiDirectConfigured()) {
              try {
                dataStream.write({
                  type: "data-fallback-notice",
                  data: "AI Gateway unavailable or rate limited; trying Google Generative AI API.",
                });
                const geminiBareId = getGatewayFallbackGeminiModel();
                v2EvalStreamMetrics.effectiveModelId = `gemini/${geminiBareId}`;
                v2EvalStreamMetrics.fallbackTier = "gemini";
                v2EvalStreamMetrics.effectivePromptVariant = "full";

                markFirstModelCall();
                const geminiResult = streamText({
                  model: getGeminiLanguageModel(geminiBareId),
                  system: executorSystemPrompt,
                  messages: modelMessages,
                  stopWhen: stepCountIs(5),
                  experimental_telemetry: {
                    isEnabled: isProductionEnvironment,
                    functionId: "stream-text",
                  },
                  ...metricsHooks,
                  tools: gatewayTools,
                  experimental_activeTools: gatewayActiveTools,
                });

                dataStream.merge(
                  geminiResult.toUIMessageStream({
                    sendReasoning: false,
                  })
                );
              } catch (geminiErr: unknown) {
                if (
                  !isGatewayFallbackToOllamaEnabled() ||
                  !isGatewayFallbackEligibleError(geminiErr)
                ) {
                  throw geminiErr;
                }
                await mergeOllamaAfterGatewayFailure(
                  "Google API attempt failed; using local Ollama (limited tools)."
                );
              }
            } else if (isGatewayFallbackToOllamaEnabled()) {
              await mergeOllamaAfterGatewayFailure(
                "Hosted model unavailable; using local Ollama (limited tools)."
              );
            } else {
              throw gatewayErr;
            }
          }
        }

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: id, title });
        }
      },
      generateId: generateUUID,
      onFinish: async (finishEvent) => {
        const finishedMessages = finishEvent.messages;
        const usage = (
          finishEvent as {
            usage?: {
              inputTokens?: number;
              outputTokens?: number;
              totalTokens?: number;
            };
          }
        ).usage;
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

        if (finishedMessages.length > 0) {
          const toolsUsed = extractToolNamesFromUIMessages(finishedMessages);
          const { userMessageLength, responseLength } =
            getLastUserAndAssistantTextLengths(finishedMessages);
          const timestamp = new Date().toISOString();

          await logInteraction({
            timestamp,
            model: v2EvalStreamMetrics.effectiveModelId,
            requestedModelId: chatModel,
            userMessageLength,
            responseLength,
            toolsUsed,
            chatId: id,
            promptVariant: v2EvalStreamMetrics.effectivePromptVariant,
            isOllamaLocal,
            localModelClass: isOllamaLocal ? localModelClass : null,
            recentMemoryRowsInPrompt: recentMemories.length,
            recallMemoryInvoked:
              toolsUsed.includes("recallMemory") ||
              toolsUsed.includes("recall_memory"),
            saveMemoryInvoked:
              toolsUsed.includes("saveMemory") ||
              toolsUsed.includes("save_memory"),
            effectiveModelId: v2EvalStreamMetrics.effectiveModelId,
            fallbackTier: v2EvalStreamMetrics.fallbackTier,
          });

          logDecisionTrace({
            timestamp,
            chatId: id,
            requestedModelId: chatModel,
            effectiveModelId: v2EvalStreamMetrics.effectiveModelId,
            fallbackTier: v2EvalStreamMetrics.fallbackTier,
            promptVariant: v2EvalStreamMetrics.effectivePromptVariant,
            isOllamaLocal,
            trigger: {
              source: "chat",
              type: "user_message",
            },
            toolsInvoked: toolsUsed,
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            totalTokens: usage?.totalTokens ?? null,
            userMessageLength,
            responseLength,
            preStreamTimingsMs: {
              authAndBotCheck:
                authAndBotCheckedAtMs === null
                  ? null
                  : authAndBotCheckedAtMs - requestStartedAtMs,
              promptContextLoad:
                promptContextLoadedAtMs === null ||
                authAndBotCheckedAtMs === null
                  ? null
                  : promptContextLoadedAtMs - authAndBotCheckedAtMs,
              totalBeforeFirstModelCall:
                firstModelCallAtMs === null
                  ? null
                  : firstModelCallAtMs - requestStartedAtMs,
            },
          }).catch(() => undefined);

          logGatewayCost({
            timestamp,
            chatId: id,
            requestedModelId: chatModel,
            effectiveModelId: v2EvalStreamMetrics.effectiveModelId,
            fallbackTier: v2EvalStreamMetrics.fallbackTier,
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            totalTokens: usage?.totalTokens ?? null,
          }).catch(() => undefined);
        }

        logChatPathTelemetryEvent({
          userId: session.user.id,
          chatId: id,
          requestedModelId: chatModel,
          effectiveModelId: v2EvalStreamMetrics.effectiveModelId,
          fallbackTier:
            v2EvalStreamMetrics.fallbackTier === "none"
              ? null
              : v2EvalStreamMetrics.fallbackTier,
          outcome: "completed",
        }).catch(() => undefined);
      },
      onError: (error) => {
        // #region agent log
        if (MissingToolResultsError.isInstance(error)) {
          agentIngestLog({
            location: "app/(chat)/api/chat/route.ts:onError",
            message: "MissingToolResultsError in UI message stream",
            hypothesisId: "H5",
            data: {
              chatId: id,
              toolCallIds: error.toolCallIds,
            },
          });
        }
        // #endregion
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
            logChatPathTelemetryEvent({
              userId: session.user.id,
              chatId: id,
              requestedModelId: chatModel,
              effectiveModelId: v2EvalStreamMetrics.effectiveModelId,
              fallbackTier:
                v2EvalStreamMetrics.fallbackTier === "none"
                  ? null
                  : v2EvalStreamMetrics.fallbackTier,
              outcome: "error",
              errorCode: normalizeChatTelemetryErrorCode(error),
            }).catch(() => undefined);
            return streamMsg;
          }
        }
        logChatPathTelemetryEvent({
          userId: session.user.id,
          chatId: id,
          requestedModelId: chatModel,
          effectiveModelId: v2EvalStreamMetrics.effectiveModelId,
          fallbackTier:
            v2EvalStreamMetrics.fallbackTier === "none"
              ? null
              : v2EvalStreamMetrics.fallbackTier,
          outcome: "error",
          errorCode: normalizeChatTelemetryErrorCode(error),
        }).catch(() => undefined);
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
