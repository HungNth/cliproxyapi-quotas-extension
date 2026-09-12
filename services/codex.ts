import type { QuotaWindow } from '@/utils/providers';
import { createRequestSignal, parseApiCallEnvelope } from '@/utils/http';
import { decodeJwtPayload } from '@/utils/jwt';

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function extractChatgptAccountId(idToken?: string): string | undefined {
  if (!idToken) return undefined;
  const payload = decodeJwtPayload(idToken);
  if (payload) {
    if (typeof payload.chatgpt_account_id === 'string') return payload.chatgpt_account_id;
    const authId = payload['https://api.openai.com/auth.chatgpt_account_id'];
    if (typeof authId === 'string') return authId;
  }
  return undefined;
}

function parseWindow(rawWin: unknown, label: string): QuotaWindow | null {
  if (!rawWin || typeof rawWin !== 'object') return null;

  const win = rawWin as Record<string, unknown>;

  let usedPercent: number | undefined;
  if (typeof win.used_percent === 'number') {
    usedPercent = win.used_percent;
  } else if (typeof win.usedPercent === 'number') {
    usedPercent = win.usedPercent;
  } else if (typeof win.remaining_count === 'number' && typeof win.total_count === 'number' && win.total_count > 0) {
    usedPercent = 100 - (win.remaining_count / win.total_count) * 100;
  }

  let remainingPercent: number | null = null;
  if (usedPercent !== undefined) {
    remainingPercent = clamp(Math.round(100 - usedPercent), 0, 100);
  }

  let resetAt: string | undefined;
  if (typeof win.reset_at === 'string') {
    resetAt = win.reset_at;
  } else if (typeof win.resetAt === 'string') {
    resetAt = win.resetAt;
  } else if (typeof win.reset_at === 'number') {
    resetAt = new Date(win.reset_at * 1000).toISOString();
  } else if (typeof win.reset_after_seconds === 'number') {
    resetAt = new Date(Date.now() + win.reset_after_seconds * 1000).toISOString();
  }

  return {
    label,
    remainingPercent,
    resetAt,
  };
}

export async function fetchCodexQuota(
  baseUrl: string,
  managementKey: string,
  authIndex: string,
  idToken?: string,
  signal?: AbortSignal
): Promise<{
  ok: boolean;
  windows: QuotaWindow[];
  manualResetCredits?: number;
  error?: { status?: number; code?: string; message: string };
}> {


  const accountId = extractChatgptAccountId(idToken);
  const usageHeaders: Record<string, string> = {
    Authorization: 'Bearer $TOKEN$',
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'OpenAI-Beta': 'codex-1',
    'User-Agent': 'codex_cli_rs/0.76.0 (cpa-quota)',
    originator: 'cpa-quota',
  };
  if (accountId) {
    usageHeaders['Chatgpt-Account-Id'] = accountId;
  }

  const usageCall = fetch(`${baseUrl}/v0/management/api-call`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${managementKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_index: authIndex,
      method: 'GET',
      url: 'https://chatgpt.com/backend-api/wham/usage',
      header: usageHeaders,
    }),
    signal: createRequestSignal(signal),
  });

  const creditsCall = fetch(`${baseUrl}/v0/management/api-call`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${managementKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_index: authIndex,
      method: 'GET',
      url: 'https://chatgpt.com/backend-api/wham/rate-limit-reset-credits',
      header: {
        Authorization: 'Bearer $TOKEN$',
        Accept: 'application/json',
      },
    }),
    signal: createRequestSignal(signal),
  }).catch(() => null);

  const [usageRes, creditsRes] = await Promise.all([usageCall, creditsCall]);

  const parsed = await parseApiCallEnvelope(usageRes);
  if (!parsed.ok || !parsed.body || typeof parsed.body !== 'object') {
    return {
      ok: false,
      windows: [],
      error: parsed.error ?? { message: 'Empty or invalid upstream response' },
    };
  }

  const bodyObj = parsed.body as Record<string, unknown>;

  const rateLimit = (bodyObj.rate_limit as Record<string, unknown> | undefined) ?? bodyObj;

  const windows: QuotaWindow[] = [];

  const primary = rateLimit.primary_window ?? rateLimit['5_hour_window'] ?? rateLimit.primaryWindow;
  const parsedPrimary = parseWindow(primary, '5-hour');
  if (parsedPrimary) windows.push(parsedPrimary);

  const secondary = rateLimit.secondary_window ?? rateLimit.weekly_window ?? rateLimit.secondaryWindow;
  const parsedSecondary = parseWindow(secondary, 'Weekly');
  if (parsedSecondary) windows.push(parsedSecondary);

  // Parse manual credits if available
  let manualResetCredits: number | undefined;
  if (creditsRes) {
    try {
      const parsedCredits = await parseApiCallEnvelope(creditsRes);
      if (parsedCredits.ok && parsedCredits.body && typeof parsedCredits.body === 'object') {
        const cb = parsedCredits.body as Record<string, unknown>;
        const rlc = (cb.rate_limit_reset_credits as Record<string, unknown> | undefined) ?? cb;
        if (typeof rlc.available_count === 'number') {
          manualResetCredits = rlc.available_count;
        } else if (typeof rlc.availableCount === 'number') {
          manualResetCredits = rlc.availableCount;
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    ok: true,
    windows,
    manualResetCredits,
  };
}
