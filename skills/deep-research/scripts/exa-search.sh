#!/bin/bash
# Exa API wrapper for deep-research skill
# Usage: ./exa-search.sh "query" [num_results] [max_chars]
# Requires: EXA_API_KEY environment variable

set -e

QUERY="$1"
NUM_RESULTS="${2:-10}"
MAX_CHARS="${3:-20000}"

if [ -z "$EXA_API_KEY" ]; then
  echo "Error: EXA_API_KEY not set" >&2
  exit 1
fi

if [ -z "$QUERY" ]; then
  echo "Usage: $0 \"search query\" [num_results] [max_chars]"
  exit 1
fi

curl -s -X POST 'https://api.exa.ai/search' \
  -H "x-api-key: $EXA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{
    \"query\": \"$QUERY\",
    \"type\": \"auto\",
    \"num_results\": $NUM_RESULTS,
    \"contents\": {
      \"text\": {
        \"max_characters\": $MAX_CHARS
      }
    }
  }"
