import { customProvider, gateway, type LanguageModel } from "ai";
import { ollama } from "ollama-ai-provider";
import { isTestEnvironment } from "../constants";
import { titleModel, isLocalModel } from "./models";

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

function getOllamaModel(modelId: string) {
  const ollamaModelName = modelId.replace("ollama/", "");
  return ollama(ollamaModelName);
}

/** Ollama provider still types models as v1; runtime works with the current AI SDK. */
function ollamaAsLanguageModel(modelId: string): LanguageModel {
  return getOllamaModel(modelId) as unknown as LanguageModel;
}

export function getLanguageModel(modelId: string): LanguageModel {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId) as LanguageModel;
  }

  if (isLocalModel(modelId)) {
    return ollamaAsLanguageModel(modelId);
  }

  return gateway.languageModel(modelId) as LanguageModel;
}

export function getTitleModel(): LanguageModel {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model") as LanguageModel;
  }
  if (isLocalModel(titleModel.id)) {
    return ollamaAsLanguageModel(titleModel.id);
  }
  return gateway.languageModel(titleModel.id) as LanguageModel;
}
