import { describeMode, resolveInterferenceMode } from "./interference-modes.js";
import type {
  InboundMessage,
  InterferenceMode,
  PolicyRoute,
  TrustTier,
} from "./schemas.js";

export type PolicyDecision = {
  route: PolicyRoute;
  riskScore: number;
  reasons: string[];
  mode: InterferenceMode;
  trustTier: TrustTier;
};

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(legal|lawsuit|attorney|lawyer|contract|nda|subpoena)\b/i,
  /\b(password|passcode|2fa|otp|ssn|social security)\b/i,
  /\b(break up|divorce|suicid|self[- ]harm|abuse)\b/i,
  /\b(fire(d)?|terminate|layoff|hr\b|human resources)\b/i,
  /\b(loan|mortgage|wire transfer|iban|swift)\b/i,
];

const COMMITMENT_PATTERNS: RegExp[] = [
  /\b(promise|guarantee|commit to|i swear|100% sure)\b/i,
  /\b(sign(ed)?|signature)\b/i,
];

const LOW_RISK_ACK_PATTERNS: RegExp[] = [
  /^(ok|okay|thanks|thank you|sounds good|got it|confirmed|yes|yep|sure)\b/i,
  /^(see you|ttyl|on my way)\b/i,
];

function scoreSensitive(text: string): { add: number; hit: string[] } {
  let add = 0;
  const hit: string[] = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      add += 35;
      hit.push(pattern.source);
    }
  }
  for (const pattern of COMMITMENT_PATTERNS) {
    if (pattern.test(text)) {
      add += 20;
      hit.push(`commit:${pattern.source}`);
    }
  }
  return { add, hit };
}

function trustBaseScore(tier: TrustTier): number {
  switch (tier) {
    case "trusted":
      return 0;
    case "acquaintance":
      return 15;
    case "unknown":
      return 30;
    default: {
      const _e: never = tier;
      return _e;
    }
  }
}

function channelRisk(channel: InboundMessage["channel"]): number {
  switch (channel) {
    case "sms":
      return 10;
    case "whatsapp":
      return 5;
    case "slack":
      return 0;
    default: {
      const _e: never = channel;
      return _e;
    }
  }
}

function lowRiskAck(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > 120) {
    return false;
  }
  return LOW_RISK_ACK_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export type PolicyEngineInput = {
  message: InboundMessage;
  trustTier: TrustTier;
  mode: InterferenceMode | undefined;
  storedMode: InterferenceMode | undefined;
};

export function evaluatePolicy(input: PolicyEngineInput): PolicyDecision {
  const mode = resolveInterferenceMode(input.mode, input.storedMode);
  const reasons: string[] = [];
  let risk =
    trustBaseScore(input.trustTier) + channelRisk(input.message.channel);

  const sensitive = scoreSensitive(input.message.bodyText);
  risk += sensitive.add;
  if (sensitive.hit.length > 0) {
    reasons.push(
      `Sensitive or high-stakes language matched (${sensitive.hit.length} signals).`
    );
  }

  if (lowRiskAck(input.message.bodyText)) {
    risk -= 12;
    reasons.push("Short acknowledgment-style message lowers risk.");
  }

  risk = Math.min(100, Math.max(0, risk));

  if (mode === "shield") {
    return {
      route: "hold",
      riskScore: risk,
      reasons: [
        ...reasons,
        `Mode shield: ${describeMode("shield")}`,
        "No automatic send; batching / human review required.",
      ],
      mode,
      trustTier: input.trustTier,
    };
  }

  if (risk >= 85) {
    return {
      route: "block",
      riskScore: risk,
      reasons: [...reasons, "Score at or above block threshold."],
      mode,
      trustTier: input.trustTier,
    };
  }

  if (mode === "assistant") {
    if (
      risk < 22 &&
      input.trustTier === "trusted" &&
      lowRiskAck(input.message.bodyText)
    ) {
      return {
        route: "auto",
        riskScore: risk,
        reasons: [
          ...reasons,
          "Assistant mode: trusted + very low risk acknowledgment.",
        ],
        mode,
        trustTier: input.trustTier,
      };
    }
    return {
      route: "approval",
      riskScore: risk,
      reasons: [
        ...reasons,
        "Assistant mode defaults to approval for non-trivial traffic.",
      ],
      mode,
      trustTier: input.trustTier,
    };
  }

  if (mode === "autopilot-lite") {
    const autoThreshold = input.trustTier === "trusted" ? 45 : 28;
    if (risk < autoThreshold) {
      return {
        route: "auto",
        riskScore: risk,
        reasons: [
          ...reasons,
          `Autopilot-lite: score ${risk} under threshold ${autoThreshold} for trust ${input.trustTier}.`,
        ],
        mode,
        trustTier: input.trustTier,
      };
    }
    return {
      route: "approval",
      riskScore: risk,
      reasons: [...reasons, "Autopilot-lite: elevated risk requires approval."],
      mode,
      trustTier: input.trustTier,
    };
  }

  const _exhaustive: never = mode;
  return _exhaustive;
}
