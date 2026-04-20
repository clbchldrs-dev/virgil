"use client";

import useSWR from "swr";
import type { DeploymentCapabilities } from "@/lib/deployment/capabilities";
import { cn } from "@/lib/utils";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

async function fetchCapabilities(url: string): Promise<DeploymentCapabilities> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load deployment capabilities (${res.status})`);
  }
  return res.json() as Promise<DeploymentCapabilities>;
}

export function DeploymentCapabilitiesPanel({
  className,
}: {
  className?: string;
}) {
  const { data, error, isLoading } = useSWR(
    `${BASE_PATH}/api/deployment/capabilities`,
    fetchCapabilities,
    { revalidateOnFocus: true, dedupingInterval: 120_000 }
  );

  if (isLoading) {
    return (
      <div
        className={cn("text-sm text-muted-foreground", className)}
        data-testid="deployment-capabilities-loading"
      >
        Loading deployment information…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={cn("text-sm text-destructive", className)}
        data-testid="deployment-capabilities-error"
      >
        Could not load deployment information. Try again later.
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col gap-8 text-sm", className)}
      data-testid="deployment-capabilities-panel"
    >
      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Environment</h2>
        <p className="text-muted-foreground">
          This server is running in{" "}
          <span className="font-mono text-foreground">{data.environment}</span>{" "}
          mode. Snapshot time:{" "}
          <span className="font-mono text-xs text-foreground/80">
            {data.generatedAt}
          </span>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">Inference</h2>
        <ul className="space-y-3 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Hosted (cloud):</span>{" "}
            {data.hostedInference.available ? "Available" : "Not configured"} —{" "}
            {data.hostedInference.detail}
          </li>
          <li>
            <span className="font-medium text-foreground">Local (Ollama):</span>{" "}
            {data.localInference.available ? "Available" : "Not on this host"} —{" "}
            {data.localInference.detail}
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-foreground">Companion agent tools</h2>
        <p className="text-muted-foreground">
          Tools the agent may use on this deployment (availability matches the
          server tool registry).
        </p>
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {data.agentTools.map((t) => (
            <li
              className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
              key={t.id}
            >
              <span className="font-mono text-xs text-foreground">{t.id}</span>
              <span className="text-muted-foreground sm:max-w-[min(100%,28rem)] sm:text-right">
                {t.label}
                {t.detail ? (
                  <>
                    {" "}
                    <span
                      className={
                        t.available
                          ? "text-muted-foreground"
                          : "text-amber-600 dark:text-amber-500"
                      }
                    >
                      ({t.detail})
                    </span>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 border-t border-border/50 pt-6">
        <h2 className="font-medium text-foreground">Documentation</h2>
        <p className="text-muted-foreground">
          For setup, env sync between laptop and Vercel, and local models, see
          the project docs (e.g. AGENTS.md and docs/vercel-env-setup.md in the
          repository).
        </p>
      </section>
    </div>
  );
}
