import type { QuotaWindow } from '@/utils/providers';
import { createRequestSignal, parseApiCallEnvelope } from '@/utils/http';

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function parseClaudeWindow(rawWin: unknown, label: string): QuotaWindow | null {
  if (!rawWin || typeof rawWin !== 'object') return null;

  const win = rawWin as Record<string, unknown>;

  let used: number | undefined;
  if (typeof win.utilization === 'number') {
    used = win.utilization;
  } else if (typeof win.used_percent === 'number') {
    used = win.used_percent;
  }

  let remainingPercent: number | null = null;
  if (used !== undefined) {
    const percentage = used <= 1.0 && used > 0 ? used * 100 : used;
    remainingPercent = clamp(Math.round(100 - percentage), 0, 100);
  }

  let resetAt: string | undefined;
  if (typeof win.resets_at === 'string') {
    resetAt = win.resets_at;
  } else if (typeof win.resetsAt === 'string') {
    resetAt = win.resetsAt;
  } else if (typeof win.reset_at === 'string') {
    resetAt = win.reset_at;
  }

  return {
    label,
    remainingPercent,
    resetAt,
  };
}

export async function fetchClaudeQuota(
  baseUrl: string,
  managementKey: string,
  authIndex: string,
  signal?: AbortSignal
): Promise<{
  ok: boolean;
  windows: QuotaWindow[];
  error?: { status?: number; code?: string; message: string };
}> {
  const res = await fetch(`${baseUrl}/v0/management/api-call`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${managementKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_index: authIndex,
      method: 'GET',
      url: 'https://api.anthropic.com/api/oauth/usage',
      header: {
        Authorization: 'Bearer $TOKEN$',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'cpa-quota/0.1',
      },
    }),
    signal: createRequestSignal(signal),
  });

  const parsed = await parseApiCallEnvelope(res);
  if (!parsed.ok || !parsed.body || typeof parsed.body !== 'object') {
    return {
      ok: false,
      windows: [],
      error: parsed.error ?? { message: 'Empty or invalid upstream response' },
    };
  }

  const bodyObj = parsed.body as Record<string, unknown>;

  const windows: QuotaWindow[] = [];

  const fiveHour = bodyObj.five_hour ?? bodyObj.fiveHour;
  const parsedFive = parseClaudeWindow(fiveHour, '5-hour');
  if (parsedFive) windows.push(parsedFive);

  const sevenDay = bodyObj.seven_day ?? bodyObj.sevenDay;
  const parsedSeven = parseClaudeWindow(sevenDay, '7-day');
  if (parsedSeven) windows.push(parsedSeven);

  return {
    ok: true,
    windows,
  };
}
