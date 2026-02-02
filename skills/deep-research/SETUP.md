# Deep Research Skill Setup

**Source:** https://github.com/bluzir/agentfile/tree/master/examples/research-pipeline  
**Installed:** 2026-01-31

## Что это

Multi-phase research pipeline с параллельными worker agents, quality gates, и structured output.

```
Planning → Research ×N → Synthesis → Quality Gate → Report
   ↓          ↓            ↓             ↓            ↓
plan.yaml  aspects/   synthesis.yaml quality.yaml  FINAL_REPORT.md
```

## Структура

```
~/clawd/skills/deep-research/
├── manager-research.md          # Manager skill (orchestration)
├── agents/
│   ├── aspect-researcher.md     # Worker agent для одного aspect
│   └── report-generator.md      # Генератор финального отчёта
└── skills/
    ├── research-planner.md      # Декомпозиция темы на aspects
    ├── synthesis.md             # Агрегация findings
    ├── quality-gate.md          # Проверка качества
    ├── grounding-protocol.md    # Anti-hallucination
    ├── search-safeguard.md      # Retry logic для поиска
    ├── io-yaml-safe.md          # Safe YAML I/O
    ├── silence-protocol.md      # No verbose output
    └── anti-cringe.md           # No AI slop phrases
```

## Exa API Integration

**aspect-researcher.md использует прямой Exa API через shell scripts:**
- `exa-search.sh` — web search
- `exa-crawl.sh` — page crawling

### Setup

✅ **Уже настроено!** API key встроен в скрипты.

**Скрипты:**
- `~/clawd/skills/deep-research/scripts/exa-search.sh`
- `~/clawd/skills/deep-research/scripts/exa-crawl.sh`

### Проверка

```bash
# Test search
~/clawd/skills/deep-research/scripts/exa-search.sh "AI agents" 3

# Test crawl
~/clawd/skills/deep-research/scripts/exa-crawl.sh "https://github.com"
```

Должен вернуть JSON с результатами.

## Использование

### Quick Start

```
Load manager-research skill from ~/clawd/skills/deep-research/manager-research.md

Research topic: "AI agent orchestration patterns"
Session: research_20260131_x7k

Follow orchestration phases 1-5.
```

### Phases

1. **Planning:** decompose topic → `plan.yaml`
2. **Research:** parallel workers → `aspects/*.yaml`
3. **Synthesis:** aggregate findings → `synthesis.yaml`
4. **Quality Gate:** check thresholds → `quality.yaml`
5. **Report:** generate → `FINAL_REPORT.md`

### Output Location

```
~/clawd/artifacts/{session_id}/
├── plan.yaml
├── aspects/
│   ├── aspect_1.yaml
│   ├── aspect_2.yaml
│   └── ...
├── synthesis.yaml
├── quality.yaml
├── state.yaml (session state)
└── FINAL_REPORT.md
```

## Customization

### Изменить depth

В `research-planner.md`:
```yaml
depth: quick  # 3 aspects
depth: medium # 5 aspects (default)
depth: deep   # 7 aspects
```

### Настроить quality thresholds

В `quality-gate.md`:
```yaml
thresholds:
  saturation: 50    # Completeness %
  diversity: 0.5    # Source variety
  tier_quality: 0.7 # Avg source tier
```

### Tier weights для источников

В `aspect-researcher.md`:
```
S (1.0): github, arxiv, official docs
A (0.8): personal blogs, dev.to
B (0.6): Medium, StackOverflow
C (0.4): news sites
D (0.2): generic content
X (0.0): SEO farms → SKIP
```

## Troubleshooting

### "MCP server not found"
→ Установи exa MCP (см. выше)

### "No findings extracted"
→ Проверь slop thresholds (возможно слишком строгие)

### Worker failed
→ Проверь `state.yaml` для деталей
→ Re-run только failed aspects

## Next Steps

1. ✅ Установить exa MCP
2. Протестировать на simple topic
3. Адаптировать под свои нужды:
   - Добавить domain-specific skills
   - Настроить tier weights для своей области
   - Интегрировать с другими MCP servers

## Notes

- **Manager = Skill (не agent)** — ROOT читает и выполняет
- **Workers parallel** — все Task calls в одном message
- **Files = state** — всё persists в YAML
- **Resumable** — можно restart с любой phase
