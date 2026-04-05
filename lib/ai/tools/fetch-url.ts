import { tool } from "ai";
import { z } from "zod";
import { assertAgentFetchUrlAllowed } from "@/lib/http/agent-egress";

const MAX_RESPONSE_BYTES = 512_000;
const FETCH_TIMEOUT_MS = 12_000;

/**
 * Read-only HTTP GET for allowlisted hosts (gateway chat path).
 * Extend `AGENT_FETCH_ALLOWLIST_HOSTS` for research-lane URLs.
 */
export function fetchUrl() {
  return tool({
    description:
      "Fetch a public URL over HTTP GET and return trimmed text (HTML stripped loosely). " +
      "Only hostnames in AGENT_FETCH_ALLOWLIST_HOSTS are allowed. Use for research lane; prefer quoting sources.",
    inputSchema: z.object({
      url: z.string().url().describe("https URL on an allowlisted host"),
    }),
    execute: async ({ url }) => {
      assertAgentFetchUrlAllowed(url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent":
              "VirgilFetch/1.0 (personal assistant; +https://github.com)",
            Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.1",
          },
        });

        const contentType = res.headers.get("content-type") ?? "";
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_RESPONSE_BYTES) {
          return {
            ok: false as const,
            status: res.status,
            message: `Response exceeded ${String(MAX_RESPONSE_BYTES)} bytes; refuse to load.`,
          };
        }

        const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
        const snippet = normalizeFetchedText(text, contentType).slice(
          0,
          24_000
        );

        return {
          ok: res.ok,
          status: res.status,
          contentType,
          excerpt: snippet,
          truncated: text.length > snippet.length,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "fetch failed";
        return {
          ok: false as const,
          message: msg,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}

function normalizeFetchedText(raw: string, contentType: string): string {
  if (contentType.includes("json")) {
    return raw.trim();
  }
  let t = raw.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}
