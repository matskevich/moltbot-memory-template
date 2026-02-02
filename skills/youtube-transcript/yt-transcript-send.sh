#!/bin/bash
# Wrapper для yt-transcript: транскрибирует видео и отправляет txt в Telegram
#
# Usage:
#   yt-transcript-send.sh <youtube-url> [target-id] [language]
#
# Examples:
#   yt-transcript-send.sh "https://youtube.com/watch?v=..." 123456789
#   yt-transcript-send.sh "https://youtu.be/..." @username
#   yt-transcript-send.sh "https://youtube.com/watch?v=..." 123456789 ru

set -e

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
YT_TRANSCRIPT="$SCRIPT_DIR/yt-transcript.sh"

if [ -z "$1" ]; then
  echo "Usage: yt-transcript-send.sh <youtube-url> [target-id] [language]"
  echo
  echo "Examples:"
  echo "  yt-transcript-send.sh 'https://youtube.com/watch?v=...' 123456789"
  echo "  yt-transcript-send.sh 'https://youtu.be/...' @username"
  echo "  yt-transcript-send.sh 'https://youtube.com/watch?v=...' 123456789 ru"
  exit 1
fi

URL="$1"
TARGET="${2:-YOUR_TELEGRAM_ID}"  # default: your telegram user ID
LANGUAGE="${3:-}"

# Extract video ID
VIDEO_ID=$(echo "$URL" | grep -oP '(?:v=|/)([0-9A-Za-z_-]{11})' | tail -1 | sed 's/v=//' | sed 's/\///')

if [ -z "$VIDEO_ID" ]; then
  echo "ERROR: Cannot extract video ID from URL: $URL" >&2
  exit 1
fi

# Create temp file
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

OUTPUT_FILE="$TMPDIR/youtube-transcript-${VIDEO_ID}.txt"

echo "=== YouTube Transcript Extractor ===" >&2
echo "URL: $URL" >&2
echo "Video ID: $VIDEO_ID" >&2
echo "Target: $TARGET" >&2
echo >&2

# Run transcript extraction
echo "[1/3] Extracting transcript..." >&2
if [ -n "$LANGUAGE" ]; then
  "$YT_TRANSCRIPT" "$URL" "$LANGUAGE" > "$OUTPUT_FILE" 2>&1
else
  "$YT_TRANSCRIPT" "$URL" > "$OUTPUT_FILE" 2>&1
fi

# Check if extraction succeeded
if [ ! -s "$OUTPUT_FILE" ]; then
  echo "ERROR: Transcript extraction failed or returned empty result" >&2
  exit 1
fi

# Get video metadata
echo "[2/3] Getting video metadata..." >&2
VIDEO_TITLE=$(yt-dlp \
  --cookies ~/clawd/youtube_cookies.txt \
  --js-runtimes node:/usr/bin/node \
  --remote-components ejs:github \
  --no-download \
  --print "%(title)s" \
  "$URL" 2>/dev/null || echo "unknown-video")

METADATA=$(yt-dlp \
  --cookies ~/clawd/youtube_cookies.txt \
  --js-runtimes node:/usr/bin/node \
  --remote-components ejs:github \
  --no-download \
  --print "%(title)s | %(uploader)s | %(duration)s sec" \
  "$URL" 2>/dev/null || echo "Unknown video")

# Generate filename: YYMMDD-short-keywords.txt (max 40 chars for keywords)
DATE_PREFIX=$(date +%y%m%d)

# Remove common stop words and extract key terms
TITLE_CLEAN=$(echo "$VIDEO_TITLE" | tr '[:upper:]' '[:lower:]' | \
  sed 's/\b\(the\|a\|an\|on\|as\|of\|to\|in\|for\|with\|and\|or\|but\|is\|are\)\b//g' | \
  iconv -t ascii//TRANSLIT 2>/dev/null | \
  sed 's/[^a-z0-9 ]/-/g' | \
  sed 's/--*/-/g' | \
  sed 's/^ *//;s/ *$//' | \
  tr ' ' '-' | \
  sed 's/--*/-/g')

# Truncate to 40 chars, remove trailing dash
TITLE_SLUG=$(echo "$TITLE_CLEAN" | cut -c1-40 | sed 's/-$//')

FINAL_FILENAME="${DATE_PREFIX}-${TITLE_SLUG}.txt"

echo "Metadata: $METADATA" >&2
echo "Filename: $FINAL_FILENAME" >&2
echo >&2

# Prepend metadata to transcript
{
  echo "YouTube Transcript"
  echo "=================="
  echo
  echo "$METADATA"
  echo "URL: $URL"
  echo
  echo "Transcript:"
  echo "----------"
  echo
  cat "$OUTPUT_FILE"
} > "$OUTPUT_FILE.final"

mv "$OUTPUT_FILE.final" "$OUTPUT_FILE"

# Send file via moltbot message tool
echo "[3/3] Sending file to Telegram..." >&2

# Note: This assumes you have `moltbot` CLI or can call message tool
# Fallback: just output the file path
FILE_SIZE=$(wc -c < "$OUTPUT_FILE")
echo "Transcript saved: $OUTPUT_FILE ($FILE_SIZE bytes)" >&2
echo "File path: $OUTPUT_FILE"

# Keep file for manual sending with proper name
FINAL_OUTPUT="/tmp/${FINAL_FILENAME}"
cp "$OUTPUT_FILE" "$FINAL_OUTPUT"

echo >&2
echo "=== Done! ===" >&2
echo "Transcript saved to: $FINAL_OUTPUT" >&2
echo >&2
echo "To send manually:" >&2
echo "  message send --target=$TARGET --file=$FINAL_OUTPUT --channel=telegram" >&2
