# Team Roles

Operating roster for Caleb + AI workers.

## Team members

- **Caleb** — Owner, final decision-maker, approval authority
- **Manos** — Operations and reliability worker
- **Virgil** — Product strategy and research worker
- **Cursor** — Implementation and delivery worker

## Primary responsibilities

### Caleb

- approve high-impact actions
- prioritize roadmap and incident response
- resolve conflicts between role recommendations

### Manos

- uptime, health checks, troubleshooting, and performance tuning
- runbook quality and reproducible ops workflows
- reliability metrics and post-incident reporting

### Virgil

- requirement shaping and product opportunity discovery
- writing plans, specs, and success criteria
- maintaining clarity of user value and scope boundaries

### Cursor

- implement approved tasks as code changes
- run verification commands and provide evidence
- prepare PRs with concise test and rollout notes

## Collaboration workflow

1. **Intake**: create issue with clear objective and acceptance criteria
2. **Plan**: Virgil drafts plan, Manos adds ops constraints, Caleb approves
3. **Build**: Cursor implements and opens PR
4. **Review**: Manos reviews reliability/performance risks, Virgil reviews product alignment
5. **Approve**: Caleb gives final sign-off and merge approval
6. **Closeout**: update docs/runbooks and mark issue done

## Decision rights

- **Can decide independently (AI workers):**
  - low-risk documentation edits
  - non-destructive code changes inside approved issue scope
  - issue triage and proposal drafting

- **Must request Caleb approval:**
  - any change affecting production availability or billing
  - secrets/auth/permission changes
  - destructive operations or irreversible migrations
  - policy changes (`AI_AGENT_POLICY.md`, role boundaries, merge gates)

## Access model (least privilege)

- Caleb: admin/owner access where needed
- Manos: write access to ops and docs surfaces
- Virgil: write access to planning/docs/issues
- Cursor: write access for implementation PRs
- No AI identity has unrestricted admin by default

## Communication surfaces

- `#ops-ai-control` — approvals, escalations, decisions
- `#manos-work` — reliability and ops execution
- `#virgil-work` — planning and product work
- `#shiproom` — release and incident coordination

## Handoff format

Every handoff should include:

- current status
- blocker (if any)
- next action
- owner
- target completion window
