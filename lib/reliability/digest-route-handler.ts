type DigestOwner = {
  id: string;
  email: string;
};

type DigestMemory = {
  kind: "goal" | "opportunity" | "note" | "fact";
  content: string;
};

type DigestProposalMemory = {
  content: string;
};

type DigestResult = {
  ok: boolean;
  summary: {
    ownersScanned: number;
    ownersProcessed: number;
    ownersSkippedNoData: number;
    guestOwnersSkipped: number;
    emailSent: number;
    emailFailures: number;
    slackPosted: number;
    slackFailures: number;
    ownerFailures: number;
  };
  failures: Array<{
    ownerId: string;
    stage: "fetch" | "email" | "slack";
    message: string;
  }>;
};

export type DigestRouteDeps = {
  cronSecret: string | undefined;
  appOrigin: string;
  now: () => Date;
  getOwners: () => Promise<DigestOwner[]>;
  getRecentMemories: (input: {
    userId: string;
    since: Date;
    limit: number;
  }) => Promise<DigestMemory[]>;
  countPendingProposals: (input: {
    userId: string;
    since: Date;
  }) => Promise<number>;
  getProposalMemories: (input: {
    userId: string;
    since: Date;
    limit: number;
  }) => Promise<DigestProposalMemory[]>;
  sendEmail: (input: {
    to: string;
    subject: string;
    text: string;
  }) => Promise<void>;
  postSlack: (body: string) => Promise<{ ok: boolean; error?: string }>;
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatDigestBody(input: {
  appOrigin: string;
  memories: DigestMemory[];
  pendingProposalCount: number;
  proposalPreview: DigestProposalMemory[];
}): string {
  const grouped = {
    goals: input.memories.filter((m) => m.kind === "goal"),
    opportunities: input.memories.filter((m) => m.kind === "opportunity"),
    notes: input.memories.filter((m) => m.kind === "note"),
    facts: input.memories.filter((m) => m.kind === "fact"),
  };

  const sections: string[] = [];
  if (input.pendingProposalCount > 0) {
    const lines = input.proposalPreview.map((m) => {
      const short = compactWhitespace(m.content);
      const capped = short.length > 220 ? `${short.slice(0, 220)}…` : short;
      return `  - ${capped}`;
    });
    sections.push(
      `Pending proposals (${input.pendingProposalCount} in the last 90 days — review in app):\n${lines.join("\n")}\n\nOpen proposals: ${input.appOrigin}/proposals`
    );
  }
  if (grouped.goals.length > 0) {
    sections.push(
      `Goals:\n${grouped.goals.map((m) => `  - ${m.content}`).join("\n")}`
    );
  }
  if (grouped.opportunities.length > 0) {
    sections.push(
      `Opportunities:\n${grouped.opportunities.map((m) => `  - ${m.content}`).join("\n")}`
    );
  }
  if (grouped.notes.length > 0) {
    sections.push(
      `Notes:\n${grouped.notes.map((m) => `  - ${m.content}`).join("\n")}`
    );
  }
  if (grouped.facts.length > 0) {
    sections.push(
      `Things I learned about you:\n${grouped.facts.map((m) => `  - ${m.content}`).join("\n")}`
    );
  }

  const intro =
    input.memories.length > 0
      ? "Here's what we covered in the last 24 hours:"
      : "Daily check-in from Virgil:";
  return `${intro}\n\n${sections.join("\n\n")}\n\nHave a good day.`;
}

export async function handleDigestGet(
  request: Request,
  deps: DigestRouteDeps
): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${deps.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = deps.now();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sinceProposals = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const summary: DigestResult["summary"] = {
    ownersScanned: 0,
    ownersProcessed: 0,
    ownersSkippedNoData: 0,
    guestOwnersSkipped: 0,
    emailSent: 0,
    emailFailures: 0,
    slackPosted: 0,
    slackFailures: 0,
    ownerFailures: 0,
  };
  const failures: DigestResult["failures"] = [];

  const owners = await deps.getOwners();
  summary.ownersScanned = owners.length;

  for (const owner of owners) {
    if (owner.email.startsWith("guest-")) {
      summary.guestOwnersSkipped += 1;
      continue;
    }

    let memories: DigestMemory[] = [];
    let pendingProposalCount = 0;
    let proposalPreview: DigestProposalMemory[] = [];

    try {
      [memories, pendingProposalCount] = await Promise.all([
        deps.getRecentMemories({
          userId: owner.id,
          since,
          limit: 20,
        }),
        deps.countPendingProposals({
          userId: owner.id,
          since: sinceProposals,
        }),
      ]);
      if (pendingProposalCount > 0) {
        proposalPreview = await deps.getProposalMemories({
          userId: owner.id,
          since: sinceProposals,
          limit: 5,
        });
      }
    } catch (error) {
      summary.ownerFailures += 1;
      failures.push({
        ownerId: owner.id,
        stage: "fetch",
        message: error instanceof Error ? error.message : "unknown_error",
      });
      continue;
    }

    if (memories.length === 0 && pendingProposalCount === 0) {
      summary.ownersSkippedNoData += 1;
      continue;
    }

    summary.ownersProcessed += 1;
    const body = formatDigestBody({
      appOrigin: deps.appOrigin,
      memories,
      pendingProposalCount,
      proposalPreview,
    });

    try {
      await deps.sendEmail({
        to: owner.email,
        subject: `Your daily digest — ${now.toLocaleDateString()}`,
        text: body,
      });
      summary.emailSent += 1;
    } catch (error) {
      summary.emailFailures += 1;
      failures.push({
        ownerId: owner.id,
        stage: "email",
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }

    const slack = await deps.postSlack(body);
    if (slack.ok) {
      summary.slackPosted += 1;
    } else {
      summary.slackFailures += 1;
      failures.push({
        ownerId: owner.id,
        stage: "slack",
        message: slack.error ?? "unknown_error",
      });
    }
  }

  const result: DigestResult = {
    ok: true,
    summary,
    failures,
  };
  return Response.json(result, { status: 200 });
}
