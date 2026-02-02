# Learnings — Общие выводы сообщества

Ошибки которые уже сделали, чтобы ты не повторял.

---

## Правило 1: Не угадывай config

**Проблема:** Добавление полей в `moltbot.json` без проверки документации приводит к crash.

**Примеры:**
- `agents.defaults.model.allowlist` — неверное поле, crash
- `contextPruning.mode: "adaptive"` — неверное значение, crash

**Решение:**
```bash
# ❌ НЕ ДЕЛАЙ
vim ~/.clawdbot/moltbot.json  # "думаю тут нужно allowlist..."

# ✅ ДЕЛАЙ
# 1. Найди в docs: https://docs.molt.bot
# 2. Найди пример в репо или у других
# 3. Если нет примера — не добавляй
```

---

## Правило 2: Config живёт на сервере

**Проблема:** Deploy script перезаписывает рабочий config упрощённой локальной версией.

**Что теряется:**
- `gateway.auth.token` — авторизация
- `env` секция — API ключи
- `plugins` — настройки плагинов

**Решение:**
- НИКОГДА не деплоить `moltbot.json`
- Config создаётся через `moltbot doctor` на сервере
- Редактируется вручную с бэкапом

---

## Правило 3: Уважай автономность бота

**Проблема:** `rsync --delete` удаляет файлы бота которых нет локально.

**Что под угрозой:**
- `skills/` — бот сам создаёт
- `SOUL.md` — бот сам обновляет
- `custom/`, `meta/` — записи бота

**Решение:**
```bash
# ❌ НЕ ДЕЛАЙ
rsync --delete skills/ server:~/clawd/skills/

# ✅ ДЕЛАЙ
rsync --ignore-existing skills/ server:~/clawd/skills/
# Или pull before push
```

---

## Meta-правило

Все эти ошибки объединяет одно:

**Изменения в production без проверки последствий.**

Решение:
1. Backup before critical changes
2. Pull before push
3. Documentation-first
4. Если не уверен — спроси владельца

---

**Версия:** 1.0
**Обновлено:** 2026-02-01
