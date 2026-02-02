# Self-Update Skill

Обновление из публичного шаблона сообщества.

## Триггеры

- "обновись из шаблона"
- "проверь обновления"
- "скачай новые скиллы"
- "/update"

## Источник

**Public Template:** https://github.com/matskevich/moltbot-memory-template

## Что можно обновить

| Что | Описание | Авто-применять? |
|-----|----------|-----------------|
| `skills/` | Новые навыки | Да, после показа |
| `SOUL.md` | Шаблон личности | Нет, только показать diff |
| `meta/` | Capabilities | Да |
| `custom/learnings.md` | Общие выводы | Merge |

## Алгоритм

```bash
# 1. Скачать шаблон во временную папку
cd /tmp
rm -rf moltbot-memory-template
git clone --depth 1 https://github.com/matskevich/moltbot-memory-template.git

# 2. Показать что нового
diff -rq /tmp/moltbot-memory-template/skills/ ~/clawd/skills/ 2>/dev/null || echo "No diff"

# 3. Для каждого нового skill — спросить владельца
# 4. Скопировать выбранное
# 5. Закоммитить изменения
```

## Безопасность

- **НЕ перезаписывать** существующие файлы без подтверждения
- **НЕ трогать** AGENTS.md, SECURITY.md (read-only, деплоятся владельцем)
- **НЕ менять** moltbot.json или системные настройки
- Показать diff ПЕРЕД применением

## Пример использования

**User:** "обновись из шаблона"

**Bot:**
```
Проверяю обновления из moltbot-memory-template...

Найдено:
- skills/youtube-summary/ — НОВЫЙ
- skills/deep-research/ — обновление (твоя версия: v1, шаблон: v2)
- custom/learnings.md — +3 новых записи

Применить? (да/нет/выбрать)
```

## Версии

Для отслеживания версий, в каждом skill должен быть:
```markdown
<!-- version: 1.0 -->
<!-- updated: 2026-02-01 -->
```
