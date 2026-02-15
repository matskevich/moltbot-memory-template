# secureclaw — security audit

## когда запускать

- пользователь просит: "проверь безопасность", "security check", "аудит", "security audit", "scan security"
- пользователь просит проверить скилл перед установкой: "проверь скилл X", "scan skill Y"
- пользователь спрашивает о security posture: "какой security score?", "что с безопасностью?"

## как запускать

### полный аудит (telegram-friendly output — ВСЕГДА используй этот формат при ответе пользователю)
```bash
node skills/secureclaw/secureclaw-audit.mjs audit --telegram
```

### полный аудит (terminal, для отладки)
```bash
node skills/secureclaw/secureclaw-audit.mjs audit
```

### аудит в JSON (для парсинга)
```bash
node skills/secureclaw/secureclaw-audit.mjs audit --json
```

### глубокий аудит (с сетевыми проверками портов)
```bash
node skills/secureclaw/secureclaw-audit.mjs audit --deep --telegram
```

### быстрый статус
```bash
node skills/secureclaw/secureclaw-audit.mjs status
```

### сканирование скилла перед установкой
```bash
node skills/secureclaw/secureclaw-audit.mjs scan-skill <skill-name>
```

## как интерпретировать

### score
- **90-100 (A):** отличная защита
- **75-89 (B):** хорошая, есть minor issues
- **60-74 (C):** средняя, нужны улучшения
- **40-59 (D):** плохая, есть серьёзные проблемы
- **0-39 (F):** критическая, требует немедленных действий

### severity
- **CRITICAL:** немедленное действие, прямая угроза (auth disabled, known malware, prompt injection)
- **HIGH:** серьёзная уязвимость (excessive permissions, dangerous patterns in skills)
- **MEDIUM:** рекомендуемое улучшение (no TLS, no spending limits)
- **LOW/INFO:** информационные находки

### категории проверок (42 чека)
- **gateway:** bind mode, auth, TLS, mDNS, ports, proxy config
- **credentials:** file permissions, plaintext keys, OAuth tokens, API keys in memory
- **execution:** approvals, sandbox mode, docker isolation
- **access-control:** DM policy, group policy, allowlists, session scope
- **supply-chain:** skill scanning, typosquat detection, dangerous patterns, IOC hashes
- **memory:** prompt injection, base64 payloads, suspicious URLs, file permissions
- **cost:** spending limits, usage tracking, high-frequency cron
- **ioc:** C2 IPs, malicious domains, infostealer artifacts (AMOS/Redline/Lumma)

### OWASP ASI mapping
каждый finding содержит `owaspAsi` поле — ссылку на OWASP Agent Security Initiative

### что делать с results
1. покажи пользователю score и summary
2. по CRITICAL — объясни угрозу и дай конкретные шаги
3. auto-fixable findings — предложи выполнить fix команды
4. для scan-skill — если safe=false, настоятельно рекомендуй НЕ устанавливать скилл

## env

- `OPENCLAW_STATE_DIR` — override state directory (default: `~/.openclaw`)
