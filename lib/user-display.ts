import { guestRegex } from "@/lib/constants";

/**
 * Short label for greetings and nav: first name, email local-part, or fallback.
 */
export function getUserDisplayFirstName(user: {
  name?: string | null;
  email?: string | null;
}): string {
  const email = user.email ?? "";
  if (guestRegex.test(email)) {
    return "Guest";
  }
  const name = user.name?.trim();
  if (name) {
    const first = name.split(/\s+/)[0];
    if (first) {
      return first;
    }
  }
  const at = email.indexOf("@");
  if (at > 0) {
    const local = email.slice(0, at);
    if (local.length > 0) {
      return local.charAt(0).toUpperCase() + local.slice(1);
    }
  }
  return "there";
}
