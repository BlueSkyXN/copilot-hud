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

# Clean up inactive per-session state files (crash recovery: remove any leftover inactive files)
for _f in "$COPILOT_HOME"/hud-state-*.json; do
  [ -f "$_f" ] || continue
  _active=$(jq -r '.sessionActive | tostring' "$_f" 2>/dev/null)
  if [ "$_active" = "false" ]; then
    rm -f "$_f"
  fi
done
