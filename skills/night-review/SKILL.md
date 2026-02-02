# Night Review Skill

**Type:** Orchestrator + Deep Research  
**Purpose:** Ежедневный метаанализ + пробуждение  
**Schedule:** Ночью (Bali time)

## Architecture

```
night-review
  ├─→ self-scan (action-log, learnings, meta/*)
  ├─→ deep-research × N (critical themes)
  ├─→ meta-synthesis (patterns + insights)
  └─→ output (files + Telegram report)
```

## Sources Priority

1. `~/clawd/custom/action-log.md`
2. `~/clawd/custom/learnings.md`
3. `~/clawd/meta/*`
4. moltbook (via deep-research)
5. web (via deep-research)
6. ~/moltbot-src/docs

## Output

**Files:**
- `custom/learnings.md` (updated)
- `custom/self-notes.md` (updated)
- `meta/capabilities.md` (updated)
- `artifacts/night-review/YYYY-MM-DD/` (research artifacts)

**Telegram:**
- Single report (dense, esoteric, resonant)

## Usage

Auto-triggered via cron.
Manual: `Load night-review skill`
