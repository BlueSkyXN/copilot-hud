#!/bin/bash
# Copilot HUD: user-prompt hook
# Called when the user submits a prompt

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp // 0')
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

# Update prompt info in state, keep other fields
CURRENT=$(cat "$STATE_FILE")
echo "$CURRENT" | jq \
  --arg prompt "$PROMPT" \
  --argjson ts "$TIMESTAMP" \
  '.lastPrompt = $prompt | .lastPromptTime = $ts' \
  > "$STATE_FILE"
