# Test Run Instructions

To test night-review without waiting for cron:

## Option 1: Manual via sessions_spawn

```
Load night-review skill from ~/clawd/skills/night-review/orchestrator.md

Execute night review process for today.
Read sources.yaml and deep-research-config.yaml for configuration.
Use deep-research skill for each critical theme.
Write artifacts to ~/clawd/artifacts/night-review/{date}/
Update custom/* and meta/* files.
Send final report to Telegram.
```

## Option 2: Trigger cron job immediately

Use cron tool:
```
cron run --id YOUR_CRON_JOB_ID
```

## Option 3: Check cron status

```
cron list
```

## What to Verify

After test run, check:

1. **Artifacts created:**
   ```bash
   ls -la ~/clawd/artifacts/night-review/$(date +%Y-%m-%d)/
   ```
   
   Should contain:
   - `themes.yaml`
   - `research-*/FINAL_REPORT.md` (one per theme)
   - `synthesis.md`
   - `telegram-report.txt`

2. **Files updated:**
   ```bash
   tail -20 ~/clawd/custom/learnings.md
   tail -20 ~/clawd/custom/self-notes.md
   tail -20 ~/clawd/meta/capabilities.md
   ```

3. **Telegram message sent** (check chat)

## Expected Runtime

- Self-scan: ~10 min
- Deep research (2-4 themes × 30min): ~60-90 min total
- Synthesis: ~15 min
- File updates: ~10 min
- Total: ~60-90 min

## Debugging

If fails, check:
1. `~/clawd/artifacts/night-review/{date}/run.log`
2. Session history for isolated session
3. Deep-research artifacts (are FINAL_REPORT.md files complete?)

## First Run Expectations

First run might take longer:
- Establishing moltbook search patterns
- Building understanding of source quality
- Calibrating synthesis depth

Subsequent runs should be faster as patterns emerge.
