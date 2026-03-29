/** Empty-state chips: two lines in UI, full text sent as the user message. */
export type ChatEmptySuggestion = {
  prompt: string;
  lines: readonly [string, string];
};

export function pickRandom<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("pickRandom: empty list");
  }
  const i = Math.floor(Math.random() * items.length);
  const item = items[i];
  if (item === undefined) {
    throw new Error("pickRandom: index out of range");
  }
  return item;
}

/** Stable first entry for SSR/hydration before client randomizes. */
export function firstSuggestion<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error("firstSuggestion: empty list");
  }
  return item;
}

/** Left pill: video-game defeat / continue screen energy. */
export const DEFEAT_SCREEN_SUGGESTIONS: ChatEmptySuggestion[] = [
  {
    prompt: "I got destroyed today. Help me debrief like a post-game lobby.",
    lines: ["YOU DIED", "Continue anyway?"],
  },
  {
    prompt:
      "I need a pep talk after failing spectacularly at something trivial.",
    lines: ["GAME OVER", "Insert coin to rant"],
  },
  {
    prompt:
      "Explain what went wrong with my last attempt in kind but honest terms.",
    lines: ["WASTED", "Respawn with dignity"],
  },
  {
    prompt: "The universe handed me an L. What should I do next?",
    lines: ["DEFEAT", "Loot: experience"],
  },
  {
    prompt: "I need to recover from a brutal mistake. Walk me through it.",
    lines: ["CONTINUE?", "10… 9… 8…"],
  },
  {
    prompt: "Turn my bad day into a speedrun strategy guide.",
    lines: ["QUEST FAILED", "Retry on hard mode"],
  },
  {
    prompt:
      "I faceplanted. Give me the narrator voice from a soulslike death screen.",
    lines: ["YOU HAVE DIED", "The fog rolls in…"],
  },
  {
    prompt: "Help me laugh at how badly that went.",
    lines: ["HIGH SCORE", "of embarrassment"],
  },
  {
    prompt: "I need emotional bandages after that L.",
    lines: ["SAVE LOST", "Cloud backup: denial"],
  },
  {
    prompt: "Coach me out of shame spiral mode.",
    lines: ["FINAL SCORE: 0", "Bonus round: hope"],
  },
];

/** Middle pill fallback when we skip or can't run personalization. */
export const GENERIC_HELPFUL_MIDDLES: ChatEmptySuggestion[] = [
  {
    prompt:
      "What should I focus on today if I only have two hours of deep work?",
    lines: ["If I only have", "two hours today—what matters?"],
  },
  {
    prompt: "Help me turn a vague worry into a concrete next step.",
    lines: ["This thing is stuck", "in my head—untangle it"],
  },
  {
    prompt: "What's a small experiment I could run this week to learn faster?",
    lines: ["Smallest test", "I could run this week?"],
  },
  {
    prompt: "Ask me one question that would unlock the most useful advice.",
    lines: ["One question", "that would help you help me"],
  },
];

/** Right pill: silly / non sequitur starters. */
export const AMUSING_RANDOM_SUGGESTIONS: ChatEmptySuggestion[] = [
  {
    prompt:
      "Explain quantum entanglement using only fridge magnets as a metaphor.",
    lines: ["Explain entanglement", "via fridge poetry"],
  },
  {
    prompt: "What's the airspeed velocity of an unladen swallow?",
    lines: ["African or European", "swallow? Asking for me."],
  },
  {
    prompt: "Write a legal disclaimer for my microwave.",
    lines: ["Terms of service", "for my microwave"],
  },
  {
    prompt: "Roast my to-do list like a British panel show.",
    lines: ["Roast my to-do list", "gently but brutally"],
  },
  {
    prompt: "How would a raccoon engineer deploy to production?",
    lines: ["If a raccoon", "owned our deploy pipeline"],
  },
  {
    prompt: "Pitch me a startup that sells silence as a service.",
    lines: ["Pitch: SaaS", "but it's just quiet"],
  },
  {
    prompt: "What would Dijkstra say about my folder structure?",
    lines: ["Dijkstra judges", "my `node_modules`"],
  },
  {
    prompt: "Help me negotiate with my past self.",
    lines: ["Negotiate with", "yesterday's me"],
  },
  {
    prompt: "Invent a holiday for people who finished the tutorial.",
    lines: ["New holiday:", "Skipped Cutscene Day"],
  },
  {
    prompt: "Translate this mood into a CSV.",
    lines: ["Export my vibe", "to spreadsheet"],
  },
];
