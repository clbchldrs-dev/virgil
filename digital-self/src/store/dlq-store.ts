import { nanoid } from "nanoid";
import type { OutboundMessage } from "../core/schemas.js";

export type DeadLetter = {
  id: string;
  message: OutboundMessage;
  error: string;
  attempts: number;
  createdAt: string;
};

export type DeadLetterStore = {
  enqueue: (input: {
    message: OutboundMessage;
    error: string;
    attempts: number;
  }) => DeadLetter;
  list: () => DeadLetter[];
  get: (id: string) => DeadLetter | undefined;
  dequeue: (id: string) => DeadLetter | undefined;
};

export function createInMemoryDlqStore(): DeadLetterStore {
  const items = new Map<string, DeadLetter>();

  return {
    enqueue: ({ message, error, attempts }) => {
      const record: DeadLetter = {
        id: nanoid(),
        message,
        error,
        attempts,
        createdAt: new Date().toISOString(),
      };
      items.set(record.id, record);
      return record;
    },
    list: () => [...items.values()],
    get: (id) => items.get(id),
    dequeue: (id) => {
      const current = items.get(id);
      if (!current) {
        return undefined;
      }
      items.delete(id);
      return current;
    },
  };
}
