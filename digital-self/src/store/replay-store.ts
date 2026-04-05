import { nanoid } from "nanoid";

export type ReplayRecord = {
  id: string;
  source: string;
  body: string;
  headers: Record<string, string>;
  createdAt: string;
};

export type ReplayStore = {
  record: (input: {
    source: string;
    body: string;
    headers: Record<string, string>;
  }) => ReplayRecord;
  list: (limit?: number) => ReplayRecord[];
  get: (id: string) => ReplayRecord | undefined;
};

export function createInMemoryReplayStore(): ReplayStore {
  const items: ReplayRecord[] = [];

  return {
    record: ({ source, body, headers }) => {
      const entry: ReplayRecord = {
        id: nanoid(),
        source,
        body,
        headers,
        createdAt: new Date().toISOString(),
      };
      items.push(entry);
      return entry;
    },
    list: (limit = 50) => items.slice(-limit),
    get: (id) => items.find((item) => item.id === id),
  };
}
