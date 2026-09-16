import {
  type RawAuthFile,
  type AccountQuota,
  type ProviderGroup,
  classifyProvider,
  extractDisplayName,
  getStatusBadge,
  compareVersions,
  sortAccounts,
  isValidAuthFilesData,
} from '@/utils/providers';
import { fetchCodexQuota } from '@/services/codex';
import { fetchClaudeQuota } from '@/services/claude';
import { fetchAntigravityQuota } from '@/services/antigravity';
import { createRequestSignal } from '@/utils/http';

export interface DiscoveryResult {
  ok: boolean;
  error?: string;
  groups: ProviderGroup[];
  currentVersion?: string;
}

export async function fetchLatestVersion(
  baseUrl: string,
  managementKey: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  try {
    const res = await fetch(`${baseUrl}/v0/management/latest-version`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${managementKey}` },
      signal: createRequestSignal(signal),
    });
    if (!res.ok) return undefined;
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'latest-version' in data) {
      const raw = data['latest-version'];
      if (typeof raw === 'string') {
        return raw.replace(/^[vV]/, '');
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < tasks.length) {
      const idx = currentIndex++;
      const task = tasks[idx];
      if (task) {
        results[idx] = await task();
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function discoverProviderAccounts(
  baseUrl: string,
  managementKey: string,
  signal?: AbortSignal
): Promise<DiscoveryResult> {
  const authFilesUrl = `${baseUrl}/v0/management/auth-files`;

  try {
    const authRes = await fetch(authFilesUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${managementKey}`,
      },
      signal: createRequestSignal(signal),
    });

    if (authRes.status === 401 || authRes.status === 403) {
      return {
        ok: false,
        error: 'Authentication failed: Invalid management key',
        groups: [],
      };
    }

    if (!authRes.ok) {
      return {
        ok: false,
        error: `Server returned HTTP ${authRes.status}`,
        groups: [],
      };
    }

    const authData: unknown = await authRes.json();
    if (!isValidAuthFilesData(authData)) {
      return {
        ok: false,
        error: 'Invalid response from CLIProxyAPI management endpoint',
        groups: [],
      };
    }

    const currentVersion =
      authRes.headers.get('X-CPA-VERSION') ??
      authRes.headers.get('X-Cpa-Version') ??
      authRes.headers.get('x-cpa-version') ??
      undefined;

    const cleanCurrentVersion = currentVersion ? currentVersion.replace(/^[vV]/, '') : undefined;
    const rawFiles: RawAuthFile[] = authData.files;

    const allAccounts: AccountQuota[] = [];
    const codexAccounts: AccountQuota[] = [];
    const antigravityAccounts: AccountQuota[] = [];
    const claudeAccounts: AccountQuota[] = [];

    for (const file of rawFiles) {
      const provider = classifyProvider(file);
      if (!provider) continue;

      const hasAuthIndex = typeof file.auth_index === 'string' && file.auth_index.trim().length > 0;
      const account: AccountQuota = {
        authIndex: hasAuthIndex ? file.auth_index!.trim() : '',
        provider,
        displayName: extractDisplayName(file),
        disabled: Boolean(file.disabled) || !hasAuthIndex,
        unavailable: Boolean(file.unavailable),
        statusBadge: getStatusBadge(file) ?? (!hasAuthIndex ? '[no auth index]' : undefined),
        windows: [],
        raw: file,
      };

      allAccounts.push(account);
      if (provider === 'codex') {
        codexAccounts.push(account);
      } else if (provider === 'antigravity') {
        antigravityAccounts.push(account);
      } else if (provider === 'claude') {
        claudeAccounts.push(account);
      }
    }

    // Run live quota fetch for eligible accounts (max 8 concurrent)
    const quotaTasks = allAccounts
      .filter((acc) => !acc.disabled && !acc.unavailable && acc.authIndex.length > 0)
      .map((acc) => async () => {
        try {
          if (acc.provider === 'codex') {
            const res = await fetchCodexQuota(baseUrl, managementKey, acc.authIndex, acc.raw.id_token, signal);
            if (res.ok) {
              acc.windows = res.windows;
              acc.manualResetCredits = res.manualResetCredits;
            } else {
              acc.error = res.error;
            }
          } else if (acc.provider === 'claude') {
            const res = await fetchClaudeQuota(baseUrl, managementKey, acc.authIndex, signal);
            if (res.ok) {
              acc.windows = res.windows;
            } else {
              acc.error = res.error;
            }
          } else if (acc.provider === 'antigravity') {
            const res = await fetchAntigravityQuota(baseUrl, managementKey, acc.authIndex, signal);
            acc.windows = res.windows;
            if (!res.ok && res.error) {
              acc.error = res.error;
            }
          }
        } catch {
          acc.error = { message: 'Failed to query quota' };
        }
      });

    if (quotaTasks.length > 0) {
      await runWithConcurrency(quotaTasks, 8);
    }

    const groups: ProviderGroup[] = [];
    if (codexAccounts.length > 0) {
      groups.push({ provider: 'codex', title: 'Codex', accounts: sortAccounts(codexAccounts) });
    }
    if (antigravityAccounts.length > 0) {
      groups.push({ provider: 'antigravity', title: 'Antigravity', accounts: sortAccounts(antigravityAccounts) });
    }
    if (claudeAccounts.length > 0) {
      groups.push({ provider: 'claude', title: 'Claude', accounts: sortAccounts(claudeAccounts) });
    }

    return {
      ok: true,
      groups,
      currentVersion: cleanCurrentVersion,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        error: 'Request was cancelled',
        groups: [],
      };
    }
    return {
      ok: false,
      error: 'Cannot connect to server. Verify the URL and ensure CLIProxyAPI is running.',
      groups: [],
    };
  }
}
