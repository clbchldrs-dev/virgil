# Future — Dreams and nightly productivity signals (not v0.6 scope)

**Theme:** Extend **night review** or adjacent jobs to capture optional dream logs and lightweight “productivity” signals without bloating the default hosted chat prompt.

## Existing hooks

- Night review pipeline: [`lib/night-review/`](../../lib/night-review/), workspace files under [`workspace/night/`](../../workspace/night/).
- Memories with `metadata.source = "night-review"` and completion dedupe patterns.
- Goal guidance / weekly templates: [`lib/ai/goal-guidance-prompt.ts`](../../lib/ai/goal-guidance-prompt.ts).

## Acceptance criteria (when picked up)

1. **Opt-in** only (env flag or user setting); default product behavior unchanged for operators who do not enable it.
2. Separate **metadata** (e.g. `metadata.kind` or `source`) so dreams and productivity summaries are filterable in UI and API.
3. Token budget discipline: do not automatically inject long dream text into every chat turn.
4. Evaluation: spot-check hallucination risk when summarizing unstructured dream prose.

## References

- [workspace/night/README.md](../../workspace/night/README.md)
- [docs/DECISIONS.md](../DECISIONS.md)
