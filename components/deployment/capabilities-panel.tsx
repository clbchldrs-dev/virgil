"use client";

import useSWR from "swr";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import { buildDeploymentDiagnosticsPayload } from "@/lib/deployment/build-deployment-diagnostics-payload";
import type { DeploymentCapabilities } from "@/lib/deployment/capabilities";
import { cn } from "@/lib/utils";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const CAPABILITIES_URL = `${BASE_PATH}/api/deployment/capabilities`;
const DELEGATION_HEALTH_URL = `${BASE_PATH}/api/delegation/health`;

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
  const { data, error, isLoading, mutate, isValidating } = useSWR(
    CAPABILITIES_URL,
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

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">
          Agent tasks and gateway planner
        </h2>
        <p className="text-muted-foreground">
          Background triage and optional multi-stage planner are env-gated — no
          secrets shown here.
        </p>
        <ul className="space-y-1 text-muted-foreground text-xs">
          <li>
            <span className="font-medium text-foreground">Triage worker:</span>{" "}
            {data.agentTaskOrchestration.triageEnabled ? "enabled" : "disabled"}{" "}
            (<code className="text-[0.65rem]">AGENT_TASK_TRIAGE_ENABLED</code>)
          </li>
          <li>
            <span className="font-medium text-foreground">
              Multi-agent planner:
            </span>{" "}
            {data.agentTaskOrchestration.multiAgentPlannerEnabled
              ? `on${
                  data.agentTaskOrchestration.plannerStageCount == null
                    ? ""
                    : ` (${data.agentTaskOrchestration.plannerStageCount} stage${data.agentTaskOrchestration.plannerStageCount === 1 ? "" : "s"})`
                }`
              : "off"}
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-foreground">Companion agent tools</h2>
        <p className="text-muted-foreground">
          In-process tools: they run on this server (filesystem, shell, Jira,
          etc.). Delegated work uses a separate bridge — see{" "}
          <span className="font-medium text-foreground">
            Delegation (Hermes / OpenClaw)
          </span>{" "}
          below when configured.
        </p>
        <p className="text-muted-foreground">
          Availability matches the server tool registry.
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

      {data.delegation ? (
        <section
          className="space-y-3 border-t border-border/50 pt-6"
          data-testid="deployment-delegation-block"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-medium text-foreground">
              Delegation (Hermes / OpenClaw)
            </h2>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Button
                className="shrink-0"
                data-testid="deployment-copy-diagnostics"
                onClick={async () => {
                  try {
                    let delegationHealth: unknown = null;
                    try {
                      const healthRes = await fetch(DELEGATION_HEALTH_URL);
                      delegationHealth = healthRes.ok
                        ? await healthRes.json()
                        : {
                            ok: false,
                            httpStatus: healthRes.status,
                          };
                    } catch {
                      delegationHealth = { ok: false, error: "fetch_failed" };
                    }
                    const payload = buildDeploymentDiagnosticsPayload({
                      capabilities: data,
                      delegationHealth,
                    });
                    await navigator.clipboard.writeText(
                      JSON.stringify(payload, null, 2)
                    );
                    toast({
                      type: "success",
                      description: "Diagnostics JSON copied to clipboard.",
                    });
                  } catch {
                    toast({
                      type: "error",
                      description:
                        "Could not copy diagnostics. Check clipboard permissions or try again.",
                    });
                  }
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Copy diagnostics JSON
              </Button>
              {data.delegation.configured ? (
                <Button
                  className="shrink-0"
                  data-testid="deployment-run-probe"
                  disabled={isValidating}
                  onClick={async () => {
                    try {
                      // Ping health first so operator sees fresh route-level status.
                      await fetch(DELEGATION_HEALTH_URL);
                      await mutate(
                        () =>
                          fetchCapabilities(`${CAPABILITIES_URL}?refresh=1`),
                        { revalidate: false }
                      );
                      toast({
                        type: "success",
                        description: "Delegation probe refreshed.",
                      });
                    } catch {
                      toast({
                        type: "error",
                        description:
                          "Could not run delegation probe. Check gateway status and try again.",
                      });
                    }
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Run probe now
                </Button>
              ) : null}
              {data.delegation.configured ? (
                <Button
                  className="shrink-0"
                  data-testid="deployment-delegation-refresh"
                  disabled={isValidating}
                  onClick={async () => {
                    try {
                      await mutate(
                        () =>
                          fetchCapabilities(`${CAPABILITIES_URL}?refresh=1`),
                        { revalidate: false }
                      );
                      toast({
                        type: "success",
                        description: "Delegation snapshot refreshed.",
                      });
                    } catch {
                      toast({
                        type: "error",
                        description:
                          "Could not refresh delegation snapshot. Try again or check that you are signed in.",
                      });
                    }
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isValidating ? "Refreshing…" : "Refresh skills snapshot"}
                </Button>
              ) : null}
            </div>
          </div>
          {data.delegation.configured ? (
            <div className="space-y-2">
              <h3 className="font-medium text-foreground text-sm">
                Chat tools (bridge)
              </h3>
              <p className="text-muted-foreground text-xs">
                Registered on hosted chat when delegation is configured — not
                listed in the in-process table above.
              </p>
              <ul
                className="divide-y divide-border/60 rounded-lg border border-border/60"
                data-testid="deployment-delegation-chat-tools"
              >
                <li className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <span className="font-mono text-xs text-foreground">
                    delegateTask
                  </span>
                  <span className="text-muted-foreground sm:max-w-[min(100%,28rem)] sm:text-right">
                    Queue work to the gateway (skill + description + params).
                  </span>
                </li>
                <li className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <span className="font-mono text-xs text-foreground">
                    approveDelegationIntent
                  </span>
                  <span className="text-muted-foreground sm:max-w-[min(100%,28rem)] sm:text-right">
                    Approve a pending intent (
                    <span className="font-mono text-[0.65rem]">
                      approveOpenClawIntent
                    </span>{" "}
                    alias).
                  </span>
                </li>
                <li className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <span className="font-mono text-xs text-foreground">
                    embedViaDelegation
                  </span>
                  <span
                    className={
                      data.delegation.embedToolEnabled
                        ? "text-muted-foreground sm:max-w-[min(100%,28rem)] sm:text-right"
                        : "text-amber-600 sm:max-w-[min(100%,28rem)] sm:text-right dark:text-amber-500"
                    }
                  >
                    {data.delegation.embedToolEnabled
                      ? "Embedding via gateway (e.g. wiki-embed on LAN)."
                      : "Not registered — VIRGIL_DELEGATION_EMBED_ENABLED is 0/false/off."}
                  </span>
                </li>
              </ul>
            </div>
          ) : null}
          <p className="text-muted-foreground">
            Out-of-app execution via the configured gateway.{" "}
            <span className="font-medium text-foreground">
              {data.delegation.configured ? "Configured" : "Not configured"}
            </span>
            {data.delegation.configured ? (
              <>
                {" "}
                — primary backend{" "}
                <span className="font-mono text-foreground">
                  {data.delegation.primaryBackend}
                </span>
                {data.delegation.explicitBackendEnv ? (
                  <span className="text-muted-foreground">
                    {" "}
                    (explicit{" "}
                    <code className="text-xs">VIRGIL_DELEGATION_BACKEND</code>)
                  </span>
                ) : null}
                . Failover: {data.delegation.failoverEnabled ? "on" : "off"}.
                {data.delegation.pollPrimaryActive ? (
                  <> Poll-primary delivery is active (see docs).</>
                ) : null}
              </>
            ) : null}
          </p>
          {data.delegation.configured ? (
            <p className="text-muted-foreground">
              Reachability:{" "}
              <span className="font-medium text-foreground">
                {data.delegation.reachable === null
                  ? "unknown"
                  : data.delegation.reachable
                    ? "gateway responded"
                    : "gateway unreachable"}
              </span>
              . Intents use the primary backend when it is up; failover may send
              to the secondary when enabled — there is no per-message backend
              switch in Virgil.
            </p>
          ) : null}
          {data.delegation.configured ? (
            <p className="text-muted-foreground text-xs">
              Diagnostics: reachability{" "}
              <span className="font-mono">
                {data.delegation.diagnostics.reachabilityCode}
              </span>
              , skills{" "}
              <span className="font-mono">
                {data.delegation.diagnostics.skillsCode}
              </span>
              , primary reachable{" "}
              <span className="font-mono">
                {data.delegation.diagnostics.primaryReachable ? "yes" : "no"}
              </span>
              {data.delegation.diagnostics.secondaryReachable ===
              null ? null : (
                <>
                  , secondary reachable{" "}
                  <span className="font-mono">
                    {data.delegation.diagnostics.secondaryReachable
                      ? "yes"
                      : "no"}
                  </span>
                </>
              )}
              , skill count{" "}
              <span className="font-mono">
                {data.delegation.diagnostics.skillsCount}
              </span>
              .
            </p>
          ) : null}
          {data.delegation.configured && data.delegation.delegationProbe ? (
            <div
              className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs"
              data-testid="deployment-delegation-probe"
            >
              <p className="text-muted-foreground">
                Delegation probe:{" "}
                <span className="font-mono text-foreground">
                  {data.delegation.delegationProbe.routing.resolvedSkill}
                </span>{" "}
                via{" "}
                <span className="font-mono text-foreground">
                  {data.delegation.delegationProbe.routing.strategy}
                </span>
                .
              </p>
              <p className="text-muted-foreground">
                Readiness:{" "}
                <span className="font-mono text-foreground">
                  {data.delegation.delegationProbe.readiness.recommendation}
                </span>{" "}
                (score{" "}
                <span className="font-mono text-foreground">
                  {data.delegation.delegationProbe.readiness.score.toFixed(2)}
                </span>
                ). Preflight:{" "}
                <span className="font-mono text-foreground">
                  {data.delegation.delegationProbe.preflight.ok
                    ? "pass"
                    : "blocked"}
                </span>
                .
              </p>
              {data.delegation.delegationProbe.readiness.reasons.length > 0 ? (
                <p className="text-muted-foreground">
                  Why: {data.delegation.delegationProbe.readiness.reasons[0]}.
                </p>
              ) : null}
            </div>
          ) : null}
          {data.delegation.hermesEnvPresent ||
          data.delegation.openclawEnvPresent ? (
            <p className="text-muted-foreground text-xs">
              Env detected: Hermes{" "}
              {data.delegation.hermesEnvPresent ? "yes" : "no"}, OpenClaw{" "}
              {data.delegation.openclawEnvPresent ? "yes" : "no"}.
            </p>
          ) : null}
          {data.delegation.configured ? (
            <>
              <p className="text-muted-foreground text-xs">
                Skill contract:{" "}
                <span className="font-mono">
                  {data.delegation.skillsContractVersion}
                </span>{" "}
                (
                <span className="font-mono">
                  {data.delegation.skillsContractStatus}
                </span>
                ).
              </p>
              {data.delegation.skillsStatus === "ok" ? (
                <p className="text-muted-foreground text-xs">
                  Skills snapshot:{" "}
                  <span className="font-mono">
                    {data.delegation.skillsFetchedAt}
                  </span>
                </p>
              ) : (
                <p
                  className="text-amber-700 text-sm dark:text-amber-400"
                  data-testid="deployment-delegation-skills-stale"
                >
                  Skill list:{" "}
                  {data.delegation.skillsStatus === "cached"
                    ? "Showing last successful fetch — gateway list may be stale."
                    : "Could not load live skill ids from the gateway."}{" "}
                  <span className="font-mono text-xs">
                    {data.delegation.skillsFetchedAt}
                  </span>
                </p>
              )}
              {data.delegation.skills.length > 0 ? (
                <ul
                  className="divide-y divide-border/60 rounded-lg border border-border/60 font-mono text-xs"
                  data-testid="deployment-delegation-skill-list"
                >
                  {data.delegation.skillDescriptors
                    .slice(0, 48)
                    .map((skill) => (
                      <li
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5"
                        key={skill.id}
                      >
                        <span className="text-foreground">{skill.id}</span>
                        <span className="text-muted-foreground">
                          {skill.riskLevel} risk ·{" "}
                          {skill.sourceBackends.join("+")}
                        </span>
                      </li>
                    ))}
                  {data.delegation.skills.length > 48 ? (
                    <li className="px-3 py-1.5 text-muted-foreground">
                      +{data.delegation.skills.length - 48} more
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No skill ids returned (gateway list empty or unreachable).
                </p>
              )}
            </>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Operator setup: see{" "}
            <code className="text-[0.7rem]">docs/openclaw-bridge.md</code> and{" "}
            <code className="text-[0.7rem]">
              docs/virgil-manos-delegation.md
            </code>
            .
          </p>
        </section>
      ) : null}

      <section className="space-y-2 border-t border-border/50 pt-6">
        <h2 className="font-medium text-foreground">Documentation</h2>
        <p className="text-muted-foreground">
          For setup, env sync between laptop and Vercel, local models, and
          delegation bridges, see the project docs (e.g. AGENTS.md,
          docs/openclaw-bridge.md, docs/vercel-env-setup.md).
        </p>
      </section>
    </div>
  );
}
