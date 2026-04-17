# Future — Chat and shell UI refinements (ongoing)

**Theme:** Incremental polish of [`app/(chat)/`](../../app/(chat)/) and shared components per [AGENTS.md](../../AGENTS.md) (accessibility, shadcn/Tailwind consistency). No drive-by full redesigns.

## Examples (backlog ideas)

- Check-in shortcuts: deep link or starter message for weekly format (`/weekly` copy in goal guidance).
- Surface night-review / digest status for the signed-in owner (read-only health, not new cron).
- Mobile layout tweaks for model picker and tool approval rows.

## Principles

- Match existing design tokens and component patterns.
- Each PR should tie to a concrete UX defect or ticket.
- Run accessibility checks (labels, focus, contrast) on touched surfaces.

## References

- [docs/VIRGIL_PERSONA.md](../VIRGIL_PERSONA.md) — voice SSOT for any user-facing copy changes.
