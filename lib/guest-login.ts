function truthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/**
 * Temporary guest sessions (`guest-*` users) from login/register.
 * **Default off** — set `VIRGIL_GUEST_LOGIN_ENABLED=1` to enable (e.g. local quick tries).
 */
export function isGuestLoginEnabled(): boolean {
  return truthyEnv(process.env.VIRGIL_GUEST_LOGIN_ENABLED);
}
