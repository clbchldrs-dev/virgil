# MCP Baseline

This document describes the **core** versus **optional** MCP server profiles used for Virgil-related work in Cursor. It matches the reversible local baseline defined in this session's MCP baseline and Sophon core implementation plan.

## Naming (mcp.json vs Cursor UI)

In `~/.cursor/mcp.json`, keys are short names (`github`, `filesystem`, `chrome-devtools`, `MCP_DOCKER`, ...). Cursor’s MCP UI and on-disk tool descriptors may show labels prefixed with `user-` (for example, `user-github`, `user-filesystem`); those refer to the same logical servers.

## Core profile (default on)

- `github` — issues, PRs, and repository context.
- `filesystem` — workspace and allowed-path file access.
- `cursor-ide-browser` — in-editor browser automation via Cursor’s MCP plugin descriptors.
- `plugin-vercel-vercel` — Vercel dashboard and deployment context; **requires authentication** in Cursor (complete sign-in in-session before relying on these tools).

## Optional profile (off by default in local config)

- `chrome-devtools` — deeper browser and performance diagnostics.
- `MCP_DOCKER` — Docker MCP gateway workflows.
- `plugin-snyk-secure-development-Snyk` — security scanning and dependency health sessions.

**Re-enable when needed:** In `mcp.json`, set `disabled` to `false` or remove the `disabled` field for that server, then reload MCP in Cursor (or restart) so the client picks up the change.

## Why this split

- **Reduce overlap and noise** — multiple browser-capable MCP servers can duplicate actions and crowd tool selection.
- **Keep a focused baseline** — daily coding stays on GitHub, filesystem, in-Cursor browser, and Vercel where authenticated.
- **Preserve specialized tools** — Chrome DevTools, Docker gateway, and Snyk stay documented and can be enabled when a task explicitly needs them.

## Rollback

Restore the pre-baseline MCP configuration from the dated backup:

```bash
cp "$HOME/.cursor/mcp.before-2026-04-05.json" "$HOME/.cursor/mcp.json"
```

Restart or reload MCP in Cursor if the app does not pick up the file change immediately.
