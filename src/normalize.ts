import type { SessionData } from './types.js';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function readString(obj: JsonObject | undefined, key: string): string | undefined {
  const value = obj?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readNumber(obj: JsonObject | undefined, key: string): number | undefined {
  const value = obj?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((v) => v !== undefined);
}

function looksLikeAutoModel(modelId: string | undefined): boolean {
  return modelId?.trim().toLowerCase() === 'auto';
}

function inferModelId(displayName: string | undefined): string | undefined {
  if (!displayName) return undefined;
  const lower = displayName.toLowerCase();

  const explicit = lower.match(/\b(claude-[a-z0-9.-]+|gpt-[a-z0-9.-]+|gemini-[a-z0-9.-]+|grok-[a-z0-9.-]+)\b/);
  if (explicit) return explicit[1];

  const trimmed = lower.split('(')[0].trim();
  if (!trimmed || trimmed === 'auto') return undefined;

  const normalized = trimmed
    .replace(/[^a-z0-9.\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized.length > 0 ? normalized : undefined;
}

function pickModel(root: JsonObject): SessionData['model'] | undefined {
  const model = asObject(root.model);
  const resolvedModel = asObject(root.resolved_model)
    ?? asObject(root.active_model)
    ?? asObject(model?.resolved_model);

  const modelId = readString(model, 'id');
  const modelDisplay = readString(model, 'display_name');
  const resolvedId = readString(resolvedModel, 'id');
  const resolvedDisplay = readString(resolvedModel, 'display_name');

  const effectiveId = firstDefined(
    looksLikeAutoModel(modelId) ? undefined : modelId,
    resolvedId,
    inferModelId(modelDisplay),
    inferModelId(resolvedDisplay),
    modelId,
  );
  const effectiveDisplay = looksLikeAutoModel(modelId)
    ? firstDefined(resolvedDisplay, modelDisplay, effectiveId)
    : firstDefined(modelDisplay, resolvedDisplay, effectiveId);

  if (!effectiveId && !effectiveDisplay) return undefined;
  return {
    id: effectiveId,
    display_name: effectiveDisplay,
  };
}

function pickContextWindow(root: JsonObject): SessionData['context_window'] | undefined {
  const usage = asObject(root.usage);
  const context = asObject(root.context_window)
    ?? asObject(root.contextWindow)
    ?? asObject(usage?.context_window);
  if (!context) return undefined;

  const rawUsedTokens = readNumber(context, 'used_tokens');
  const rawConsumedTokens = readNumber(context, 'consumed_tokens');
  const rawCurrentContextTokens = readNumber(context, 'current_context_tokens');
  const rawContextWindowSize = readNumber(context, 'context_window_size');
  const rawMaxTokens = readNumber(context, 'max_tokens');
  const rawDisplayedContextLimit = readNumber(context, 'displayed_context_limit');

  const modernLimit = rawDisplayedContextLimit;
  const modernUsed = rawCurrentContextTokens;
  const modernPct = readNumber(context, 'current_context_used_percentage');

  const legacyLimit = firstDefined(rawContextWindowSize, rawMaxTokens);
  const legacyUsed = firstDefined(rawUsedTokens, rawConsumedTokens);
  const legacyPct = readNumber(context, 'used_percentage');
  const remainingTokens = readNumber(context, 'remaining_tokens');

  const derivedLegacyUsed = (
    legacyLimit !== undefined &&
    remainingTokens !== undefined
  ) ? Math.max(0, legacyLimit - remainingTokens) : undefined;
  const resolvedLegacyUsed = firstDefined(
    legacyUsed,
    derivedLegacyUsed,
    (legacyLimit !== undefined && legacyPct !== undefined)
      ? Math.round((legacyPct / 100) * legacyLimit)
      : undefined,
  );

  const preferModern = modernLimit !== undefined && (modernUsed !== undefined || modernPct !== undefined);
  const derivedModernPct = (
    modernLimit !== undefined &&
    modernLimit > 0 &&
    modernUsed !== undefined
  ) ? Math.round((modernUsed / modernLimit) * 100) : undefined;

  const currentUsage = asObject(context.current_usage);
  return {
    used_percentage: preferModern
      ? firstDefined(modernPct, derivedModernPct, legacyPct)
      : firstDefined(legacyPct, modernPct),
    remaining_percentage: readNumber(context, 'remaining_percentage'),
    remaining_tokens: readNumber(context, 'remaining_tokens'),
    used_tokens: preferModern
      ? firstDefined(modernUsed, resolvedLegacyUsed)
      : firstDefined(resolvedLegacyUsed, modernUsed),
    context_window_size: preferModern
      ? modernLimit
      : firstDefined(legacyLimit, modernLimit),
    total_tokens: readNumber(context, 'total_tokens'),
    total_input_tokens: firstDefined(readNumber(context, 'total_input_tokens'), readNumber(context, 'input_tokens_total')),
    total_output_tokens: firstDefined(readNumber(context, 'total_output_tokens'), readNumber(context, 'output_tokens_total')),
    total_cache_read_tokens: readNumber(context, 'total_cache_read_tokens'),
    total_cache_write_tokens: readNumber(context, 'total_cache_write_tokens'),
    total_reasoning_tokens: firstDefined(readNumber(context, 'total_reasoning_tokens'), readNumber(context, 'reasoning_tokens_total')),
    last_call_input_tokens: readNumber(context, 'last_call_input_tokens'),
    last_call_output_tokens: readNumber(context, 'last_call_output_tokens'),
    modern_used_tokens: modernUsed,
    modern_context_window_size: modernLimit,
    modern_used_percentage: modernPct,
    legacy_used_tokens: resolvedLegacyUsed,
    legacy_context_window_size: legacyLimit,
    legacy_used_percentage: legacyPct,
    raw_used_tokens: rawUsedTokens,
    raw_consumed_tokens: rawConsumedTokens,
    raw_current_context_tokens: rawCurrentContextTokens,
    raw_context_window_size: rawContextWindowSize,
    raw_max_tokens: rawMaxTokens,
    raw_displayed_context_limit: rawDisplayedContextLimit,
    current_usage: currentUsage ? {
      input_tokens: readNumber(currentUsage, 'input_tokens'),
      output_tokens: readNumber(currentUsage, 'output_tokens'),
      cache_creation_input_tokens: readNumber(currentUsage, 'cache_creation_input_tokens'),
      cache_read_input_tokens: readNumber(currentUsage, 'cache_read_input_tokens'),
    } : undefined,
  };
}

function pickCost(root: JsonObject): SessionData['cost'] | undefined {
  const usage = asObject(root.usage);
  const cost = asObject(root.cost)
    ?? asObject(root.session_cost)
    ?? asObject(usage?.cost);

  const premiumRequests = firstDefined(
    readNumber(cost, 'total_premium_requests'),
    readNumber(cost, 'premium_requests'),
    readNumber(usage, 'total_premium_requests'),
    readNumber(root, 'total_premium_requests'),
  );

  const totalApiDuration = firstDefined(
    readNumber(cost, 'total_api_duration_ms'),
    readNumber(cost, 'api_duration_ms'),
  );

  const totalDuration = firstDefined(
    readNumber(cost, 'total_duration_ms'),
    readNumber(cost, 'duration_ms'),
  );

  const totalLinesAdded = firstDefined(
    readNumber(cost, 'total_lines_added'),
    readNumber(cost, 'lines_added'),
  );
  const totalLinesRemoved = firstDefined(
    readNumber(cost, 'total_lines_removed'),
    readNumber(cost, 'lines_removed'),
  );

  if (
    premiumRequests === undefined &&
    totalApiDuration === undefined &&
    totalDuration === undefined &&
    totalLinesAdded === undefined &&
    totalLinesRemoved === undefined
  ) {
    return undefined;
  }

  return {
    total_api_duration_ms: totalApiDuration,
    total_duration_ms: totalDuration,
    total_premium_requests: premiumRequests,
    total_lines_added: totalLinesAdded,
    total_lines_removed: totalLinesRemoved,
  };
}

export function normalizeSessionData(raw: unknown): SessionData {
  const root = asObject(raw);
  if (!root) return {};

  const workspace = asObject(root.workspace);

  return {
    cwd: readString(root, 'cwd'),
    session_id: readString(root, 'session_id') ?? readString(root, 'sessionId'),
    session_name: readString(root, 'session_name'),
    transcript_path: readString(root, 'transcript_path'),
    workspace: workspace ? { current_dir: readString(workspace, 'current_dir') } : undefined,
    model: pickModel(root),
    cost: pickCost(root),
    context_window: pickContextWindow(root),
  };
}
