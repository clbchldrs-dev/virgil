/**
 * virgil:start — one-command local dev orchestrator.
 *
 * Spawns everything a Virgil developer typically needs in a single terminal
 * with color-prefixed output and clean shutdown:
 *
 *   [app]    `next dev` (always)
 *   [tunnel] `scripts/openclaw-tunnel.sh` (iff OPENCLAW_SSH_HOST is set)
 *   [worker] `scripts/delegation-poll-worker.ts` (iff the worker is pointed at
 *                a remote/hosted origin, i.e. NOT http://127.0.0.1:* / localhost)
 *
 * Ctrl+C (SIGINT) sends SIGTERM to all children, waits up to 5s, then SIGKILL.
 * Exit code: worst non-zero child exit, or 0 if all children exited cleanly.
 *
 * Tunnel / worker are restarted with exponential backoff (up to 3 attempts in
 * 60s); if they crash-loop past that, the orchestrator prints a diagnostic and
 * leaves them stopped while the app keeps running.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

type ServiceId = "app" | "tunnel" | "worker";

type ServiceSpec = {
  id: ServiceId;
  command: string;
  args: string[];
  color: (s: string) => string;
  restartable: boolean;
  startMessage?: string;
  env?: NodeJS.ProcessEnv;
};

const COLORS = {
  reset: "\u001B[0m",
  cyan: (s: string) => `\u001B[36m${s}${COLORS.reset}`,
  yellow: (s: string) => `\u001B[33m${s}${COLORS.reset}`,
  magenta: (s: string) => `\u001B[35m${s}${COLORS.reset}`,
  red: (s: string) => `\u001B[31m${s}${COLORS.reset}`,
  gray: (s: string) => `\u001B[90m${s}${COLORS.reset}`,
  green: (s: string) => `\u001B[32m${s}${COLORS.reset}`,
};

function prefix(id: ServiceId, color: (s: string) => string): string {
  const label = `[${id}]`.padEnd(9, " ");
  return color(label);
}

function writePrefixed(
  id: ServiceId,
  color: (s: string) => string,
  stream: NodeJS.WritableStream,
  chunk: Buffer | string
) {
  const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") {
    lines.pop();
  }
  const pfx = prefix(id, color);
  for (const line of lines) {
    stream.write(`${pfx} ${line}\n`);
  }
}

function isLocalOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") // close enough for dev; we just don't want Vercel origins treated as local
    );
  } catch {
    return false;
  }
}

function buildServiceSpecs(): ServiceSpec[] {
  const specs: ServiceSpec[] = [];

  specs.push({
    id: "app",
    command: "pnpm",
    args: ["dev"],
    color: COLORS.cyan,
    restartable: false,
    startMessage:
      "Next.js dev server (in-app Hermes bridge at /api/hermes-bridge/*)",
  });

  const tunnelHost = process.env.OPENCLAW_SSH_HOST?.trim();
  const tunnelScript = resolve(process.cwd(), "scripts/openclaw-tunnel.sh");
  if (tunnelHost && existsSync(tunnelScript)) {
    specs.push({
      id: "tunnel",
      command: "bash",
      args: [tunnelScript],
      color: COLORS.yellow,
      restartable: true,
      startMessage: `SSH tunnel to ${tunnelHost}`,
    });
  }

  const workerBase =
    process.env.VIRGIL_DELEGATION_WORKER_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  const workerSecret =
    process.env.VIRGIL_DELEGATION_WORKER_SECRET?.trim() ||
    process.env.HERMES_SHARED_SECRET?.trim() ||
    "";
  const workerShouldRun =
    Boolean(workerBase) && Boolean(workerSecret) && !isLocalOrigin(workerBase);
  if (workerShouldRun) {
    specs.push({
      id: "worker",
      command: "pnpm",
      args: ["delegation:poll-worker"],
      color: COLORS.magenta,
      restartable: true,
      startMessage: `Delegation poll worker → ${workerBase}`,
    });
  }

  return specs;
}

type RunningService = {
  spec: ServiceSpec;
  child: ChildProcess | null;
  restartAttempts: { at: number }[];
  stopped: boolean;
  lastExit: number | null;
};

const services: RunningService[] = [];
let shuttingDown = false;

function spawnService(svc: RunningService) {
  const { spec } = svc;
  if (spec.startMessage) {
    writePrefixed(
      spec.id,
      spec.color,
      process.stderr,
      `starting: ${spec.startMessage}`
    );
  }
  const child = spawn(spec.command, spec.args, {
    env: { ...process.env, ...spec.env, FORCE_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  svc.child = child;

  child.stdout?.on("data", (chunk) =>
    writePrefixed(spec.id, spec.color, process.stdout, chunk)
  );
  child.stderr?.on("data", (chunk) =>
    writePrefixed(spec.id, spec.color, process.stderr, chunk)
  );

  child.on("exit", (code, signal) => {
    svc.lastExit = code ?? (signal ? 128 : 0);
    const reason = signal ? `signal ${signal}` : `exit ${String(code)}`;
    writePrefixed(
      spec.id,
      code && code !== 0 ? COLORS.red : COLORS.gray,
      process.stderr,
      `stopped (${reason})`
    );
    if (shuttingDown) {
      return;
    }
    if (!spec.restartable) {
      // App crashing is fatal — the orchestrator shuts everything else down.
      if (spec.id === "app") {
        writePrefixed(
          "app",
          COLORS.red,
          process.stderr,
          "Next.js dev exited; stopping everything."
        );
        shutdown(code ?? 1);
      }
      return;
    }
    maybeRestart(svc);
  });
}

function maybeRestart(svc: RunningService) {
  const now = Date.now();
  svc.restartAttempts = svc.restartAttempts.filter((a) => now - a.at < 60_000);
  if (svc.restartAttempts.length >= 3) {
    writePrefixed(
      svc.spec.id,
      COLORS.red,
      process.stderr,
      "crash-looping (3 restarts in 60s). Leaving stopped; fix the issue and rerun `pnpm virgil:start`."
    );
    return;
  }
  const delay = Math.min(15_000, 2 ** svc.restartAttempts.length * 1000);
  svc.restartAttempts.push({ at: now });
  writePrefixed(
    svc.spec.id,
    svc.spec.color,
    process.stderr,
    `restarting in ${String(delay)}ms (attempt ${String(svc.restartAttempts.length)}/3)…`
  );
  setTimeout(() => {
    if (shuttingDown) {
      return;
    }
    spawnService(svc);
  }, delay);
}

function startAll() {
  const specs = buildServiceSpecs();
  for (const spec of specs) {
    services.push({
      spec,
      child: null,
      restartAttempts: [],
      stopped: false,
      lastExit: null,
    });
  }
  for (const svc of services) {
    spawnService(svc);
  }

  const started = specs.map((s) => `[${s.id}]`).join(" ");
  process.stderr.write(
    `${COLORS.green("virgil:start")} running: ${started}. Ctrl+C to stop.\n`
  );
  if (!specs.find((s) => s.id === "tunnel")) {
    process.stderr.write(
      `${COLORS.gray("virgil:start")} OPENCLAW_SSH_HOST not set — no SSH tunnel spawned. Set it (e.g. caleb@192.168.1.81) if OpenClaw runs on a LAN host.\n`
    );
  }
  if (!specs.find((s) => s.id === "worker")) {
    process.stderr.write(
      `${COLORS.gray("virgil:start")} Delegation poll worker skipped — VIRGIL_DELEGATION_WORKER_BASE_URL is unset or points at localhost.\n`
    );
  }
}

function killChild(child: ChildProcess, signal: NodeJS.Signals): boolean {
  if (child.exitCode !== null || child.signalCode !== null) {
    return false;
  }
  try {
    return child.kill(signal);
  } catch {
    return false;
  }
}

let shutdownResolve: ((code: number) => void) | null = null;
const shutdownPromise = new Promise<number>((res) => {
  shutdownResolve = res;
});

function shutdown(code: number) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.stderr.write(
    `${COLORS.gray("virgil:start")} shutting down (${String(code)})…\n`
  );
  for (const svc of services) {
    if (svc.child) {
      killChild(svc.child, "SIGTERM");
    }
  }
  const forceKillAt = Date.now() + 5000;
  const interval = setInterval(() => {
    const pending = services.filter(
      (s) => s.child && s.child.exitCode === null && s.child.signalCode === null
    );
    if (pending.length === 0) {
      clearInterval(interval);
      const worst = services.reduce(
        (acc, s) => Math.max(acc, s.lastExit ?? 0),
        0
      );
      if (shutdownResolve) {
        shutdownResolve(code === 0 ? worst : code);
      }
      return;
    }
    if (Date.now() >= forceKillAt) {
      for (const s of pending) {
        if (s.child) {
          writePrefixed(
            s.spec.id,
            COLORS.red,
            process.stderr,
            "SIGKILL (did not exit within 5s)"
          );
          killChild(s.child, "SIGKILL");
        }
      }
    }
  }, 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

startAll();

shutdownPromise.then((code) => {
  process.exit(code);
});
