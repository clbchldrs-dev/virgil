const VIRGIL_DEBUG_INGEST_URL =
  "http://127.0.0.1:7489/ingest/7925a257-7797-4a8d-9c5b-1a308b2155f1";

type VirgilDebugIngestHeaders = Record<string, string>;

/**
 * Fire-and-forget local Cursor/debug ingest. No-op outside `NODE_ENV === "development"`.
 */
export function postVirgilDebugIngest(
  payload: Record<string, unknown>,
  extraHeaders?: VirgilDebugIngestHeaders
): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  const headers: VirgilDebugIngestHeaders = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  fetch(VIRGIL_DEBUG_INGEST_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  }).catch(() => {
    /* Intentional: debug ingest must not block the app */
  });
}
