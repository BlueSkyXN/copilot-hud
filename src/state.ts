import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { HudState, ToolEntry } from './types.js';

const COPILOT_HOME = process.env.COPILOT_HOME ?? join(homedir(), '.copilot');
export const STATE_FILE = join(COPILOT_HOME, 'hud-state.json');
export const MAX_RECENT_TOOLS = 8;

function getStateFile(sessionId?: string): string {
  if (sessionId) return join(COPILOT_HOME, `hud-state-${sessionId}.json`);
  return STATE_FILE;
}

export function readState(sessionId?: string): HudState {
  const empty: HudState = { recentTools: [], sessionActive: false };

  // Prefer per-session file; fall back to legacy global file
  const candidates = sessionId
    ? [getStateFile(sessionId), STATE_FILE]
    : [STATE_FILE];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const raw = readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw) as HudState;
      return {
        ...empty,
        ...parsed,
        recentTools: Array.isArray(parsed.recentTools) ? parsed.recentTools : [],
      };
    } catch {
      continue;
    }
  }

  return empty;
}

export function summariseTools(tools: ToolEntry[]): Map<string, { count: number; lastStatus: ToolEntry['status']; lastTarget?: string }> {
  const summary = new Map<string, { count: number; lastStatus: ToolEntry['status']; lastTarget?: string }>();

  for (const tool of tools) {
    const key = tool.name;
    const existing = summary.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastStatus = tool.status;
      existing.lastTarget = tool.target;
    } else {
      summary.set(key, { count: 1, lastStatus: tool.status, lastTarget: tool.target });
    }
  }

  return summary;
}
