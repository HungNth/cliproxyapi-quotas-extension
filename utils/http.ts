import { sanitizeErrorMessage, extractErrorMessage } from '@/utils/sanitize';

export interface UpstreamEnvelope {
  status_code?: number;
  statusCode?: number;
  body?: unknown;
}

export function getStatusCode(env: unknown): number {
  if (env && typeof env === 'object') {
    const e = env as UpstreamEnvelope;
    return e.status_code ?? e.statusCode ?? 0;
  }
  return 0;
}

export function createRequestSignal(parentSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(30_000);
  return parentSignal ? AbortSignal.any([parentSignal, timeoutSignal]) : timeoutSignal;
}

export async function parseApiCallEnvelope(res: Response): Promise<{
  ok: boolean;
  statusCode: number;
  body?: unknown;
  error?: { status?: number; message: string };
}> {
  if (!res.ok) {
    return {
      ok: false,
      statusCode: res.status,
      error: { status: res.status, message: `Management proxy failed: HTTP ${res.status}` },
    };
  }

  const envelope: unknown = await res.json();
  const statusCode = getStatusCode(envelope);
  if (!statusCode) {
    return {
      ok: false,
      statusCode: 0,
      error: { message: 'Invalid envelope from CLIProxyAPI management proxy' },
    };
  }

  const env = envelope as UpstreamEnvelope;
  if (statusCode >= 400) {
    let rawMsg = `Upstream error HTTP ${statusCode}`;
    try {
      const rawBody = typeof env.body === 'string' ? JSON.parse(env.body) : env.body;
      const extracted = extractErrorMessage(rawBody);
      if (extracted) rawMsg = extracted;
    } catch {
      // ignore
    }
    const sanitized = sanitizeErrorMessage(rawMsg, statusCode);
    return {
      ok: false,
      statusCode,
      error: { status: statusCode, message: sanitized },
    };
  }

  let body = env.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return {
        ok: false,
        statusCode,
        error: { message: 'Failed to parse upstream usage response' },
      };
    }
  }

  return { ok: true, statusCode, body };
}
