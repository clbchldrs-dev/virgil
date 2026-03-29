import { customProvider, gateway } from "ai";
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

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  if (isLocalModel(modelId)) {
    return getOllamaModel(modelId);
  }

  return gateway.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  if (isLocalModel(titleModel.id)) {
    return getOllamaModel(titleModel.id);
  }
  return gateway.languageModel(titleModel.id);
}
