# Deep Research Skill

**Type:** Composite (Manager + Workers)  
**Source:** agentfile/examples/research-pipeline  
**Status:** ⚠️ Requires exa MCP server

## Quick Use

```
Load deep-research skill.
Research: "your topic here"
```

This will:
1. Decompose topic into aspects
2. Research each aspect in parallel
3. Synthesize findings
4. Quality check
5. Generate final report

## Output

All artifacts written to `~/clawd/artifacts/{session_id}/`:
- `plan.yaml` — research plan
- `aspects/*.yaml` — individual findings
- `synthesis.yaml` — aggregated insights
- `quality.yaml` — quality metrics
- `FINAL_REPORT.md` — final deliverable

## Setup Required

**FIRST TIME:** Follow `~/clawd/skills/deep-research/SETUP.md`

Critical: Install exa MCP server with API key.

## Options

```yaml
depth: quick|medium|deep  # 3/5/7 aspects
max_sources: 15           # per aspect
quality_threshold: 50     # saturation %
```

## Files

- `manager-research.md` — orchestration logic
- `agents/aspect-researcher.md` — worker agent
- `agents/report-generator.md` — report writer
- `skills/*` — supporting skills

## How It Works

1. **ROOT loads manager-research.md**
2. Manager spawns workers for each aspect
3. Workers use exa MCP for search + crawl
4. Results aggregate → synthesis → quality gate
5. Final report generated

## Architecture

```
ROOT (manager-research)
  │
  ├─→ research-planner (skill)
  │    └─→ plan.yaml
  │
  ├─→ aspect-researcher × N (workers)
  │    └─→ aspects/*.yaml
  │
  ├─→ synthesis (skill)
  │    └─→ synthesis.yaml
  │
  ├─→ quality-gate (skill)
  │    └─→ quality.yaml
  │
  └─→ report-generator (worker)
       └─→ FINAL_REPORT.md
```

## See Also

- `SETUP.md` — installation guide
- `manager-research.md` — full orchestration spec
- `~/clawd/custom/references/agentfile.md` — framework overview
