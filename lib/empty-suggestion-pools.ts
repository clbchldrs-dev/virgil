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

/** Middle pill: starts a fresh thread via `/chat/:id` (prompt unused). */
export const MIDDLE_CONTINUE_SUGGESTION: ChatEmptySuggestion = {
  prompt: "",
  lines: ["Continue", ""],
};

/**
 * Left pill: cryptic fallback when personalization is unavailable.
 * Prompts are concrete; chip lines stay unsettling.
 */
export const CRYPTIC_FALLBACK_LEFT_SUGGESTIONS: ChatEmptySuggestion[] = [
  {
    prompt:
      "What is the one thing I am avoiding naming right now? Say it plainly.",
    lines: ["The door behind you", "was never locked"],
  },
  {
    prompt:
      "Name the task that would break the spell if I finished it. One sentence.",
    lines: ["The third name", "on the list you tore"],
  },
  {
    prompt:
      "What should I do in the next hour that I keep pretending I forgot?",
    lines: ["You already know", "which file"],
  },
  {
    prompt: "Call out the real blocker—not the polite one. Be direct.",
    lines: ["Not the bug", "the fear"],
  },
  {
    prompt: "What is the smallest honest step I can take before I go to sleep?",
    lines: ["Before midnight", "send one message"],
  },
  {
    prompt: "What am I optimizing for that I would not admit out loud?",
    lines: ["Comfort", "disguised as progress"],
  },
  {
    prompt: "What should I delete from my week to make room for the real goal?",
    lines: ["The ritual", "that eats the hour"],
  },
  {
    prompt:
      "What is the one conversation I am postponing because it would change everything?",
    lines: ["They are waiting", "in draft"],
  },
  {
    prompt: "What would I do if I stopped negotiating with myself?",
    lines: ["No more", "tomorrow clauses"],
  },
  {
    prompt:
      "What is the task that feels like bad luck but is actually just avoidance?",
    lines: ["The email", "with no subject"],
  },
  {
    prompt: "Name the next physical action—not the plan, the action.",
    lines: ["Stand up", "open the drawer"],
  },
  {
    prompt:
      "What should I do in the next ten minutes that I would regret skipping?",
    lines: ["The timer", "already started"],
  },
];

/** Right pill: flamboyant Dark Souls / soulslike energy. */
export const DARK_SOULS_RIGHT_SUGGESTIONS: ChatEmptySuggestion[] = [
  {
    prompt:
      "Channel a flamboyant Dark Souls narrator: roast my procrastination like a boss intro.",
    lines: ["PRAISE THE SUN", "then touch grass"],
  },
  {
    prompt:
      "Give me advice in the voice of Solaire—optimistic, unhinged, slightly heroic.",
    lines: ["JOLLY COOPERATION", "or solo suffering"],
  },
  {
    prompt:
      "What would Patches say about my current priorities? Be theatrical.",
    lines: ["TRUST ME", "this hole is fine"],
  },
  {
    prompt: "Frame my next task as a soulslike boss name + one weak spot.",
    lines: ["YOU DIED", "to the dishes"],
  },
  {
    prompt:
      "Write a one-line item description for my to-do list in Dark Souls item text style.",
    lines: ["RING OF LAST RESORT", "Equip: denial +5"],
  },
  {
    prompt:
      "Motivate me like I just rested at a bonfire and the fog gate is open.",
    lines: ["HUMANITY RESTORED", "now roll"],
  },
  {
    prompt:
      "Explain my situation as if a cryptic NPC is warning me before a boss.",
    lines: ["THE ABYSS", "also your inbox"],
  },
  {
    prompt: "Give me a soulslike loading screen tip for real life.",
    lines: ["TRY TONGUE", "but hole"],
  },
  {
    prompt:
      "Roast my excuses with the energy of a red soapstone sign outside my door.",
    lines: ["INVADED", "by responsibility"],
  },
  {
    prompt:
      "What would the Crestfallen Warrior say about my week? Dramatic, bleak, funny.",
    lines: ["HEH", "another round"],
  },
];

/** Right pill: random chip from former left (cryptic) + right (soulslike) pools. */
export const EMPTY_STATE_RANDOM_PROMPT_POOL: ChatEmptySuggestion[] = [
  ...CRYPTIC_FALLBACK_LEFT_SUGGESTIONS,
  ...DARK_SOULS_RIGHT_SUGGESTIONS,
];

/** Left pill: video-game defeat / continue screen energy (preview, legacy). */
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

/** Middle pill fallback when we skip or can't run personalization (preview). */
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

/** Right pill: silly / non sequitur starters (preview). */
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
