#!/bin/bash
# Exa crawling wrapper
# Usage: ./exa-crawl.sh "url1" ["url2" ...]
# Requires: EXA_API_KEY environment variable

set -e

if [ -z "$EXA_API_KEY" ]; then
  echo "Error: EXA_API_KEY not set" >&2
  exit 1
fi

if [ $# -eq 0 ]; then
  echo "Usage: $0 \"url1\" [\"url2\" ...]"
  exit 1
fi

# Build JSON array of URLs
URLS="["
for url in "$@"; do
  URLS="${URLS}\"$url\","
done
URLS="${URLS%,}]"

curl -s -X POST 'https://api.exa.ai/contents' \
  -H "x-api-key: $EXA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{
    \"urls\": $URLS,
    \"text\": {
      \"max_characters\": 50000
    }
  }"
