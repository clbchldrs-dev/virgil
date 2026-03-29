"use server";

import { auth } from "@/app/(auth)/auth";
import { setBusinessModeEnabled } from "@/lib/db/queries";

export type PreferencesState = {
  success: boolean;
  error?: string;
};

export async function toggleBusinessModeAction(
  _prev: PreferencesState,
  formData: FormData
): Promise<PreferencesState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const enabled = formData.get("businessModeEnabled") === "on";

  try {
    const updated = await setBusinessModeEnabled({
      userId: session.user.id,
      enabled,
    });
    if (!updated) {
      return {
        success: false,
        error: "No business profile yet. Add one under Business profile.",
      };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Could not update. Try again." };
  }
}
