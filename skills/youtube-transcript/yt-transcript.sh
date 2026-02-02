#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
VENV="$SCRIPT_DIR/venv"

# Check API key
if [ -z "$GROQ_API_KEY" ]; then
  echo "ERROR: GROQ_API_KEY not set" >&2
  exit 1
fi

if [ -z "$1" ]; then
  echo "Usage: yt-transcript <youtube-url> [language]"
  echo "  language: language code for Whisper (default: auto-detect)"
  exit 1
fi

URL="$1"
WHISPER_LANG="${2:-}"  # optional language param

# Step 1: Try youtube-transcript-api (existing subtitles)
echo "[1/3] Trying existing subtitles..." >&2

TRANSCRIPT=$("$VENV/bin/python3" -c "
from youtube_transcript_api import YouTubeTranscriptApi
import sys
import re

url = '$URL'
video_id = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11}).*', url)
if not video_id:
    print('ERROR: Invalid YouTube URL', file=sys.stderr)
    sys.exit(1)

video_id = video_id.group(1)

try:
    ytt_api = YouTubeTranscriptApi()
    # Try to fetch transcript (auto-generated or manual)
    # Prefer English, then Russian, then any available
    fetched = ytt_api.fetch(video_id, languages=['en', 'ru'])
    
    # Extract text from snippets
    text = ' '.join([snippet.text for snippet in fetched])
    print(text)
    sys.exit(0)
except Exception as e:
    print(f'Subtitles not available: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null) && {
  echo "✓ Found existing subtitles" >&2
  echo "$TRANSCRIPT"
  exit 0
}

# Step 1.5: Try auto-generated subs via yt-dlp (works on blocked IPs with cookies)
echo "[2/4] Trying auto-generated subtitles via yt-dlp..." >&2
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

SUBS_FILE="$TMPDIR/subs.en.vtt"

yt-dlp \
  --cookies ~/clawd/youtube_cookies.txt \
  --js-runtimes node:/usr/bin/node \
  --remote-components ejs:github \
  --write-auto-subs \
  --sub-langs en \
  --skip-download \
  --quiet --no-warnings \
  -o "$TMPDIR/subs" \
  "$URL" 2>&1 && [ -f "$SUBS_FILE" ] && {
  
  # Extract text from VTT (skip headers, timestamps, alignment)
  TRANSCRIPT=$(grep -v '^WEBVTT\|^Kind:\|^Language:\|^[0-9][0-9]:\|-->\|align:' "$SUBS_FILE" | \
    grep -v '^$' | \
    sed 's/<[^>]*>//g' | \
    tr '\n' ' ' | \
    sed 's/  */ /g')
  
  if [ -n "$TRANSCRIPT" ]; then
    echo "✓ Found auto-generated subtitles" >&2
    echo "$TRANSCRIPT"
    exit 0
  fi
}

# Step 3: Download audio via yt-dlp
echo "[3/4] Subtitles unavailable, downloading audio..." >&2
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

AUDIO_FILE="$TMPDIR/audio.m4a"

# Use system yt-dlp with cookies + JS runtime + challenge solver
yt-dlp -f 'bestaudio[ext=m4a]/bestaudio' \
  --cookies ~/clawd/youtube_cookies.txt \
  --js-runtimes node:/usr/bin/node \
  --remote-components ejs:github \
  --throttled-rate 100K \
  --quiet --no-warnings \
  -o "$AUDIO_FILE" \
  "$URL" 2>&1 || {
  echo "ERROR: Failed to download audio" >&2
  echo "TIP: Try updating yt-dlp: yt-dlp -U" >&2
  exit 1
}

# Step 4: Transcribe with Groq Whisper
echo "[4/4] Transcribing with Whisper..." >&2

# Build curl command with optional language parameter
CURL_CMD=(
  curl -s -X POST "https://api.groq.com/openai/v1/audio/transcriptions"
  -H "Authorization: Bearer $GROQ_API_KEY"
  -F "file=@$AUDIO_FILE"
  -F "model=whisper-large-v3"
  -F "response_format=text"
)

# Add language if specified, otherwise let Whisper auto-detect
if [ -n "$WHISPER_LANG" ]; then
  CURL_CMD+=(-F "language=$WHISPER_LANG")
fi

RESULT=$("${CURL_CMD[@]}")

if [ -z "$RESULT" ]; then
  echo "ERROR: Whisper API returned empty response" >&2
  exit 1
fi

echo "✓ Transcribed via Whisper" >&2
echo "$RESULT"
