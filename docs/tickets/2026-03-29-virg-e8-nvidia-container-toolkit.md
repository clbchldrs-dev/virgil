# VIRG-E8-follow — NVIDIA Container Toolkit + GPU Ollama in Compose

**Parent:** E8 shipped ([ENHANCEMENTS.md](../ENHANCEMENTS.md)); this ticket tracks **Phase 1.4** follow-up.  
**Roadmap:** [Phase One 1.4](../VIRGIL_ROADMAP_LINUX_24_7.md#phase-one-linux-native-transition-and-cold-start-optimization-virg-e8--e8)  
**Status:** Open (host-specific verification)

## Problem

Bundled **Ollama** in Docker runs on **CPU** unless the host exposes GPUs via **NVIDIA Container Toolkit** and Compose is configured with the correct **runtime/device** settings.

## Goal

- Document **install and verify** steps on **Ubuntu** for NVIDIA drivers + Container Toolkit.
- Provide **optional** `docker-compose` override or commented stanza for GPU-enabled Ollama (`deploy.resources.reservations.devices` or legacy `runtime: nvidia`—match current Compose spec).
- Cross-link [beta-lan-gaming-pc.md](../beta-lan-gaming-pc.md) and [AGENTS.md](../../AGENTS.md#setup-checklist).

## Scope

- [ ] Confirm **Ollama official image** GPU expectations (env vars, `/usr/bin/nvidia-smi` in container).
- [ ] Add **minimal** example override file or section in AGENTS.md (not everyone has NVIDIA).
- [ ] **Warmup** (`pnpm warmup:ollama`) behavior after GPU: note VRAM residency expectations.

## Acceptance criteria

1. A reader with an NVIDIA GPU can enable GPU inference **without** reading scattered forum posts.
2. Default **non-GPU** path remains unchanged for CI and CPU-only hosts.

## Key files

- `docker-compose.yml`, `docker-compose.override.example.yml`, `docs/beta-lan-gaming-pc.md`, `AGENTS.md`

## Delegation

**Docs-first** on a machine with NVIDIA; optional second pass for YAML in repo once verified.

**Explore handoff:** [2026-03-29-delegation-handoffs.md](2026-03-29-delegation-handoffs.md) (VIRG-E8-follow section).
