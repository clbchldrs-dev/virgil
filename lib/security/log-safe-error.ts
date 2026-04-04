import { isProductionEnvironment } from "@/lib/constants";

/**
 * Logs an error for operators without dumping full request bodies or nested provider payloads.
 * In production, omits stack traces (paths/noise); in development, keeps stack for debugging.
 */
export function logChatApiException(
  label: string,
  error: unknown,
  meta: Record<string, string | undefined>
): void {
  if (error instanceof Error) {
    if (isProductionEnvironment) {
      console.error(label, {
        ...meta,
        name: error.name,
        message: error.message,
      });
      return;
    }
    console.error(label, error, meta);
    return;
  }
  console.error(label, { ...meta, detail: String(error) });
}
