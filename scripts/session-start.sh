#!/bin/bash
# Copilot HUD: session-start hook
# Called when a new Copilot CLI session begins

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // empty')

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"

# Use per-session state file when SESSION_ID is available
if [ -n "$SESSION_ID" ]; then
  STATE_FILE="$COPILOT_HOME/hud-state-${SESSION_ID}.json"
else
  STATE_FILE="$COPILOT_HOME/hud-state.json"
fi

# Write initial session state
jq -n \
  --arg cwd "$CWD" \
  --arg sid "$SESSION_ID" \
  --argjson ts "$TIMESTAMP" \
  '{
    sessionId: $sid,
    sessionStart: $ts,
    cwd: $cwd,
    lastPrompt: null,
    lastPromptTime: null,
    recentTools: [],
    sessionActive: true
  }' > "$STATE_FILE"

# Clean up inactive per-session state files older than 24 hours
find "$COPILOT_HOME" -maxdepth 1 -name 'hud-state-*.json' -mmin +1440 -exec rm -f {} \; 2>/dev/null || true
