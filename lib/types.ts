import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { editDocument } from "./ai/tools/edit-document";
import type { escalateToHuman } from "./ai/tools/escalate-to-human";
import type { getWeather } from "./ai/tools/get-weather";
import type { recallMemory } from "./ai/tools/recall-memory";
import type { recordIntake } from "./ai/tools/record-intake";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { saveMemory } from "./ai/tools/save-memory";
import type { setReminder } from "./ai/tools/set-reminder";
import type { submitProductOpportunity } from "./ai/tools/submit-product-opportunity";
import type { summarizeOpportunity } from "./ai/tools/summarize-opportunity";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type ChatTools = {
  getWeather: InferUITool<typeof getWeather>;
  createDocument: InferUITool<ReturnType<typeof createDocument>>;
  editDocument: InferUITool<ReturnType<typeof editDocument>>;
  updateDocument: InferUITool<ReturnType<typeof updateDocument>>;
  requestSuggestions: InferUITool<ReturnType<typeof requestSuggestions>>;
  saveMemory: InferUITool<ReturnType<typeof saveMemory>>;
  recallMemory: InferUITool<ReturnType<typeof recallMemory>>;
  setReminder: InferUITool<ReturnType<typeof setReminder>>;
  submitProductOpportunity: InferUITool<
    ReturnType<typeof submitProductOpportunity>
  >;
  escalateToHuman: InferUITool<ReturnType<typeof escalateToHuman>>;
  recordIntake: InferUITool<ReturnType<typeof recordIntake>>;
  summarizeOpportunity: InferUITool<typeof summarizeOpportunity>;
};

/** Last completed assistant turn; emitted as `data-model-metrics` from the chat API. */
export type ModelMetricsPayload = {
  chatModel: string;
  firstTokenMs: number | null;
  totalMs: number;
  streamWindowMs: number;
  outputTokensReported: number | undefined;
  estimatedOutputTokens: number;
  rateSource: "provider" | "estimated";
  tokensPerSecWall: number | null;
  tokensPerSecStream: number | null;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  "model-metrics": ModelMetricsPayload;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
