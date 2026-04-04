type LocalContextMessage = {
  role: string;
  content: unknown;
};

type TrimArgs<T extends LocalContextMessage> = {
  messages: T[];
  systemTokenCount: number;
  maxContextTokens: number;
};

const DEFAULT_RECENT_MESSAGES = 4;
/** Long threads keep slightly more of the tail for continuity on the same token budget. */
const LONG_THREAD_RECENT_MESSAGES = 6;
const LONG_THREAD_MIN_MESSAGES = 12;
/** Rough role/wrapper cost so trimming matches API reality better than raw char counts alone. */
const TOKENS_PER_MESSAGE_OVERHEAD = 3;
const LONG_MESSAGE_TRIM_THRESHOLD_TOKENS = 200;
const LONG_MESSAGE_TRIM_TARGET_TOKENS = 150;
const TRUNCATED_MESSAGE_SUFFIX = " [message truncated]";
const TRIM_MARKER = "[earlier conversation trimmed]";

export function estimateTokens(value: unknown): number {
  const text = stringifyContent(value);
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / 3.5);
}

export function trimMessagesForBudget<T extends LocalContextMessage>({
  messages,
  systemTokenCount,
  maxContextTokens,
}: TrimArgs<T>) {
  const budget = Math.max(0, maxContextTokens - systemTokenCount);

  if (messages.length <= 2) {
    const compressed = messages.map((message) => compressLongMessage(message));
    if (estimateMessages(compressed) <= budget) {
      return compressed;
    }

    if (compressed.length === 2) {
      const firstCompressed = compressed[0];
      const lastCompressed = compressed[1];
      if (!firstCompressed || !lastCompressed) {
        return compressed
          .slice(-1)
          .map((message) => truncateMessageToBudget(message, budget));
      }
      const withMarker = [
        firstCompressed,
        buildTrimMarker<T>(),
        lastCompressed,
      ];
      if (estimateMessages(withMarker) <= budget) {
        return withMarker;
      }
      return [truncateMessageToBudget(lastCompressed, budget)];
    }

    return compressed
      .slice(-1)
      .map((message) => truncateMessageToBudget(message, budget));
  }

  const recentCap =
    messages.length > LONG_THREAD_MIN_MESSAGES
      ? LONG_THREAD_RECENT_MESSAGES
      : DEFAULT_RECENT_MESSAGES;
  const recentCount = Math.min(recentCap, messages.length - 1);
  const first = messages[0];
  if (!first) {
    return [];
  }

  const firstMessage = compressLongMessage(first);
  const tail = messages
    .slice(-recentCount)
    .map((message) => compressLongMessage(message));
  const middle = messages
    .slice(1, Math.max(1, messages.length - recentCount))
    .map((message) => compressLongMessage(message));

  let keptMiddle: T[] = [];

  for (let index = middle.length - 1; index >= 0; index -= 1) {
    const candidate = middle[index];
    if (!candidate) {
      continue;
    }

    const before = keptMiddle;
    let trial: T[] = [candidate, ...keptMiddle];

    while (true) {
      const totalTokens = estimateFirstTailMiddleTokens({
        firstMessage,
        middleLength: middle.length,
        middleIndex: index,
        trial,
        tail,
      });
      if (totalTokens <= budget) {
        break;
      }
      if (trial.length === 0) {
        break;
      }

      const assistantIndex = trial.findIndex((m) => m.role === "assistant");
      if (assistantIndex >= 0) {
        trial = trial.filter((_, j) => j !== assistantIndex);
      } else {
        trial = trial.slice(1);
        break;
      }
    }

    if (trial.length === 0) {
      const tokensIfEmptyMiddle = estimateFirstTailMiddleTokens({
        firstMessage,
        middleLength: middle.length,
        middleIndex: index,
        trial: [],
        tail,
      });
      if (tokensIfEmptyMiddle > budget) {
        keptMiddle = before;
        continue;
      }
    }

    keptMiddle = trial;
  }

  const useMiddleTrimMarker = !isFullMiddleKept(keptMiddle, middle);
  const trimmed = useMiddleTrimMarker
    ? [firstMessage, buildTrimMarker<T>(), ...keptMiddle, ...tail]
    : [firstMessage, ...keptMiddle, ...tail];

  if (estimateMessages(trimmed) <= budget || trimmed.length === 0) {
    return dedupeAdjacent(trimmed);
  }

  for (let start = 0; start <= Math.max(0, tail.length - 2); start += 1) {
    const candidate = dedupeAdjacent([
      firstMessage,
      buildTrimMarker<T>(),
      ...tail.slice(start),
    ]);
    if (estimateMessages(candidate) <= budget) {
      return candidate;
    }
  }

  for (let start = 0; start <= Math.max(0, tail.length - 2); start += 1) {
    const candidate = dedupeAdjacent([firstMessage, ...tail.slice(start)]);
    if (estimateMessages(candidate) <= budget) {
      return candidate;
    }
  }

  return dedupeAdjacent([firstMessage, ...tail.slice(-2)]);
}

/** Caps very long **user or assistant** turns so the first/middle segments do not starve the tail. */
function compressLongMessage<T extends LocalContextMessage>(message: T): T {
  if (estimateTokens(message.content) <= LONG_MESSAGE_TRIM_THRESHOLD_TOKENS) {
    return message;
  }

  const fullText = stringifyContent(message.content);
  if (!fullText) {
    return message;
  }

  const maxChars = Math.ceil(LONG_MESSAGE_TRIM_TARGET_TOKENS * 3.5);
  const trimmedText =
    fullText.length > maxChars
      ? `${fullText.slice(0, maxChars).trimEnd()} ...`
      : fullText;

  return { ...message, content: trimmedText };
}

function truncateMessageToBudget<T extends LocalContextMessage>(
  message: T,
  budget: number
): T {
  const fullText = stringifyContent(message.content);
  if (!fullText || estimateTokens(fullText) <= budget) {
    return message;
  }

  const availableChars = Math.max(
    0,
    Math.floor(budget * 3.5) - TRUNCATED_MESSAGE_SUFFIX.length
  );
  const truncated = fullText.slice(0, availableChars).trimEnd();

  return {
    ...message,
    content: `${truncated}${TRUNCATED_MESSAGE_SUFFIX}`.trim(),
  };
}

function buildTrimMarker<T extends LocalContextMessage>(): T {
  return {
    role: "user",
    content: TRIM_MARKER,
  } as T;
}

function estimateMessages(messages: LocalContextMessage[]) {
  const contentTokens = messages.reduce(
    (total, message) => total + estimateTokens(message.content),
    0
  );
  return contentTokens + TOKENS_PER_MESSAGE_OVERHEAD * messages.length;
}

function isFullMiddleKept<T extends LocalContextMessage>(
  kept: T[],
  full: T[]
): boolean {
  if (kept.length !== full.length) {
    return false;
  }
  for (let i = 0; i < kept.length; i++) {
    if (kept[i] !== full[i]) {
      return false;
    }
  }
  return true;
}

function estimateFirstTailMiddleTokens<T extends LocalContextMessage>({
  firstMessage,
  middleLength,
  middleIndex,
  trial,
  tail,
}: {
  firstMessage: T;
  middleLength: number;
  middleIndex: number;
  trial: T[];
  tail: T[];
}): number {
  const useMarker = middleIndex > 0 || trial.length < middleLength;
  const seq = useMarker
    ? [firstMessage, buildTrimMarker<T>(), ...trial, ...tail]
    : [firstMessage, ...trial, ...tail];
  return estimateMessages(seq);
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyContent(item))
      .filter(Boolean)
      .join(" ");
  }

  if (value && typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("content" in value) {
      return stringifyContent((value as { content: unknown }).content);
    }
  }

  return "";
}

function dedupeAdjacent<T extends LocalContextMessage>(messages: T[]) {
  return messages.filter((message, index) => {
    if (index === 0) {
      return true;
    }

    const previous = messages[index - 1];
    if (!previous) {
      return true;
    }

    return !(
      message.role === previous.role &&
      stringifyContent(message.content) === stringifyContent(previous.content)
    );
  });
}
