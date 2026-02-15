# secureclaw

security audit for openclaw bots. 42 checks, zero dependencies, single file.

## what it does

scans your openclaw instance for security issues across 8 categories:

- **gateway** — bind mode, auth, TLS, mDNS, proxy config, control UI
- **credentials** — file permissions, plaintext keys, OAuth tokens, keys in memory
- **execution** — approvals, sandbox mode, docker isolation, dangerous allowlist entries
- **access-control** — DM policy, group policy, allowlists, session scope
- **supply-chain** — skill scanning, typosquat detection, dangerous patterns, IOC hashes
- **memory** — prompt injection in SOUL.md/MEMORY.md, base64 payloads, suspicious URLs
- **cost** — spending limits, usage tracking, high-frequency cron
- **ioc** — C2 IPs, malicious domains, infostealer artifacts (AMOS/Redline/Lumma)

each finding maps to [OWASP Agent Security Initiative](https://owasp.org/www-project-agent-security/) categories.

## install

copy `secureclaw-audit.mjs` into your bot's skills directory:

```bash
mkdir -p skills/secureclaw
cp secureclaw-audit.mjs skills/secureclaw/
cp SKILL.md skills/secureclaw/
```

or clone openclaw-brain which includes it:

```bash
git clone https://github.com/matskevich/openclaw-brain
```

## usage

### full audit (terminal)
```bash
node skills/secureclaw/secureclaw-audit.mjs audit
```

### telegram-friendly report (markdown, no ANSI)
```bash
node skills/secureclaw/secureclaw-audit.mjs audit --telegram
```

### JSON output (for parsing/automation)
```bash
node skills/secureclaw/secureclaw-audit.mjs audit --json
```

### deep scan (active port probing)
```bash
node skills/secureclaw/secureclaw-audit.mjs audit --deep
```

### scan a skill before installing
```bash
node skills/secureclaw/secureclaw-audit.mjs scan-skill <skill-name>
```

### quick status
```bash
node skills/secureclaw/secureclaw-audit.mjs status
```

## scoring

| score | grade | meaning |
|-------|-------|---------|
| 90-100 | A | solid security posture |
| 75-89 | B | good, minor issues |
| 60-74 | C | needs improvement |
| 40-59 | D | serious problems |
| 0-39 | F | critical, act now |

## severity

- **CRITICAL** — immediate threat (auth disabled, known malware, prompt injection in memory)
- **HIGH** — serious vulnerability (excessive permissions, dangerous patterns in skills)
- **MEDIUM** — recommended improvement (no TLS, no spending limits)
- **LOW/INFO** — informational

## environment

| variable | default | description |
|----------|---------|-------------|
| `OPENCLAW_STATE_DIR` | `~/.openclaw` | override state directory |

## as a bot skill

add `SKILL.md` to the skill directory. your bot will run the audit when users ask "security check", "audit", etc. see SKILL.md for trigger phrases and interpretation guide.

## requirements

- node.js 18+
- no dependencies (standalone .mjs bundle)

## license

MIT
