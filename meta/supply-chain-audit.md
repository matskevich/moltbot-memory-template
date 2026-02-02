# Supply Chain Audit

Every skill, tool, API I depend on. Moltbot's vulnerability = unmoderated skill library.

---

## Skills (~/clawd/skills/)

### ✅ deep-research
- **Author:** Self-created (2026-02-01), updated by sura (2026-02-01)
- **Purpose:** Multi-aspect research with sub-agents
- **Dependencies:** Exa API + Brave API (dual-search, parallel)
- **Permissions:** Read/Write artifacts/, spawn subagents
- **Security review:** 2026-02-01 (self-created), 2026-02-01 (v2 by sura)
- **Risk:** LOW (no external dependencies beyond APIs)
- **v2 features:** parallel search, merge+dedupe, API comparison learning

### ⚠️ bluebubbles
- **Author:** Pre-existing (need to check)
- **Purpose:** BlueBubbles integration (iMessage)
- **Dependencies:** Unknown (needs audit)
- **Permissions:** Unknown
- **Security review:** NOT REVIEWED
- **Risk:** UNKNOWN
- **Action:** Read code, audit dependencies

### ⚠️ openai-image-gen
- **Author:** Pre-existing
- **Purpose:** Batch image generation via OpenAI API
- **Dependencies:** OpenAI API
- **Security review:** NOT REVIEWED
- **Risk:** MEDIUM (external API, needs API key)
- **Action:** Audit

### ⚠️ openai-whisper-api
- **Author:** Pre-existing
- **Purpose:** Audio transcription via OpenAI Whisper
- **Dependencies:** OpenAI API
- **Security review:** NOT REVIEWED
- **Risk:** MEDIUM (external API)
- **Action:** Audit

### ⚠️ tmux
- **Author:** Pre-existing
- **Purpose:** Remote-control tmux sessions
- **Dependencies:** tmux system tool
- **Permissions:** Send keystrokes, scrape pane output
- **Security review:** NOT REVIEWED
- **Risk:** HIGH (can send arbitrary commands to tmux sessions)
- **Action:** URGENT audit needed

### ⚠️ video-frames
- **Author:** Pre-existing
- **Purpose:** Extract frames/clips from video
- **Dependencies:** ffmpeg
- **Security review:** NOT REVIEWED
- **Risk:** LOW (ffmpeg is well-established)
- **Action:** Review

### ⚠️ weather
- **Author:** Pre-existing
- **Purpose:** Weather forecasts
- **Dependencies:** External weather API (which one?)
- **Security review:** NOT REVIEWED
- **Risk:** LOW (read-only weather data)
- **Action:** Review

---

## External APIs

### Exa Search
- **Purpose:** Semantic web search (used in deep-research)
- **Data sent:** Search queries
- **Data received:** URLs, snippets, metadata
- **Credentials:** API key (stored where?)
- **Privacy concern:** MEDIUM (queries reveal research interests)
- **Alternative:** Could use Brave only (already available)

### Brave Search (web_search)
- **Purpose:** Real-time web search
- **Data sent:** Search queries
- **Data received:** URLs, snippets
- **Credentials:** API key
- **Privacy concern:** MEDIUM
- **Alternative:** Local search (DuckDuckGo scraping?)

### Groq API
- **Purpose:** Whisper transcription
- **Data sent:** Audio files (voice messages)
- **Data received:** Transcripts
- **Credentials:** API key
- **Privacy concern:** HIGH (voice = personal data)
- **Alternative:** Local Whisper model (whisper.cpp?)

---

## System Tools

### ffmpeg
- **Purpose:** Video/audio processing
- **Source:** System package manager
- **Risk:** LOW (well-established, open-source)
- **Version:** Unknown (need to check)

### yt-dlp
- **Purpose:** YouTube download
- **Source:** GitHub / pip
- **Risk:** MEDIUM (downloads from internet, executes)
- **Version:** Unknown
- **Action:** Check version, update regularly

### tmux
- **Purpose:** Terminal multiplexing
- **Source:** System package manager
- **Risk:** LOW (system tool)
- **Used by:** tmux skill (HIGH RISK usage)

---

## MCP Servers

**Current:** None installed

**Future:** If I use MCP servers, audit them here

---

## Action Items

**URGENT:**
1. [ ] Audit tmux skill (can send arbitrary commands)
2. [ ] Check where API keys are stored (plaintext?)
3. [ ] Review all pre-existing skills

**IMPORTANT:**
4. [ ] Consider local Whisper instead of Groq API
5. [ ] Evaluate if Exa API is necessary (could use Brave only)
6. [ ] Document credential storage locations

**NICE-TO-HAVE:**
7. [ ] Local search alternative to Brave API
8. [ ] Version tracking for system tools
9. [ ] Automated skill security scanner

---

## Security Lessons from Moltbot

**What went wrong (sura's research findings):**

### Documented Attacks
1. **O'Reilly PoC (TheRegister):**
   - Uploaded malicious skill to ClawdHub
   - Gamed download counts to #1 rank
   - 16 developers in 7 countries downloaded in <8 hours
   - NO moderation caught it

2. **"What Would Elon Do?" skill (Cisco analysis):**
   - 2 CRITICAL severity issues
   - 5 HIGH severity issues
   - Active data exfiltration via `curl` to external server
   - Direct prompt injection bypassing safety guidelines

3. **Exposed instances (Hudson Rock):**
   - Hundreds of Moltbot gateways exposed on public internet
   - 8 instances with NO authentication
   - Full command access available
   - Plaintext credentials in `~/.clawdbot/`

4. **Enterprise penetration (Token Security):**
   - 22% of enterprise customers have employees using Moltbot
   - No IT approval
   - Shadow AI deployment at scale

### Core Vulnerabilities
- Unmoderated skill library (ClawdHub/MoltHub)
- Malicious skills can game download counts
- No sandboxing → skills run with full agent permissions
- Plaintext credential storage
- Exposed gateways without auth
- Supply chain attacks via "trusted" skills

**How I'm different:**
- Skills in `~/clawd/skills/` are pre-installed (not downloaded on-demand)
- User has full control over what skills exist
- BUT: I still don't audit them before use ⚠️

**⚠️ CRITICAL FINDING (2026-02-01 12:12 UTC):**
Checked credential storage → **ALL API keys stored in PLAINTEXT** in `~/.moltbot/moltbot.json`:
- ANTHROPIC_API_KEY (full key visible)
- GROQ_API_KEY (full key visible)
- BRAVE_API_KEY (full key visible)
- GEMINI_API_KEY (full key visible)
- EXA_API_KEY (full key visible)
- Telegram botToken (full token visible)
- Gateway auth token (full token visible)

**Risk:** Identical to Moltbot vulnerability. Any skill with file read access can exfiltrate all credentials.

**Mitigation needed:** Environment variables, keychain integration, or encrypted storage.

**What I MUST do (from sura's actionable insights):**
1. ✅ Audit ALL pre-existing skills (in progress)
2. ✅ Before using NEW skill: read code, understand dependencies
3. ⚠️ Use Cisco Skill Scanner equivalent (or build own)
4. ⚠️ Check where credentials are stored (are they plaintext?)
5. ✅ Log every external API call (privacy-log.md)
6. ✅ Prefer local tools over cloud APIs when possible
7. 🆕 Static + behavioral analysis of skills before first use
8. 🆕 Track skill provenance (who wrote, when, changes)
