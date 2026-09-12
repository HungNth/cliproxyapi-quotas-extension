import type { QuotaWindow, RawAuthFile } from '@/utils/providers';
import { sanitizeErrorMessage, extractErrorMessage } from '@/utils/sanitize';
import { createRequestSignal, parseApiCallEnvelope } from '@/utils/http';

const ANTIGRAVITY_ENDPOINTS = [
  'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels',
];

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function extractExistingProjectId(raw: RawAuthFile): string | undefined {
  if (raw.project_id && typeof raw.project_id === 'string') return raw.project_id;

  if (raw.metadata && typeof raw.metadata === 'object') {
    const meta = raw.metadata as Record<string, unknown>;
    if (typeof meta.project_id === 'string') return meta.project_id;
    if (typeof meta.projectId === 'string') return meta.projectId;
  }

  if (raw.attributes && typeof raw.attributes === 'object') {
    const attr = raw.attributes as Record<string, unknown>;
    if (typeof attr.project_id === 'string') return attr.project_id;
    if (typeof attr.projectId === 'string') return attr.projectId;
  }

  return undefined;
}

async function resolveProjectId(
  baseUrl: string,
  managementKey: string,
  authIndex: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  try {
    const res = await fetch(`${baseUrl}/v0/management/api-call`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${managementKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_index: authIndex,
        method: 'POST',
        url: 'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
        header: {
          Authorization: 'Bearer $TOKEN$',
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          metadata: {
            ideType: 'ANTIGRAVITY',
            platform: 'PLATFORM_UNSPECIFIED',
            pluginType: 'GEMINI',
          },
        }),
      }),
      signal: createRequestSignal(signal),
    });

    const parsed = await parseApiCallEnvelope(res);
    if (!parsed.ok || !parsed.body || typeof parsed.body !== 'object') {
      return undefined;
    }

    const b = parsed.body as Record<string, unknown>;
    const companion = b.cloudaicompanionProject;
    if (typeof companion === 'string') return companion;
    if (companion && typeof companion === 'object') {
      const compObj = companion as Record<string, unknown>;
      if (typeof compObj.id === 'string') return compObj.id;
    }
    if (typeof b.project_id === 'string') return b.project_id;
  } catch {
    // ignore
  }

  return undefined;
}

interface ModelInfo {
  remainingFraction?: number;
  resetTime?: string;
  reset_time?: string;
  resets_at?: string;
}

export async function fetchAntigravityQuota(
  baseUrl: string,
  managementKey: string,
  authIndex: string,
  raw: RawAuthFile,
  signal?: AbortSignal
): Promise<{
  ok: boolean;
  windows: QuotaWindow[];
  error?: { status?: number; code?: string; message: string };
}> {
  let projectId = extractExistingProjectId(raw);

  if (!projectId) {
    projectId = await resolveProjectId(baseUrl, managementKey, authIndex, signal);
  }

  if (!projectId) {
    return {
      ok: false,
      windows: [],
      error: {
        message: 'Could not resolve Google Cloud project ID',
      },
    };
  }

  let modelsObj: Record<string, ModelInfo> | null = null;
  let lastStatusCode = 0;
  let lastErrorMessage = 'Failed to fetch available models';

  for (const endpoint of ANTIGRAVITY_ENDPOINTS) {
    try {
      const res = await fetch(`${baseUrl}/v0/management/api-call`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managementKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_index: authIndex,
          method: 'POST',
          url: endpoint,
          header: {
            Authorization: 'Bearer $TOKEN$',
            'Content-Type': 'application/json',
            'User-Agent': 'antigravity/1.11.5 cpa-quota',
          },
          data: JSON.stringify({ project: projectId }),
        }),
        signal: createRequestSignal(signal),
      });

      const parsed = await parseApiCallEnvelope(res);
      if (!parsed.ok) {
        lastStatusCode = parsed.statusCode;
        if (parsed.error?.message) {
          lastErrorMessage = parsed.error.message;
        }
        continue;
      }

      if (parsed.body && typeof parsed.body === 'object' && 'models' in parsed.body) {
        const rawModels = (parsed.body as { models: unknown }).models;
        if (rawModels && typeof rawModels === 'object' && rawModels !== null) {
          modelsObj = rawModels as Record<string, ModelInfo>;
          break; // Success!
        }
      }
    } catch {
      // try next fallback
    }
  }

  if (!modelsObj) {
    const sanitized = sanitizeErrorMessage(lastErrorMessage, lastStatusCode || undefined);
    return {
      ok: false,
      windows: [],
      error: {
        status: lastStatusCode || undefined,
        message: sanitized,
      },
    };
  }

  // Aggregate into Claude & GPT and Gemini families
  let claudeGptMin: number | null = null;
  let claudeGptEarliestReset: string | undefined;

  let geminiMin: number | null = null;
  let geminiEarliestReset: string | undefined;

  for (const [name, info] of Object.entries(modelsObj)) {
    const lower = name.toLowerCase();
    const isClaudeGpt = lower.includes('claude') || lower.includes('gpt');
    const isGemini = lower.includes('gemini');

    if (!isClaudeGpt && !isGemini) continue;

    const reset = info.resetTime ?? info.reset_time ?? info.resets_at;
    let pct: number | null = null;
    if (typeof info.remainingFraction === 'number') {
      const frac = info.remainingFraction <= 1.0 ? info.remainingFraction * 100 : info.remainingFraction;
      pct = clamp(Math.round(frac), 0, 100);
    } else if (reset) {
      pct = 0;
    }

    if (isClaudeGpt) {
      if (pct !== null) {
        claudeGptMin = claudeGptMin === null ? pct : Math.min(claudeGptMin, pct);
      }
      if (reset) {
        if (!claudeGptEarliestReset || new Date(reset) < new Date(claudeGptEarliestReset)) {
          claudeGptEarliestReset = reset;
        }
      }
    }

    if (isGemini) {
      if (pct !== null) {
        geminiMin = geminiMin === null ? pct : Math.min(geminiMin, pct);
      }
      if (reset) {
        if (!geminiEarliestReset || new Date(reset) < new Date(geminiEarliestReset)) {
          geminiEarliestReset = reset;
        }
      }
    }
  }

  const windows: QuotaWindow[] = [];
  if (claudeGptMin !== null) {
    windows.push({
      label: 'Claude & GPT models',
      remainingPercent: claudeGptMin,
      resetAt: claudeGptEarliestReset,
    });
  }

  if (geminiMin !== null) {
    windows.push({
      label: 'Gemini models',
      remainingPercent: geminiMin,
      resetAt: geminiEarliestReset,
    });
  }

  return {
    ok: true,
    windows,
  };
}
