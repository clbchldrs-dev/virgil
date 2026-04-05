export function isDigitalSelfBridgeConfigured(): boolean {
  return Boolean(process.env.DIGITAL_SELF_BASE_URL?.trim());
}

export function getDigitalSelfBaseUrl(): string | null {
  const raw = process.env.DIGITAL_SELF_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : null;
}
