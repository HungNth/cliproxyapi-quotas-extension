import type { QuotaWindow } from '@/utils/providers';
import { parseNumberValue, parseTimeValue } from '@/utils/providers';
import { createRequestSignal, parseApiCallEnvelope } from '@/utils/http';

const ANTIGRAVITY_QUOTA_ENDPOINT =
  'https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary';

const ANTIGRAVITY_PROJECT_PAYLOAD = JSON.stringify({ project: 'aicode-consumers' });

type WindowKey = 'gemini-5h' | 'gemini-weekly' | 'claude-gpt-5h' | 'claude-gpt-weekly';

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export async function fetchAntigravityQuota(
  baseUrl: string,
  managementKey: string,
  authIndex: string,
  signal?: AbortSignal
): Promise<{
  ok: boolean;
  windows: QuotaWindow[];
  error?: { status?: number; code?: string; message: string };
}> {
  const windowMap: Record<WindowKey, QuotaWindow> = {
    'gemini-5h': { label: 'Gemini (5-hour)', remainingPercent: null },
    'gemini-weekly': { label: 'Gemini (Weekly)', remainingPercent: null },
    'claude-gpt-5h': { label: 'Claude & GPT (5-hour)', remainingPercent: null },
    'claude-gpt-weekly': { label: 'Claude & GPT (Weekly)', remainingPercent: null },
  };

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
        url: ANTIGRAVITY_QUOTA_ENDPOINT,
        header: {
          Authorization: 'Bearer $TOKEN$',
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)',
        },
        data: ANTIGRAVITY_PROJECT_PAYLOAD,
      }),
      signal: createRequestSignal(signal),
    });

    const parsed = await parseApiCallEnvelope(res);
    if (!parsed.ok) {
      return {
        ok: false,
        windows: [],
        error: parsed.error,
      };
    }

    if (parsed.body && typeof parsed.body === 'object' && 'groups' in parsed.body) {
      const rawGroups = (parsed.body as { groups: unknown }).groups;
      if (Array.isArray(rawGroups)) {
        for (const group of rawGroups) {
          if (!group || typeof group !== 'object') continue;
          const groupObj = group as Record<string, unknown>;
          const groupName = String(groupObj.displayName ?? '').toLowerCase();

          let groupFamily: 'gemini' | 'claude-gpt' | null = null;
          if (groupName.includes('gemini')) {
            groupFamily = 'gemini';
          } else if (groupName.includes('claude') || groupName.includes('gpt')) {
            groupFamily = 'claude-gpt';
          }

          if (!groupFamily) continue;

          const buckets = groupObj.buckets;
          if (!Array.isArray(buckets)) continue;

          for (const bucket of buckets) {
            if (!bucket || typeof bucket !== 'object') continue;
            const bucketObj = bucket as Record<string, unknown>;
            const windowType = String(bucketObj.window ?? '').toLowerCase();

            let targetKey: WindowKey | null = null;
            if (groupFamily === 'gemini') {
              if (windowType === '5h') targetKey = 'gemini-5h';
              else if (windowType === 'weekly') targetKey = 'gemini-weekly';
            } else if (groupFamily === 'claude-gpt') {
              if (windowType === '5h') targetKey = 'claude-gpt-5h';
              else if (windowType === 'weekly') targetKey = 'claude-gpt-weekly';
            }

            if (!targetKey) continue;
            const target = windowMap[targetKey];
            if (!target) continue;

            const rawRemaining = parseNumberValue(bucketObj.remainingFraction);
            const resetAt = parseTimeValue(bucketObj.resetTime);

            let remaining: number | null = null;
            if (rawRemaining === undefined) {
              if (resetAt) {
                // ADR 0003: Treat omitted fraction with reset time as exhausted quota
                remaining = 0;
              }
            } else {
              const frac = rawRemaining <= 1.0 ? rawRemaining * 100 : rawRemaining;
              remaining = clamp(Math.round(frac), 0, 100);
            }

            if (remaining !== null) {
              target.remainingPercent = remaining;
              target.resetAt = resetAt;
            }
          }
        }
      }
    }
  } catch {
    return {
      ok: false,
      windows: [],
      error: { message: 'Failed to query quota' },
    };
  }

  const windows: QuotaWindow[] = [
    windowMap['gemini-5h'],
    windowMap['gemini-weekly'],
    windowMap['claude-gpt-5h'],
    windowMap['claude-gpt-weekly'],
  ];

  const hasAnyQuota = windows.some((w) => w.remainingPercent !== null);

  return {
    ok: hasAnyQuota,
    windows,
    error: hasAnyQuota ? undefined : { message: 'no supported model quota returned' },
  };
}
