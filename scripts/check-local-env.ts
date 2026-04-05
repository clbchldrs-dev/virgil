/**
 * Optional preflight for local work. Does not modify files.
 * Usage: pnpm dev:check   or   pnpm dev:check --strict
 *
 * Runtime health check (Ollama connectivity, etc.): GET /api/health
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const strict = process.argv.includes("--strict");

type Row = { key: string; ok: boolean; note: string; critical?: boolean };

const rows: Row[] = [
  {
    key: "POSTGRES_URL",
    ok: Boolean(process.env.POSTGRES_URL),
    note: "Required for login, chat history, profiles. Neon or Supabase free tier OK.",
    critical: true,
  },
  {
    key: "REDIS_URL",
    ok: Boolean(process.env.REDIS_URL),
    note: "Required for IP / rate limits. Upstash free tier OK.",
    critical: true,
  },
  {
    key: "AUTH_SECRET or NEXTAUTH_SECRET",
    ok: Boolean(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET),
    note: "Optional for `pnpm dev` only — insecure dev fallback applies. Required for production.",
  },
  {
    key: "AI_GATEWAY_API_KEY",
    ok: Boolean(process.env.AI_GATEWAY_API_KEY),
    note: "Required for hosted (non-Ollama) models locally. Not needed on Vercel if OIDC gateway is enabled.",
  },
  {
    key: "QSTASH_TOKEN",
    ok: Boolean(process.env.QSTASH_TOKEN),
    note: "Required for reminders via QStash. Upstash free tier OK.",
  },
  {
    key: "RESEND_API_KEY",
    ok: Boolean(process.env.RESEND_API_KEY),
    note: "Required for reminder and digest emails. Resend free tier OK.",
  },
  {
    key: "BLOB_READ_WRITE_TOKEN",
    ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    note: "Required for file uploads via Vercel Blob.",
  },
  {
    key: "CRON_SECRET",
    ok: Boolean(process.env.CRON_SECRET),
    note: "Protects /api/digest and /api/night-review/enqueue cron endpoints.",
  },
  {
    key: "OLLAMA_BASE_URL",
    ok: true,
    note: process.env.OLLAMA_BASE_URL
      ? `Set (${process.env.OLLAMA_BASE_URL}) — must be reachable from the Next.js process, not from the browser alone.`
      : "Optional; defaults to http://127.0.0.1:11434. The Next server must reach Ollama here. On Vercel, localhost Ollama on your laptop is not reachable unless you point OLLAMA_BASE_URL at a network-exposed host.",
  },
];

console.log("\nLocal env check (.env.local)\n");

let missingCritical = false;
for (const { key, ok, note, critical } of rows) {
  const status = ok ? "✓" : "✗";
  console.log(`  ${status} ${key}`);
  console.log(`      ${note}`);
  if (!ok && critical) {
    missingCritical = true;
  }
}

console.log(
  "\nSee AGENTS.md for full credential steps. Runtime health: GET /api/health\n"
);

if (strict && missingCritical) {
  console.error("Strict mode: fix missing critical env vars above.\n");
  process.exit(1);
}

process.exit(0);
