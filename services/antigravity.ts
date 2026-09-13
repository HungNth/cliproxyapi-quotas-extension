import type { QuotaWindow, RawAuthFile } from '@/utils/providers';
import { sanitizeErrorMessage } from '@/utils/sanitize';
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
  const metadata = {
    ideType: 'ANTIGRAVITY',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI',
  };
  const metadataJSON = JSON.stringify(metadata);
  const requestBody = JSON.stringify({ metadata });

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
          'User-Agent': 'google-api-nodejs-client/9.15.1',
          'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
          'Client-Metadata': metadataJSON,
        },
        data: requestBody,
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
    if (typeof b.projectId === 'string') return b.projectId;
  } catch {
    // best-effort discovery failure ignored
  }

  return undefined;
}

function mergeFamilyQuota(window: QuotaWindow, remaining: number, resetAt?: string): void {
  if (window.remainingPercent === null || remaining < window.remainingPercent) {
    window.remainingPercent = remaining;
    window.resetAt = resetAt;
    return;
  }

  if (remaining === window.remainingPercent && resetAt) {
    if (!window.resetAt || new Date(resetAt) < new Date(window.resetAt)) {
      window.resetAt = resetAt;
    }
  }
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

  const requestData: Record<string, string> = {};
  if (projectId) {
    requestData.project = projectId;
  }

  let modelsObj: Record<string, unknown> | null = null;
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
          data: JSON.stringify(requestData),
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
          modelsObj = rawModels as Record<string, unknown>;
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
      windows: [
        { label: 'Claude & GPT models', remainingPercent: null },
        { label: 'Gemini models', remainingPercent: null },
      ],
      error: {
        status: lastStatusCode || undefined,
        message: sanitized,
      },
    };
  }

  // Parse into two standard Antigravity families
  const families: QuotaWindow[] = [
    { label: 'Claude & GPT models', remainingPercent: null },
    { label: 'Gemini models', remainingPercent: null },
  ];

  for (const [modelId, rawModel] of Object.entries(modelsObj)) {
    const normalized = modelId.toLowerCase().replace(/_/g, '-');
    const isClaude46 =
      normalized.startsWith('claude-') &&
      (normalized.includes('4-6') || normalized.includes('4.6'));

    let familyIdx = -1;
    if (isClaude46 || normalized.startsWith('gpt-')) {
      familyIdx = 0;
    } else if (normalized.startsWith('gemini-3.') || normalized.startsWith('gemini-3-')) {
      familyIdx = 1;
    } else {
      continue;
    }

    const model = (rawModel && typeof rawModel === 'object') ? (rawModel as Record<string, unknown>) : {};
    const quota = (model.quotaInfo && typeof model.quotaInfo === 'object')
      ? (model.quotaInfo as Record<string, unknown>)
      : (model.quota_info && typeof model.quota_info === 'object')
        ? (model.quota_info as Record<string, unknown>)
        : model;

    let remainingFraction: number | undefined;
    if (typeof quota.remainingFraction === 'number') {
      remainingFraction = quota.remainingFraction;
    } else if (typeof quota.remaining_fraction === 'number') {
      remainingFraction = quota.remaining_fraction;
    } else if (typeof quota.remaining === 'number') {
      remainingFraction = quota.remaining;
    }

    const rawReset = quota.resetTime ?? quota.reset_time ?? quota.reset_at ?? quota.resets_at;
    let resetAt: string | undefined;
    if (typeof rawReset === 'string' && rawReset.trim().length > 0) {
      resetAt = rawReset;
    }

    if (remainingFraction === undefined) {
      if (!resetAt) {
        continue;
      }
      remainingFraction = 0;
    }

    let remaining = remainingFraction <= 1.0 ? remainingFraction * 100 : remainingFraction;
    remaining = clamp(Math.round(remaining), 0, 100);

    const targetWindow = families[familyIdx];
    if (targetWindow) {
      mergeFamilyQuota(targetWindow, remaining, resetAt);
    }
  }

  const hasAnyQuota = families[0]?.remainingPercent !== null || families[1]?.remainingPercent !== null;

  return {
    ok: hasAnyQuota,
    windows: families,
    error: hasAnyQuota ? undefined : { message: 'no supported model quota returned' },
  };
}
