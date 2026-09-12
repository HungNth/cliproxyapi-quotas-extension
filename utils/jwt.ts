export function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  try {
    const parts = token.split('.');
    const payloadPart = parts[1];
    if (!payloadPart) return undefined;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(base64);
    const parsed: unknown = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return undefined;
}
