export type ProviderType = 'codex' | 'antigravity' | 'claude';
import { decodeJwtPayload } from '@/utils/jwt';

export interface RawAuthFile {
  auth_index?: string;
  provider?: string;
  type?: string;
  name?: string;
  email?: string;
  label?: string;
  account?: string;
  status?: string;
  status_message?: string;
  disabled?: boolean;
  unavailable?: boolean;
  account_type?: string;
  auth_type?: string;
  api_key?: string;
  id_token?: string;
  metadata?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  project_id?: string;
}

export function isValidAuthFilesData(data: unknown): data is { files: RawAuthFile[] } {
  return Boolean(
    data &&
      typeof data === 'object' &&
      'files' in data &&
      Array.isArray(data.files) &&
      data.files.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
  );
}

export interface QuotaWindow {
  label: string;
  remainingPercent: number | null;
  resetAt?: string;
}

export interface AccountQuota {
  authIndex: string;
  provider: ProviderType;
  displayName: string;
  disabled: boolean;
  unavailable: boolean;
  statusBadge?: string;
  windows: QuotaWindow[];
  manualResetCredits?: number;
  error?: {
    code?: string;
    status?: number;
    message: string;
  };
  raw: RawAuthFile;
}

export interface ProviderGroup {
  provider: ProviderType;
  title: string;
  accounts: AccountQuota[];
}

export function classifyProvider(raw: RawAuthFile): ProviderType | null {
  const p = (raw.provider ?? raw.type ?? '').toLowerCase().replace(/[-_]/g, '');

  if (p.includes('codex')) {
    return 'codex';
  }

  if (p.includes('antigravity')) {
    return 'antigravity';
  }

  if (p.includes('claude') || p.includes('anthropic')) {
    if (p.includes('apikey')) return null;
    const accType = (raw.account_type ?? '').toLowerCase().replace(/[-_]/g, '');
    const authType = (raw.auth_type ?? '').toLowerCase().replace(/[-_]/g, '');
    const isApiKey =
      accType.includes('apikey') ||
      authType.includes('apikey') ||
      (typeof raw.api_key === 'string' && raw.api_key.trim().length > 0);
    if (isApiKey) {
      return null;
    }
    return 'claude';
  }

  return null;
}

function decodeJwtEmail(token: string): string | undefined {
  const payload = decodeJwtPayload(token);
  if (payload) {
    if (typeof payload.email === 'string') return payload.email;
    const profileEmail = payload['https://api.openai.com/profile.email'];
    if (typeof profileEmail === 'string') return profileEmail;
  }
  return undefined;
}

export function extractDisplayName(raw: RawAuthFile): string {
  if (raw.email && typeof raw.email === 'string') {
    return raw.email;
  }

  if (raw.id_token && typeof raw.id_token === 'string') {
    const jwtEmail = decodeJwtEmail(raw.id_token);
    if (jwtEmail) return jwtEmail;
  }

  if (raw.account && typeof raw.account === 'string') return raw.account;
  if (raw.name && typeof raw.name === 'string') return raw.name;
  if (raw.label && typeof raw.label === 'string') return raw.label;
  if (raw.auth_index && typeof raw.auth_index === 'string') return raw.auth_index;

  return 'unknown';
}

export function getStatusBadge(raw: RawAuthFile): string | undefined {
  if (raw.disabled) return '[disabled]';
  if (raw.unavailable) return '[unavailable]';

  if (raw.status && typeof raw.status === 'string') {
    const s = raw.status.toLowerCase();
    if (s !== 'ready' && s !== 'ok' && s !== 'active') {
      return `[${raw.status}]`;
    }
  }

  return undefined;
}

export function compareVersions(current?: string, latest?: string): boolean {
  if (!current || !latest) return false;

  const parse = (v: string): number[] =>
    v
      .replace(/^[vV]/, '')
      .split('.')
      .map((part) => parseInt(part, 10) || 0);

  const curParts = parse(current);
  const latParts = parse(latest);

  const len = Math.max(curParts.length, latParts.length);
  for (let i = 0; i < len; i++) {
    const c = curParts[i] ?? 0;
    const l = latParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }

  return false;
}

export function getMinRemaining(account: AccountQuota): number | null {
  if (account.windows.length === 0) return null;
  let min: number | null = null;
  for (const win of account.windows) {
    if (win.remainingPercent !== null) {
      if (min === null || win.remainingPercent < min) {
        min = win.remainingPercent;
      }
    }
  }
  return min;
}

export function sortAccounts(accounts: AccountQuota[]): AccountQuota[] {
  return [...accounts].sort((a, b) => {
    const aFailed = Boolean(a.error);
    const bFailed = Boolean(b.error);
    if (aFailed !== bFailed) {
      return aFailed ? 1 : -1;
    }

    const aMin = getMinRemaining(a);
    const bMin = getMinRemaining(b);
    if (aMin !== null && bMin !== null && aMin !== bMin) {
      return aMin - bMin;
    }
    if (aMin !== null && bMin === null) return -1;
    if (aMin === null && bMin !== null) return 1;

    return a.displayName.localeCompare(b.displayName);
  });
}

export function parseNumberValue(raw: unknown): number | undefined {
  if (typeof raw === 'number' && !isNaN(raw) && isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }
  return undefined;
}

export function parseTimeValue(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;

  const num = parseNumberValue(raw);
  if (num !== undefined && num > 0) {
    const ms = num > 10_000_000_000 ? num : num * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  return undefined;
}

export function formatCountdown(resetAt?: string, now: number = Date.now()): string {
  if (!resetAt) return '';
  const target = new Date(resetAt).getTime();
  if (isNaN(target)) return '';
  const sec = Math.floor((target - now) / 1000);
  if (sec <= 0) return 'ready';
  if (sec < 60) return 'in <1m';
  if (sec < 3600) return `in ${Math.floor(sec / 60)}m`;
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `in ${h}h ${m}m`;
  }
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return `in ${d}d ${h}h`;
}

export function formatLocalResetTime(resetAt?: string): string {
  if (!resetAt) return '';
  try {
    const d = new Date(resetAt);
    if (isNaN(d.getTime())) return '';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${mins}`;
  } catch {
    return '';
  }
}
