# Deep Research Skill — Ready to Use ✅

**Status:** Полностью настроен с Exa API

## Quick Test

```bash
# Test search
~/clawd/skills/deep-research/scripts/exa-search.sh "AI agents" 3

# Test crawl
~/clawd/skills/deep-research/scripts/exa-crawl.sh "https://github.com"
```

## Use in Chat

```
Load manager-research skill from ~/clawd/skills/deep-research/manager-research.md

Research topic: "AI agent orchestration patterns"
Session ID: research_20260131_test

Execute Phase 1: Planning
```

## What It Does

1. **Planning** — разбивает topic на 3-7 aspects
2. **Research** — параллельно исследует каждый aspect через Exa
3. **Synthesis** — агрегирует findings
4. **Quality Gate** — проверяет thresholds
5. **Report** — генерирует финальный отчёт

## Output Location

```
~/clawd/artifacts/research_{date}_{id}/
├── plan.yaml           # Decomposed aspects
├── aspects/
│   ├── aspect_1.yaml   # Findings per aspect
│   ├── aspect_2.yaml
│   └── ...
├── synthesis.yaml      # Aggregated insights
├── quality.yaml        # Quality metrics
└── FINAL_REPORT.md     # Final deliverable
```

## Files

- `manager-research.md` — orchestration logic
- `agents/aspect-researcher.md` — worker (uses Exa)
- `agents/report-generator.md` — report writer
- `skills/*` — supporting skills (9 files)
- `scripts/exa-*.sh` — Exa API wrappers

## API

**Exa API key:** `${EXA_API_KEY}`
- Embedded in scripts
- No additional setup needed
- Rate limits: check dashboard.exa.ai

## Customization

Edit `research-planner.md`:
```yaml
depth: quick   # 3 aspects
depth: medium  # 5 aspects (default)
depth: deep    # 7 aspects
```

Edit `quality-gate.md`:
```yaml
thresholds:
  saturation: 50     # % completeness
  diversity: 0.5     # source variety
  tier_quality: 0.7  # avg tier weight
```

## Next Steps

1. ✅ Setup complete
2. Run test research on simple topic
3. Review generated artifacts
4. Adjust thresholds if needed

---

**Ready to use!** No additional setup required.
