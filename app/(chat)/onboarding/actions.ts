"use server";

import { auth } from "@/app/(auth)/auth";
import {
  getBusinessProfileByUserId,
  savePriorityNote,
  upsertBusinessProfile,
} from "@/lib/db/queries";

export type OnboardingFormState = {
  success: boolean;
  error?: string;
};

export async function saveOnboarding(
  _prev: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const businessName = formData.get("businessName") as string;
  if (!businessName?.trim()) {
    return { success: false, error: "Business name is required" };
  }

  const servicesRaw = formData.get("services") as string;
  const services = servicesRaw
    ? servicesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const neverPromiseRaw = formData.get("neverPromise") as string;
  const neverPromise = neverPromiseRaw
    ? neverPromiseRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const tonePreference =
    (formData.get("tonePreference") as
      | "friendly"
      | "professional"
      | "casual") ?? "professional";

  const businessModeEnabled = formData.get("businessModeEnabled") === "on";

  try {
    const profile = await upsertBusinessProfile({
      userId: session.user.id,
      data: {
        businessName: businessName.trim(),
        industry: (formData.get("industry") as string)?.trim() || null,
        hoursOfOperation:
          (formData.get("hoursOfOperation") as string)?.trim() || null,
        services,
        tonePreference,
        neverPromise,
        businessModeEnabled,
        escalationContactName:
          (formData.get("escalationContactName") as string)?.trim() || null,
        escalationContactEmail:
          (formData.get("escalationContactEmail") as string)?.trim() || null,
        escalationRules:
          (formData.get("escalationRules") as string)?.trim() || null,
      },
    });

    const priorityContent = formData.get("priorityNotes") as string;
    if (priorityContent?.trim() && profile) {
      await savePriorityNote({
        businessProfileId: profile.id,
        content: priorityContent.trim(),
      });
    }

    return { success: true };
  } catch (_error) {
    return { success: false, error: "Failed to save. Please try again." };
  }
}

export async function getExistingProfile() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return getBusinessProfileByUserId({ userId: session.user.id });
}
