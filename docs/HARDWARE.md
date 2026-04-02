# Virgil Hardware

## Current (April 2026)

**Primary host:** Mac Mini M4 Pro (Late 2024)
- Chip: M4 Pro, 12-core CPU, 16-core GPU, 16-core Neural Engine
- Memory: 48GB unified LPDDR5X, 273 GB/s bandwidth
- Storage: 2TB SSD
- Power: ~30W inference, ~5W idle
- Role: Python backend + local inference (Ollama)

**Frontend:** Vercel (Next.js app from clbchldrs-dev/virgil repo)

**Local models:**
- Fast tier: qwen2.5:14b (~9GB, ~30 tok/s) — default for most operations
- Heavy tier: qwen2.5:32b (~20GB, ~15-20 tok/s) — complex local reasoning
- Free headroom: ~15GB for OS, KV cache, context, Python backend

**Cloud inference:** Gemini API (escalation only, ~$25-30/month)

## Planned (August 2026+)

**Heavy inference:** tiiny.ai Pocket Lab
- Memory: 80GB LPDDR5X
- NPU: 190 TOPS
- Role: Heavy local tier (70B+ models)
- Mac Mini continues as services host + fast tier

## Retired

- 2012 Ubuntu box (DDR3, GTX 1070) — replaced by Mac Mini
