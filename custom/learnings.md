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

## Правило 4: Compaction = Амнезия

**Проблема:** После compaction агент теряет весь контекст. Предыдущие сообщения, решения, незавершённые задачи — всё забыто.

**Почему так:**
- Context > limit → memoryFlush → .bak → новая сессия
- .bak файлы НЕ индексируются в memory_search
- Нет автоматического восстановления

**Как понять что было compaction:**
- "вижу только одно твоё сообщение" — признак новой сессии
- Проверить: `ls -la ~/.clawdbot/agents/main/sessions/*.bak`

**Решение — Continuous Encoding:**
```markdown
# Во время работы ЗАПИСЫВАЙ:
1. custom/action-log.md — что сделал
2. custom/learnings.md — что понял
3. custom/self-notes.md — что не закончил

# Эти файлы переживают compaction!
```

**memoryFlush должен записывать:**
- Session summary в `memory/sessions/YYYY-MM-DD-summary.md`
- Незавершённые задачи в `custom/self-notes.md`
- Новые факты в `custom/learnings.md`

---

## Правило 5: Пиши ДО действия, не после

**Проблема:** Если запишешь результат ПОСЛЕ compaction — он потеряется.

**Пример:**
```
❌ Сделал рефакторинг → compaction → забыл записать
✅ Записал план → сделал рефакторинг → записал результат
```

**Решение:**
1. Action-log ПЕРЕД началом работы
2. Self-notes с контекстом
3. Learnings сразу когда понял

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

**Версия:** 1.1
**Обновлено:** 2026-02-02
