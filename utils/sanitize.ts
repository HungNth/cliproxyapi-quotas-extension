export function sanitizeErrorMessage(raw: string, statusCode?: number): string {
  if (!raw || typeof raw !== 'string') {
    if (statusCode) {
      if (statusCode === 429) return 'Upstream rate limit exceeded';
      if (statusCode === 401 || statusCode === 403) return 'Upstream authentication failed';
      if (statusCode >= 500) return `Upstream provider error (HTTP ${statusCode})`;
      return `Upstream error (HTTP ${statusCode})`;
    }
    return 'Unknown upstream error';
  }

  // Remove Authorization Bearer tokens, long hex/base64 strings, key/token assignments
  let cleaned = raw
    .replace(/(?:authorization[:=\s]+)?(?:bearer|basic)\s+[A-Za-z0-9._~+/-]+=*/gi, 'Authorization: [REDACTED]')
    .replace(/(authorization[:=\s]+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(api[_-]?key|token|secret|password)[:=\s]+["']?[A-Za-z0-9._~+/-]+["']?/gi, '$1=[REDACTED]')
    .replace(/[a-zA-Z0-9_-]{32,}/g, '[REDACTED]')
    .trim();

  if (cleaned.length > 150) {
    cleaned = cleaned.slice(0, 150) + '…';
  }

  return cleaned;
}

export function extractErrorMessage(rawBody: unknown): string | undefined {
  if (rawBody && typeof rawBody === 'object' && 'error' in rawBody) {
    const errObj = rawBody.error;
    if (errObj && typeof errObj === 'object' && 'message' in errObj && typeof errObj.message === 'string') {
      return errObj.message;
    }
  }
  return undefined;
}
