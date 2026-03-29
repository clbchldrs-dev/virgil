/**
 * Optional preflight for local work. Does not modify files.
 * Usage: pnpm dev:check   or   pnpm dev:check --strict
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const strict = process.argv.includes("--strict");

type Row = { key: string; ok: boolean; note: string };

const rows: Row[] = [
  {
    key: "POSTGRES_URL",
    ok: Boolean(process.env.POSTGRES_URL),
    note: "Required for login, chat history, profiles. Neon free tier OK.",
  },
  {
    key: "REDIS_URL",
    ok: Boolean(process.env.REDIS_URL),
    note: "Required for IP / rate limits. Upstash free tier OK.",
  },
  {
    key: "AUTH_SECRET or NEXTAUTH_SECRET",
    ok: Boolean(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET),
    note: "Optional for `pnpm dev` only — insecure dev fallback applies. Required for `next build` / production.",
  },
  {
    key: "AI_GATEWAY_API_KEY",
    ok: Boolean(process.env.AI_GATEWAY_API_KEY),
    note: "Required for hosted (non-Ollama) models locally. Not needed on Vercel if OIDC gateway is enabled.",
  },
  {
    key: "OLLAMA_BASE_URL",
    ok: true,
    note: process.env.OLLAMA_BASE_URL
      ? `Set (${process.env.OLLAMA_BASE_URL})`
      : "Optional; defaults to http://127.0.0.1:11434 for local Ollama.",
  },
];

console.log("\nLocal env check (.env.local)\n");

let missingCritical = false;
for (const { key, ok, note } of rows) {
  const status = ok ? "✓" : "✗";
  console.log(`  ${status} ${key}`);
  console.log(`      ${note}`);
  if (!ok && (key === "POSTGRES_URL" || key === "REDIS_URL")) {
    missingCritical = true;
  }
}

console.log(
  "\nSee AGENTS.md for full credential steps. Auth: lib/auth-secret.ts (dev fallback).\n"
);

if (strict && missingCritical) {
  console.error("Strict mode: fix missing POSTGRES_URL / REDIS_URL above.\n");
  process.exit(1);
}

process.exit(0);
