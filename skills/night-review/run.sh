#!/bin/bash
# Night Review Runner
# Invoked by cron, executes orchestrator via sessions_spawn

set -e

DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ARTIFACTS_DIR="$HOME/clawd/artifacts/night-review/$DATE"

# Create artifacts directory
mkdir -p "$ARTIFACTS_DIR"

# Log start
echo "[$TIMESTAMP] Night review started" >> "$ARTIFACTS_DIR/run.log"

# The orchestrator will be spawned by the cron job's agentTurn payload
# This script just ensures artifacts dir exists

echo "[$TIMESTAMP] Artifacts dir ready: $ARTIFACTS_DIR" >> "$ARTIFACTS_DIR/run.log"
