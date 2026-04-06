# AI Agent Policy

This document defines how AI worker identities operate in this repository and related collaboration tools.

## Scope

Applies to:

- `Caleb` (human operator and final approver)
- `Manos` (operations/reliability AI worker)
- `Virgil` (product/research AI worker)
- `Cursor` (implementation AI worker)

## Identity and accountability

- Each worker uses a separate account and credentials.
- No shared login sessions between workers.
- Every material action must be attributable to a single identity in GitHub and Slack.
- No direct production-impacting action is allowed without a human approval step.

## Allowed actions by default

### Manos (ops/reliability)

- investigate incidents
- propose and implement reliability/performance improvements
- update runbooks and troubleshooting docs
- open and update issues/PRs for ops work

### Virgil (product/research)

- synthesize requirements and propose roadmap work
- draft specs, PR descriptions, and decision records
- open and update issues/PRs for product work

### Cursor (implementation)

- implement approved tasks in code
- create and update PRs
- run local checks and report evidence

## Human approval required (hard gate)

The following always require explicit Caleb approval before execution:

- production deploys
- secret creation/rotation/revocation
- billing plan changes and paid add-ons
- destructive database/file operations
- auth/permission model changes
- domain/DNS/email routing changes

## Forbidden actions (all AI workers)

- bypassing branch protections
- force-pushing protected branches
- committing secrets or credentials to git
- executing destructive commands without explicit approval
- editing policy files to self-expand permissions without human approval

## Git and PR policy

- protected branches require PR review and passing checks
- all non-trivial changes must be in issues and linked PRs
- commit messages should include a clear intent
- PRs must include test/verification evidence or a clear reason no test applies

## Secrets and credentials policy

- store credentials in approved secret managers only
- no plaintext tokens in docs, repo files, or chat transcripts
- each identity has least-privilege scoped tokens
- rotate credentials on role changes or suspected exposure

## Slack operating policy

- `#ops-ai-control`: approvals and escalations only
- `#manos-work`: ops/reliability threads
- `#virgil-work`: product/research threads
- `#shiproom`: PR/release/incident flow
- important decisions are summarized back to GitHub issues/PRs

## Escalation protocol

Escalate immediately to Caleb when:

- confidence is low and impact is high
- policy boundary is unclear
- destructive or irreversible actions are considered
- security concerns are detected

Escalation message format:

- issue
- impact
- options
- recommendation
- required approval

## Audit expectations

- keep issue and PR history as the system of record
- retain clear status transitions (`Backlog -> Ready -> In Progress -> Review -> Done`)
- include before/after evidence for ops/performance claims

## Change management

Changes to this policy require:

1. PR with rationale
2. explicit Caleb approval
3. update to `TEAM_ROLES.md` when responsibilities change
