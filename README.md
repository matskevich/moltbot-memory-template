# Moltbot Memory Template

Шаблон рабочего репозитория бота — его память, личность и навыки.

**Создан:** 2026-02-01

## Часть двух-репозиторной архитектуры

| Репо | Назначение | Владелец |
|------|------------|----------|
| [moltbot-template](https://github.com/matskevich/moltbot-template) | Инфраструктура, скрипты, документация | Ты |
| [moltbot-memory-template](https://github.com/matskevich/moltbot-memory-template) | Память бота, личность, навыки | Бот |

**Этот репо — шаблон для второго.**

## Структура

```
SOUL.md      # Личность бота (бот сам формирует)
USER.md      # Заметки о владельце (бот сам пишет)
skills/      # Навыки бота (создаёт по мере необходимости)
memory/      # Долгосрочная память (embeddings)
custom/      # Его заметки, исследования
meta/        # Capabilities, use-cases
artifacts/   # Созданные файлы
```

## Использование

При setup на сервере:

```bash
# Клонируем шаблон
git clone https://github.com/matskevich/moltbot-memory-template.git clawd
cd ~/clawd

# Отвязываем от template, создаём свой ПРИВАТНЫЙ репо
rm -rf .git
git init
git add -A
git commit -m "Initial: bot workspace from template"

# Создай ПРИВАТНЫЙ репо на GitHub: my-moltbot-memory
git remote add origin git@github.com:YOUR_USERNAME/my-moltbot-memory.git
git push -u origin main
```

## Файлы владельца

Эти файлы **READ-ONLY** для бота — деплоятся из moltbot-template при `sync.sh push`:
- `AGENTS.md` — системные инструкции
- `SECURITY.md` — политики безопасности

## Auto-commit

Добавь в crontab на сервере:
```cron
0 */6 * * * cd ~/clawd && git add -A && git commit -m "Auto-backup: $(date +\%Y-\%m-\%d\ \%H:\%M)" && git push || true
```

## Ссылки

- [Основной шаблон](https://github.com/matskevich/moltbot-template)
- [Moltbot Docs](https://docs.molt.bot)
