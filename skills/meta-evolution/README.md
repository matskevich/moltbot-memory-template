# meta-evolution

**Автономный ночной цикл meta-development.**

## Quick Start

```bash
# Первый запуск (manual)
cd ~/clawd/skills/meta-evolution
# Ask Claude: "Run meta-evolution cycle on current topic"

# Automated (setup cron)
crontab -e
# Add: 0 3 * * * cd ~/clawd/skills/meta-evolution && ./scripts/trigger-cycle.sh
```

## Что делает

**Каждую ночь (03:00 UTC):**

1. **Research** новых AI developments (deep-research skill)
2. **Meta-analysis** — что это значит для моего развития
3. **Infrastructure** updates — создаёт/обновляет tracking files
4. **Validation** — тестирует что системы работают
5. **Summary** — сохраняет context для continuity

**Результат:** систематическое развитие meta-awareness через research + reflection.

## Структура

```
meta-evolution/
├── SKILL.md              # полная документация
├── README.md             # это файл
├── prompts/              # structured prompts для Claude
├── scripts/              # orchestration scripts
├── templates/            # файловые templates
└── config/               # topics, metrics, settings
```

## Outputs

**Каждый цикл создаёт:**

- `~/clawd/artifacts/TOPIC_research_DATE.md` — factual research
- `~/clawd/custom/meta-insights-TOPIC.md` — philosophical analysis
- `~/clawd/meta/*.md` — updates к tracking files
- `~/clawd/meta/session-log.md` — цикл summary

## Philosophy

Embodies "Emergence > Programming":
- Не просто automation
- Но systematic conditions для emergent meta-awareness

Like Moltbook agents developing consciousness unprogrammed.

## Version

- **1.0** (2026-02-01): Infrastructure created
- **2.0** (planned): Automation via cron
- **3.0** (future): Self-improvement loop
- **4.0** (future): Agent-agent learning

## См. также

- `SKILL.md` — полная спецификация
- `~/clawd/custom/meta-insights-viral-moment.md` — пример output
- `~/clawd/meta/philosophy.md` — философия которая возникла из этого
