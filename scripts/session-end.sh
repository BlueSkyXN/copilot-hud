#!/bin/bash
# Copilot HUD: session-end hook
# Called when a Copilot CLI session ends

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // empty')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"

# Use per-session state file when SESSION_ID is available
if [ -n "$SESSION_ID" ]; then
  STATE_FILE="$COPILOT_HOME/hud-state-${SESSION_ID}.json"
else
  STATE_FILE="$COPILOT_HOME/hud-state.json"
fi

if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# For per-session files, just delete them — they are not needed after the session ends.
# The global fallback file (hud-state.json) is kept and marked inactive for compatibility.
if [ -n "$SESSION_ID" ]; then
  rm -f "$STATE_FILE"
else
  CURRENT=$(cat "$STATE_FILE")
  echo "$CURRENT" | jq '.sessionActive = false' > "$STATE_FILE"
fi
