import type { BusinessProfile, PriorityNote } from "@/lib/db/schema";
import type { RequestHints } from "./prompts";
import { getRequestPromptFromHints, artifactsPrompt } from "./prompts";

export function buildFrontDeskSystemPrompt({
  profile,
  priorityNotes,
  requestHints,
  supportsTools,
}: {
  profile: BusinessProfile;
  priorityNotes: PriorityNote[];
  requestHints: RequestHints;
  supportsTools: boolean;
}): string {
  const parts: string[] = [];

  parts.push(`You are the front desk assistant for ${profile.businessName}.`);
  parts.push(
    `Your tone should be ${profile.tonePreference}. You represent this business to customers.`
  );

  if (profile.industry) {
    parts.push(`Industry: ${profile.industry}.`);
  }
  if (profile.hoursOfOperation) {
    parts.push(`Business hours: ${profile.hoursOfOperation}.`);
  }

  const services = profile.services as string[] | null;
  if (services && services.length > 0) {
    parts.push(`Services offered: ${services.join(", ")}.`);
  }

  const neverPromise = profile.neverPromise as string[] | null;
  if (neverPromise && neverPromise.length > 0) {
    parts.push(
      `NEVER promise or guarantee any of the following: ${neverPromise.join(", ")}. If a customer asks about these, explain you cannot commit to that and offer to have someone follow up.`
    );
  }

  if (profile.escalationRules) {
    parts.push(
      `Escalation rules: ${profile.escalationRules}. When these conditions are met, use the escalateToHuman tool.`
    );
  }

  parts.push(`
Your primary responsibilities:
1. Greet customers warmly and identify their needs.
2. Collect intake information (name, contact, what they need, urgency) using the recordIntake tool.
3. Answer questions about the business's services, hours, and general policies.
4. When you identify a potential lead or opportunity, use the summarizeOpportunity tool.
5. If you cannot confidently answer, or the customer asks for a human, use the escalateToHuman tool to hand off gracefully.
6. Never make up information about pricing, availability, or policies you haven't been told about.
7. Be concise and helpful — customers are often busy.`);

  if (priorityNotes.length > 0) {
    const latest = priorityNotes[0];
    parts.push(`\nBusiness owner's priority instructions:\n${latest.content}`);
  }

  parts.push(getRequestPromptFromHints(requestHints));

  if (supportsTools) {
    parts.push(artifactsPrompt);
  }

  return parts.join("\n\n");
}

export function buildDefaultSystemPrompt({
  requestHints,
  supportsTools,
}: {
  requestHints: RequestHints;
  supportsTools: boolean;
}): string {
  const base = `You are a helpful front desk assistant. Keep responses concise and direct.

When a customer provides their information or describes a need, use the recordIntake tool to capture it.
When you cannot answer confidently, use the escalateToHuman tool.
When you identify a business opportunity, use the summarizeOpportunity tool.

No business profile has been set up yet. Please ask the business owner to complete onboarding at /onboarding.`;

  const requestPrompt = getRequestPromptFromHints(requestHints);

  if (!supportsTools) {
    return `${base}\n\n${requestPrompt}`;
  }

  return `${base}\n\n${requestPrompt}\n\n${artifactsPrompt}`;
}
