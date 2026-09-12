import { createRequestSignal } from '@/utils/http';
import { isValidAuthFilesData } from '@/utils/providers';

export const STORAGE_KEY_BASE_URL = 'cpa_base_url';
export const STORAGE_KEY_MANAGEMENT_KEY = 'cpa_management_key';

export function validateAndNormalizeUrl(raw: string): { valid: boolean; normalized?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: 'Base URL is required' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are supported' };
  }

  if (url.username || url.password) {
    return { valid: false, error: 'URL credentials are not allowed' };
  }

  if (url.search || url.hash) {
    return { valid: false, error: 'Query strings and fragments are not allowed' };
  }

  if (url.pathname !== '' && url.pathname !== '/') {
    return { valid: false, error: 'Path prefixes are not allowed' };
  }

  const hostname = url.hostname.toLowerCase();
  if (url.protocol === 'http:' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return { valid: false, error: 'Remote connections require HTTPS' };
  }

  const normalized = `${url.protocol}//${url.host}`;
  return { valid: true, normalized };
}

export async function testConnection(
  baseUrl: string,
  managementKey: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/v0/management/auth-files`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${managementKey}`,
      },
      signal: createRequestSignal(signal),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'Authentication failed: Invalid management key' };
    }

    if (!res.ok) {
      return { ok: false, error: `Server returned HTTP ${res.status}` };
    }

    const data: unknown = await res.json();
    if (!isValidAuthFilesData(data)) {
      return { ok: false, error: 'Invalid response from CLIProxyAPI management endpoint' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Cannot connect to server. Verify the URL and ensure CLIProxyAPI is running.' };
  }
}

export async function saveConnection(
  rawBaseUrl: string,
  managementKey: string,
  oldBaseUrl?: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; error?: string }> {
  const norm = validateAndNormalizeUrl(rawBaseUrl);
  if (!norm.valid || !norm.normalized) {
    return { ok: false, error: norm.error };
  }

  const key = managementKey.trim();
  if (!key) {
    return { ok: false, error: 'Management Key is required' };
  }

  const originPattern = `${norm.normalized}/*`;

  let granted = false;
  try {
    granted = await browser.permissions.request({ origins: [originPattern] });
  } catch {
    return { ok: false, error: 'Failed to request host permission' };
  }

  if (!granted) {
    return { ok: false, error: 'Host permission was not granted by browser' };
  }

  const testResult = await testConnection(norm.normalized, key, signal);
  if (!testResult.ok) {
    if (norm.normalized !== oldBaseUrl) {
      try {
        await browser.permissions.remove({ origins: [originPattern] });
      } catch {
        // ignore rollback errors
      }
    }
    return { ok: false, error: testResult.error };
  }

  await browser.storage.local.set({
    [STORAGE_KEY_BASE_URL]: norm.normalized,
    [STORAGE_KEY_MANAGEMENT_KEY]: key,
  });

  if (oldBaseUrl && oldBaseUrl !== norm.normalized) {
    try {
      await browser.permissions.remove({ origins: [`${oldBaseUrl}/*`] });
    } catch {
      // ignore
    }
  }

  return { ok: true };
}

export async function clearConnection(currentBaseUrl?: string): Promise<void> {
  await browser.storage.local.remove([STORAGE_KEY_BASE_URL, STORAGE_KEY_MANAGEMENT_KEY]);
  if (currentBaseUrl) {
    try {
      await browser.permissions.remove({ origins: [`${currentBaseUrl}/*`] });
    } catch {
      // ignore
    }
  }
}
