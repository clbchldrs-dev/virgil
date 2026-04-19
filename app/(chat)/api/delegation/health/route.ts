import { auth } from "@/app/(auth)/auth";
import {
  countDelegationBacklogForUser,
  getPendingConfirmationsForUser,
} from "@/lib/db/queries";
import {
  delegationPing,
  getDelegationProvider,
  isDelegationConfigured,
  isDelegationFailoverEnabled,
} from "@/lib/integrations/delegation-provider";
import {
  listHermesSkillNames,
  pingHermes,
} from "@/lib/integrations/hermes-client";
import { isHermesConfigured } from "@/lib/integrations/hermes-config";
import {
  getCachedOpenClawSkillNames,
  pingOpenClaw,
} from "@/lib/integrations/openclaw-client";
import { isOpenClawConfigured } from "@/lib/integrations/openclaw-config";
import {
  isDelegationPollPrimaryActive,
  isDelegationPollPrimaryEnabled,
} from "@/lib/integrations/delegation-poll-config";

export const maxDuration = 10;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const provider = getDelegationProvider();
  const configured = isDelegationConfigured();
  const backendLabel = provider.backend === "hermes" ? "Hermes" : "OpenClaw";

  const hermesConfigured = isHermesConfigured();
  const openClawConfigured = isOpenClawConfigured();

  const [
    pendingConfirmations,
    queuedBacklog,
    delegationOnline,
    delegationSkillNames,
    hermesOnline,
    openClawOnline,
    hermesSkillNames,
    openClawSkillNames,
  ] = await Promise.all([
    getPendingConfirmationsForUser(userId),
    countDelegationBacklogForUser(userId),
    configured ? delegationPing() : Promise.resolve(false),
    configured ? provider.listSkillNames() : Promise.resolve([]),
    hermesConfigured ? pingHermes() : Promise.resolve(false),
    openClawConfigured ? pingOpenClaw() : Promise.resolve(false),
    hermesConfigured ? listHermesSkillNames() : Promise.resolve([]),
    openClawConfigured ? getCachedOpenClawSkillNames() : Promise.resolve([]),
  ]);

  return Response.json({
    timestamp: new Date().toISOString(),
    backend: provider.backend,
    failoverEnabled: isDelegationFailoverEnabled(),
    pollPrimary: {
      enabled: isDelegationPollPrimaryEnabled(),
      active: isDelegationPollPrimaryActive(),
      claimPath: "/api/delegation/worker/claim",
      completePath: "/api/delegation/worker/complete",
    },
    configured,
    delegationOnline,
    skillCount: delegationSkillNames.length,
    skillsPreview: delegationSkillNames.slice(0, 25),
    queuedBacklog,
    pendingConfirmations: pendingConfirmations.length,
    offlineMessage:
      !delegationOnline && queuedBacklog > 0
        ? `${backendLabel} is offline - ${String(queuedBacklog)} task(s) queued.`
        : null,
    probes: {
      hermes: {
        configured: hermesConfigured,
        online: hermesOnline,
        skillCount: hermesSkillNames.length,
      },
      openclaw: {
        configured: openClawConfigured,
        online: openClawOnline,
        skillCount: openClawSkillNames.length,
      },
    },
  });
}
