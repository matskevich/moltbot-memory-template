# YouTube Transcript Skill

**Smart YouTube transcription:** subtitles first, Whisper fallback.

## Strategy

1. **Try existing subtitles** (youtube-transcript-api)
   - Fast, free, no API limits
   - Works for auto-generated + manual captions
   - Tries: English → Russian → any available

2. **Try auto-generated subtitles** (yt-dlp with cookies)
   - Works even when YouTube blocks cloud IPs (Hetzner)
   - Uses cookies + JS runtime + challenge solver
   - Extracts VTT subtitles without downloading video

3. **Fallback to Whisper** (if no subtitles)
   - Download audio via yt-dlp (with cookies)
   - Transcribe via Groq Whisper API
   - Auto-delete temp files
   - **Note:** Fails for videos >25MB (Whisper API limit)

## Usage

### Basic extraction

```bash
yt-transcript <youtube-url> [language]
```

**Parameters:**
- `youtube-url` — any YouTube URL format
- `language` — (optional) language code for Whisper (e.g., `en`, `ru`, `de`)
  - If omitted: Whisper auto-detects language

**Examples:**

```bash
# Auto-detect language
yt-transcript https://youtube.com/watch?v=dQw4w9WgXcQ

# Force Russian transcription (Whisper fallback only)
yt-transcript https://youtu.be/dQw4w9WgXcQ ru

# Short URL format
yt-transcript https://youtu.be/dQw4w9WgXcQ

# With timestamp (works)
yt-transcript "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42"
```

### Extract and send to Telegram

```bash
yt-transcript-send.sh <youtube-url> [target-id] [language]
```

**Parameters:**
- `youtube-url` — YouTube URL
- `target-id` — (optional) Telegram user/chat ID (default: YOUR_TELEGRAM_ID)
- `language` — (optional) language code for Whisper

**Examples:**

```bash
# Send to default target
yt-transcript-send.sh "https://youtube.com/watch?v=..."

# Send to specific user
yt-transcript-send.sh "https://youtube.com/watch?v=..." @username

# With language override
yt-transcript-send.sh "https://youtube.com/watch?v=..." YOUR_TELEGRAM_ID ru
```

**What it does:**
1. Extracts transcript (subtitles → Whisper fallback)
2. Saves to `/tmp/youtube-transcript-<VIDEO_ID>.txt`
3. Automatically sends file via Telegram

**Output:**

```
[1/3] Trying existing subtitles...
✓ Found existing subtitles
We're no strangers to love. You know the rules and so do I...
```

Or if no subtitles:

```
[1/3] Trying existing subtitles...
Subtitles not available: No transcripts found
[2/3] Subtitles unavailable, downloading audio...
[3/3] Transcribing with Whisper...
✓ Transcribed via Whisper
We're no strangers to love...
```

## Dependencies

**Installed:**
- ✅ `yt-dlp` (system: `/usr/local/bin/yt-dlp`)
- ✅ `youtube-transcript-api==1.2.4` (venv)
- ✅ Python 3.12 (system)
- ✅ Node.js (for JS signature solving)

**Required:**
- `GROQ_API_KEY` environment variable
- `~/clawd/youtube_cookies.txt` — **fresh YouTube cookies** (required!)

**Check:**
```bash
echo $GROQ_API_KEY           # should output your API key
yt-dlp --version              # should show 2026.01.29+
ls -lh ~/clawd/youtube_cookies.txt  # should exist and be recent
```

**Cookie freshness:**
YouTube cookies expire **fast** (minutes to hours). If extraction fails with "Sign in to confirm you're not a bot", re-export cookies:

1. Open Chrome **incognito window**
2. Go to `youtube.com/robots.txt` and log in
3. Export cookies via [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
4. Save to `~/clawd/youtube_cookies.txt`
5. **Close incognito window** (don't reuse it!)

## How It Works

### Phase 1: Subtitle extraction
```python
from youtube_transcript_api import YouTubeTranscriptApi

ytt_api = YouTubeTranscriptApi()
fetched = ytt_api.fetch(video_id, languages=['en', 'ru'])
text = ' '.join([snippet.text for snippet in fetched])
```

### Phase 2: Auto-generated subtitles via yt-dlp (fallback)
```bash
yt-dlp \
  --cookies ~/clawd/youtube_cookies.txt \
  --js-runtimes node:/usr/bin/node \
  --remote-components ejs:github \
  --write-auto-subs \
  --sub-langs en \
  --skip-download \
  -o subs \
  <youtube-url>
```

**Why this works on Hetzner:**
- Uses **fresh cookies** to authenticate
- **JS runtime** solves signature challenges
- **Challenge solver** bypasses bot detection
- Works even when YouTube blocks cloud IPs

### Phase 3: Audio download (final fallback)
```bash
yt-dlp -f 'bestaudio[ext=m4a]/bestaudio' \
  --cookies ~/clawd/youtube_cookies.txt \
  --js-runtimes node:/usr/bin/node \
  --remote-components ejs:github \
  --throttled-rate 100K \
  -o audio.m4a \
  <youtube-url>
```

### Phase 4: Whisper transcription (final fallback)
```bash
curl -X POST "https://api.groq.com/openai/v1/audio/transcriptions" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F "file=@audio.m4a" \
  -F "model=whisper-large-v3" \
  -F "response_format=text"
```

## Advantages over `youtube-transcribe` skill

| Feature | youtube-transcript | youtube-transcribe |
|---------|-------------------|-------------------|
| Uses existing subtitles | ✅ Yes (free, instant) | ❌ No |
| Whisper fallback | ✅ Yes | ✅ Yes |
| API cost | 💰 Only if no subs | 💰 Always |
| Speed | ⚡ Instant (subs) | 🐌 Always downloads |
| Language detection | ✅ Auto (Whisper) | ⚠️ Hardcoded `ru` |

## Limitations

- **Whisper API limits:** Free tier = ~25 hours/month
- **YouTube blocks:** Cloud provider IPs may be blocked (use residential proxies if needed)
- **Long videos:** >1 hour may hit API limits or timeout

## Troubleshooting

**ERROR: GROQ_API_KEY not set**
```bash
export GROQ_API_KEY="gsk_..."
```

**ERROR: Failed to download audio**
- Update yt-dlp: `yt-dlp -U`
- Check URL is public
- If "Sign in to confirm" error → YouTube blocking IP (try cookies or proxy)

**Subtitles in wrong language**
- Script tries: English → Russian → any available
- To customize: edit `languages=['en', 'ru']` in script

**Empty Whisper response**
- Check GROQ_API_KEY is valid
- Check audio file is not corrupted
- Try shorter video first

## Integration with Agent

**Direct usage:**
```bash
yt-transcript "https://youtube.com/watch?v=VIDEO_ID"
```

**In workflow:**
```bash
# Download + transcribe + save
yt-transcript "https://youtube.com/watch?v=VIDEO_ID" > transcript.txt

# With language override
yt-transcript "https://youtube.com/watch?v=VIDEO_ID" en > transcript_en.txt
```

**Agent commands:**
- "Транскрибируй это видео: [URL]"
- "Что говорится в этом видео?"
- "Извлеки текст из YouTube: [URL]"

## Next Steps

After getting transcript:
1. **Save to file** — `> transcript.txt`
2. **Analyze content** — sentiment, keywords, topics
3. **Generate summary** — via LLM
4. **Extract structure** — timestamps, speakers, chapters
5. **Translate** — via LLM or translation API

## Files

```
youtube-transcript/
├── SKILL.md                # This file
├── yt-transcript.sh        # Main extraction script
├── yt-transcript-send.sh   # Wrapper: extract + send to Telegram
└── venv/                   # Python virtual environment
    └── lib/python3.12/site-packages/
        └── youtube_transcript_api/
```

## Testing

```bash
# Test with short video (has subtitles)
yt-transcript "https://youtube.com/watch?v=dQw4w9WgXcQ"

# Test with video without subtitles (will use Whisper)
# (find a video without auto-generated captions)

# Test language override
yt-transcript "https://youtube.com/watch?v=dQw4w9WgXcQ" en

# Test send to Telegram
yt-transcript-send.sh "https://youtube.com/watch?v=dQw4w9WgXcQ"
```

## Cookie Management

### When to refresh cookies

YouTube cookies expire **fast** due to security rotation. Refresh when you see:
```
ERROR: [youtube] Sign in to confirm you're not a bot
```

### How to refresh (Chrome extension)

1. **Open Chrome incognito** (Ctrl+Shift+N)
2. Go to `youtube.com` and log in
3. Navigate to `youtube.com/robots.txt` (required!)
4. Install [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
5. Click extension → Export → Select `youtube.com`
6. Save as `~/clawd/youtube_cookies.txt`
7. **Close incognito window** (important!)

### How to refresh (DevTools)

1. Open Chrome incognito
2. Go to `youtube.com/robots.txt` and log in
3. Press F12 → Console
4. Run: `copy(document.cookie)`
5. Send to agent (will save to `~/clawd/youtube_cookies.txt`)
6. Close incognito window

### Why cookies expire

YouTube detects "double usage":
- You export cookies from browser
- Continue using same browser/profile
- YouTube invalidates cookies (~1-5 min)

**Solution:** Export from incognito/separate profile you won't reuse.

## References

- [youtube-transcript-api GitHub](https://github.com/jdepoix/youtube-transcript-api)
- [yt-dlp documentation](https://github.com/yt-dlp/yt-dlp)
- [Groq Whisper API](https://console.groq.com/docs/speech-text)
- Research: `~/clawd/research/youtube-download-2026.md`
