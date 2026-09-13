import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import App from '../App.vue';

describe('Ticket 01: Configure one CLIProxyAPI Instance', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
  });

  it('renders connection form on first run with masked key and reveal control', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('CLI Proxy API Quotas');
    expect(wrapper.find('input[data-testid="base-url"]').exists()).toBe(true);

    const keyInput = wrapper.find('input[data-testid="management-key"]');
    expect(keyInput.exists()).toBe(true);
    expect(keyInput.attributes('type')).toBe('password');

    const toggleBtn = wrapper.find('[data-testid="toggle-key-visibility"]');
    expect(toggleBtn.exists()).toBe(true);
    await toggleBtn.trigger('click');
    expect(wrapper.find('input[data-testid="management-key"]').attributes('type')).toBe('text');
  });

  it('rejects remote HTTP, path prefixes, queries, and malformed URLs', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    const urlInput = wrapper.find('input[data-testid="base-url"]');
    const keyInput = wrapper.find('input[data-testid="management-key"]');
    const saveBtn = wrapper.find('[data-testid="save-btn"]');

    // Remote HTTP
    await urlInput.setValue('http://remote-cpa.com:8317');
    await keyInput.setValue('secret-key');
    await saveBtn.trigger('click');
    expect(wrapper.text()).toContain('Remote connections require HTTPS');

    // Path prefix
    await urlInput.setValue('https://remote-cpa.com/subpath');
    await saveBtn.trigger('click');
    expect(wrapper.text()).toContain('Path prefixes are not allowed');

    // Query string
    await urlInput.setValue('https://remote-cpa.com?query=1');
    await saveBtn.trigger('click');
    expect(wrapper.text()).toContain('Query strings and fragments are not allowed');
  });

  it('saves valid connection after requesting exact origin permission and validating /auth-files', async () => {
    const callOrder: string[] = [];
    const permissionsRequested: string[] = [];
    const originsContained = new Set<string>();

    fakeBrowser.permissions.request = vi.fn().mockImplementation(async ({ origins }: { origins?: string[] }) => {
      callOrder.push('permissions.request');
      if (origins) {
        permissionsRequested.push(...origins);
        origins.forEach((o: string) => originsContained.add(o));
      }
      return true;
    });
    fakeBrowser.permissions.contains = vi.fn().mockImplementation(async ({ origins }: { origins?: string[] }) => {
      return origins ? origins.every((o: string) => originsContained.has(o)) : false;
    });

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      callOrder.push(`fetch:${url}`);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
        json: async () => ({ files: [] }),
      };
    });
    global.fetch = fetchMock;
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    await wrapper.find('input[data-testid="base-url"]').setValue('http://127.0.0.1:8317/');
    await wrapper.find('input[data-testid="management-key"]').setValue('test-management-key');
    await wrapper.find('[data-testid="save-btn"]').trigger('click');

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(permissionsRequested).toContain('http://127.0.0.1:8317/*');

    expect(callOrder[0]).toBe('permissions.request');
    expect(callOrder[1]).toContain('fetch:http://127.0.0.1:8317/v0/management/auth-files');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8317/v0/management/auth-files',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-management-key',
        }),
      })
    );

    const stored = await fakeBrowser.storage.local.get(['cpa_base_url', 'cpa_management_key']);
    expect(stored.cpa_base_url).toBe('http://127.0.0.1:8317');
    expect(stored.cpa_management_key).toBe('test-management-key');
  });

  it('rolls back newly requested origin if validation fails, preserving previous settings', async () => {
    await fakeBrowser.storage.local.set({
      cpa_base_url: 'http://127.0.0.1:8317',
      cpa_management_key: 'old-key',
    });

    const permissionsRemoved: string[] = [];
    fakeBrowser.permissions.request = vi.fn().mockResolvedValue(true);
    fakeBrowser.permissions.remove = vi.fn().mockImplementation(async ({ origins }: { origins?: string[] }) => {
      if (origins) {
        permissionsRemoved.push(...origins);
      }
      return true;
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid management key',
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    const settingsBtn = wrapper.find('[data-testid="settings-btn"]');
    expect(settingsBtn.exists()).toBe(true);
    await settingsBtn.trigger('click');
    await wrapper.vm.$nextTick();

    await wrapper.find('input[data-testid="base-url"]').setValue('https://new-cpa.example.com');
    await wrapper.find('input[data-testid="management-key"]').setValue('wrong-key');
    await wrapper.find('[data-testid="save-btn"]').trigger('click');

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Authentication failed');
    expect(permissionsRemoved).toContain('https://new-cpa.example.com/*');

    const stored = await fakeBrowser.storage.local.get(['cpa_base_url', 'cpa_management_key']);
    expect(stored.cpa_base_url).toBe('http://127.0.0.1:8317');
    expect(stored.cpa_management_key).toBe('old-key');
  });

  it('rejects malformed auth-files response containing null items', async () => {
    fakeBrowser.permissions.request = vi.fn().mockResolvedValue(true);
    fakeBrowser.permissions.remove = vi.fn().mockResolvedValue(true);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ files: [null] }),
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    await wrapper.find('input[data-testid="base-url"]').setValue('http://127.0.0.1:8317');
    await wrapper.find('input[data-testid="management-key"]').setValue('test-key');
    await wrapper.find('[data-testid="save-btn"]').trigger('click');

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Invalid response from CLIProxyAPI management endpoint');
  });

  it('clears configuration and removes granted origin permission on Clear', async () => {
    await fakeBrowser.storage.local.set({
      cpa_base_url: 'http://127.0.0.1:8317',
      cpa_management_key: 'saved-key',
    });

    const permissionsRemoved: string[] = [];
    fakeBrowser.permissions.remove = vi.fn().mockImplementation(async ({ origins }: { origins?: string[] }) => {
      if (origins) {
        permissionsRemoved.push(...origins);
      }
      return true;
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ files: [] }),
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    const settingsBtn = wrapper.find('[data-testid="settings-btn"]');
    expect(settingsBtn.exists()).toBe(true);
    await settingsBtn.trigger('click');
    await wrapper.vm.$nextTick();

    const clearBtn = wrapper.find('[data-testid="clear-btn"]');
    expect(clearBtn.exists()).toBe(true);
    await clearBtn.trigger('click');

    await flushPromises();
    await wrapper.vm.$nextTick();

    const stored = await fakeBrowser.storage.local.get(['cpa_base_url', 'cpa_management_key']);
    expect(stored.cpa_base_url).toBeUndefined();
    expect(stored.cpa_management_key).toBeUndefined();

    expect(permissionsRemoved).toContain('http://127.0.0.1:8317/*');
    expect(wrapper.find('input[data-testid="base-url"]').exists()).toBe(true);
  });
});

describe('Ticket 02: Discover Provider Accounts on Refresh', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
    await fakeBrowser.storage.local.set({
      cpa_base_url: 'http://127.0.0.1:8317',
      cpa_management_key: 'test-key',
    });
  });

  it('auto-discovers accounts on mount, displaying groups in Codex -> Antigravity -> Claude order with status', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.150' }),
          json: async () => ({
            files: [
              { auth_index: 'claude-1', provider: 'claude', email: 'claude-user@test.com', status: 'ready' },
              { auth_index: 'claude-key', provider: 'claude', email: 'api-user@test.com', account_type: 'api-key' },
              { auth_index: 'codex-1', provider: 'codex', email: 'codex-user@test.com', status: 'ready' },
              { auth_index: 'codex-dis', provider: 'codex', email: 'disabled@test.com', disabled: true },
              { auth_index: 'anti-1', provider: 'antigravity', email: 'anti-user@test.com', unavailable: true },
              { auth_index: 'unknown-1', provider: 'some-unknown-ai', email: 'other@test.com' },
            ],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ 'latest-version': 'v7.2.154' }),
        };
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    // Check Provider Groups presence and order
    const text = wrapper.text();
    expect(text).toContain('Codex');
    expect(text).toContain('Antigravity');
    expect(text).toContain('Claude');

    // Order check: Codex before Antigravity before Claude
    const codexIdx = text.indexOf('Codex');
    const antiIdx = text.indexOf('Antigravity');
    const claudeIdx = text.indexOf('Claude');
    expect(codexIdx).toBeLessThan(antiIdx);
    expect(antiIdx).toBeLessThan(claudeIdx);

    // Accounts rendered
    expect(text).toContain('codex-user@test.com');
    expect(text).toContain('disabled@test.com');
    expect(text).toContain('[disabled]');
    expect(text).toContain('anti-user@test.com');
    expect(text).toContain('[unavailable]');
    expect(text).toContain('claude-user@test.com');

    // Unsupported & Claude api-key filtered out
    expect(text).not.toContain('api-user@test.com');
    expect(text).not.toContain('other@test.com');

    // Version update notice rendered as plain text without link/badge
    expect(text).toContain('v7.2.150 → v7.2.154 available');
    expect(wrapper.find('a[href*="github.com"]').exists()).toBe(false);
  });

  it('renders empty state when no supported provider accounts exist', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({ files: [{ provider: 'unknown-provider', auth_index: '1' }] }),
        };
      }
      return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('No supported provider accounts found');
  });
  it('deduplicates manual Refresh triggers and disables Refresh button while in-flight', async () => {
    let authCallCount = 0;
    const { promise: hangingPromise, resolve: resolveAuth } = Promise.withResolvers<Response>();

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth-files')) {
        authCallCount++;
        return hangingPromise;
      }
      return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    const refreshBtn = wrapper.find('[data-testid="refresh-btn"]');
    expect(refreshBtn.exists()).toBe(true);
    expect(refreshBtn.attributes('disabled')).toBeDefined();

    // Second click while in-flight is deduplicated
    await refreshBtn.trigger('click');
    expect(authCallCount).toBe(1);

    // Resolve the in-flight request
    resolveAuth({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ files: [] }),
    } as unknown as Response);

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(refreshBtn.attributes('disabled')).toBeUndefined();
  });


  it('survives latest-version endpoint failure without failing account discovery', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({
            files: [{ auth_index: 'codex-1', provider: 'codex', email: 'user@test.com', status: 'ready' }],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return { ok: false, status: 500, statusText: 'Internal Server Error' };
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('user@test.com');
    expect(wrapper.text()).toContain('7.2.0');
    expect(wrapper.text()).not.toContain('→');
  });

  it('renders sanitized global connection error on auth-files failure with route to Settings', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'secret_token_leaked_in_error',
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Authentication failed');
    expect(wrapper.text()).not.toContain('secret_token_leaked_in_error');
    expect(wrapper.find('[data-testid="settings-btn"]').exists()).toBe(true);
  });
});

describe('Ticket 03: Show live Codex quota windows', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
    await fakeBrowser.storage.local.set({
      cpa_base_url: 'http://127.0.0.1:8317',
      cpa_management_key: 'test-key',
    });
  });

  it('fetches live Codex quota via api-call, normalizes remaining percentages, renders reset countdown and credits', async () => {
    const apiCallsMade: Array<{ auth_index?: string; url?: string; header?: Record<string, string> }> = [];
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({
            files: [
              { auth_index: 'codex-1', provider: 'codex', email: 'active@openai.com', status: 'ready' },
              { auth_index: 'codex-dis', provider: 'codex', email: 'dis@openai.com', disabled: true },
            ],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
      }
      if (url.includes('/api-call')) {
        const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : {};
        apiCallsMade.push(body);

        if (body.url.includes('/usage')) {
          // Return 5-hour: 30% used (70% remaining), weekly: 85% used (15% remaining)
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 200,
              body: JSON.stringify({
                rate_limit: {
                  primary_window: {
                    used_percent: 30,
                    reset_after_seconds: 3600,
                  },
                  secondary_window: {
                    used_percent: 85,
                    reset_after_seconds: 86400,
                  },
                },
              }),
            }),
          };
        }
        if (body.url.includes('/rate-limit-reset-credits')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 200,
              body: JSON.stringify({
                rate_limit_reset_credits: {
                  available_count: 3,
                },
              }),
            }),
          };
        }
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    // Only the active account should generate api-call, not disabled
    expect(apiCallsMade.length).toBeGreaterThan(0);
    expect(apiCallsMade.every((call) => call.auth_index === 'codex-1')).toBe(true);
    expect(apiCallsMade.some((call) => call.header?.Authorization === 'Bearer $TOKEN$')).toBe(true);

    const text = wrapper.text();
    expect(text).toContain('active@openai.com');
    expect(text).toContain('dis@openai.com');
    expect(text).toContain('[disabled]');

    // 5-hour: 70% remaining; Weekly: 15% remaining
    expect(text).toContain('70%');
    expect(text).toContain('15%');
    expect(text).toContain('Manual resets: 3');
  });

  it('sorts accounts by lowest remaining quota first, then name; preserves Partial Quota Snapshot on single account error', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({
            files: [
              { auth_index: 'high-quota', provider: 'codex', email: 'high@test.com' },
              { auth_index: 'low-quota', provider: 'codex', email: 'low@test.com' },
              { auth_index: 'failing-quota', provider: 'codex', email: 'fail@test.com' },
            ],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
      }
      if (url.includes('/api-call')) {
        const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : {};
        if (body.auth_index === 'high-quota') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 200,
              body: { rate_limit: { primary_window: { used_percent: 10 } } },
            }),
          };
        }
        if (body.auth_index === 'low-quota') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 200,
              body: { rate_limit: { primary_window: { used_percent: 90 } } },
            }),
          };
        }
        if (body.auth_index === 'failing-quota') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 429,
              body: JSON.stringify({ error: { message: 'Upstream rate limit exceeded', secret: 'leak_secret_token' } }),
            }),
          };
        }
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    const text = wrapper.text();

    // Partial Quota Snapshot: successful accounts visible
    expect(text).toContain('low@test.com');
    expect(text).toContain('high@test.com');
    expect(text).toContain('fail@test.com');

    // Order check: low quota (10% remaining) before high quota (90% remaining) before failed
    const lowIdx = text.indexOf('low@test.com');
    const highIdx = text.indexOf('high@test.com');
    const failIdx = text.indexOf('fail@test.com');
    expect(lowIdx).toBeLessThan(highIdx);
    expect(highIdx).toBeLessThan(failIdx);

    // Error is sanitized and no secret is leaked
    expect(text).toContain('rate limit exceeded');
    expect(text).not.toContain('leak_secret_token');
  });

  it('redacts tokens and handles thrown network exceptions gracefully without losing successful accounts', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({
            files: [
              { auth_index: 'good-acc', provider: 'codex', email: 'good@test.com' },
              { auth_index: 'leak-acc', provider: 'codex', email: 'leak@test.com' },
              { auth_index: 'throw-acc', provider: 'codex', email: 'throw@test.com' },
            ],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
      }
      if (url.includes('/api-call')) {
        const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : {};
        if (body.auth_index === 'good-acc') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 200,
              body: { rate_limit: { primary_window: { used_percent: 20 } } },
            }),
          };
        }
        if (body.auth_index === 'leak-acc') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 401,
              body: JSON.stringify({
                error: {
                  message: 'Unauthorized with Authorization: Basic dXNlcjpwYXNz and Bearer sk-ant-secret12345678901234567890123456',
                },
              }),
            }),
          };
        }
        if (body.auth_index === 'throw-acc') {
          throw new Error('Socket abruptly disconnected');
        }
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    const text = wrapper.text();
    // Good account is still visible!
    expect(text).toContain('good@test.com');
    expect(text).toContain('80%');

    // Thrown account is caught and given clean message
    expect(text).toContain('throw@test.com');
    expect(text).toContain('Failed to query quota');

    // Leaked token is redacted
    expect(text).toContain('leak@test.com');
    expect(text).not.toContain('dXNlcjpwYXNz');
    expect(text).not.toContain('sk-ant-secret');
    expect(text).toContain('[REDACTED]');
  });
});

describe('Ticket 04: Add Claude OAuth quota support', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
    await fakeBrowser.storage.local.set({
      cpa_base_url: 'http://127.0.0.1:8317',
      cpa_management_key: 'test-key',
    });
  });

  it('queries Claude OAuth endpoint via api-call with beta header, normalizes 5-hour and 7-day windows, and ignores API-key accounts', async () => {
    const apiCallsMade: Array<{ auth_index?: string; url?: string; header?: Record<string, string> }> = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({
            files: [
              { auth_index: 'claude-oauth', provider: 'claude', email: 'claude-oauth@anthropic.com' },
              { auth_index: 'claude-apikey', provider: 'claude', email: 'apikey@anthropic.com', account_type: 'api-key' },
              { auth_index: 'claude-apikey2', provider: 'claude', email: 'apikey2@anthropic.com', account_type: 'api_key' },
              { auth_index: 'claude-dis', provider: 'claude', email: 'dis@anthropic.com', disabled: true },
            ],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
      }
      if (url.includes('/api-call')) {
        const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : {};
        apiCallsMade.push(body);

        if (body.url.includes('/api/oauth/usage')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 200,
              body: JSON.stringify({
                five_hour: {
                  utilization: 25,
                  resets_at: new Date(Date.now() + 7200 * 1000).toISOString(),
                },
                seven_day: {
                  utilization: 0.6, // float 0.6 -> 60% used -> 40% remaining
                  resets_at: new Date(Date.now() + 86400 * 1000).toISOString(),
                },
              }),
            }),
          };
        }
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    // Verify api-call parameters for Claude
    expect(apiCallsMade.length).toBe(1);
    expect(apiCallsMade[0]?.auth_index).toBe('claude-oauth');
    expect(apiCallsMade[0]?.url).toBe('https://api.anthropic.com/api/oauth/usage');
    expect(apiCallsMade[0]?.header?.['anthropic-beta']).toBe('oauth-2025-04-20');
    expect(apiCallsMade[0]?.header?.Authorization).toBe('Bearer $TOKEN$');

    const text = wrapper.text();
    expect(text).toContain('claude-oauth@anthropic.com');
    expect(text).toContain('75%'); // 100 - 25
    expect(text).toContain('40%'); // 100 - 60
    expect(text).toContain('5-hour');
    expect(text).toContain('7-day');

    // Disabled account visible with badge, not queried
    expect(text).toContain('dis@anthropic.com');
    expect(text).toContain('[disabled]');

    // API key account completely excluded from Claude OAuth group
    expect(text).not.toContain('apikey@anthropic.com');
    expect(text).not.toContain('apikey2@anthropic.com');
  });

  it('preserves Partial Quota Snapshot when Claude fails alongside successful Codex account', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({
            files: [
              { auth_index: 'codex-good', provider: 'codex', email: 'codex@good.com' },
              { auth_index: 'claude-bad', provider: 'claude', email: 'claude@bad.com' },
            ],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
      }
      if (url.includes('/api-call')) {
        const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : {};
        if (body.auth_index === 'codex-good') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 200,
              body: { rate_limit: { primary_window: { used_percent: 10 } } },
            }),
          };
        }
        if (body.auth_index === 'claude-bad') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 503,
              body: JSON.stringify({ error: { message: 'Anthropic service overloaded' } }),
            }),
          };
        }
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    const text = wrapper.text();
    // Codex is working
    expect(text).toContain('codex@good.com');
    expect(text).toContain('90%');

    // Claude error is isolated
    expect(text).toContain('claude@bad.com');
    expect(text).toContain('Anthropic service overloaded');
  });
});

describe('Ticket 05: Add Antigravity quota-family support', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
    await fakeBrowser.storage.local.set({
      cpa_base_url: 'http://127.0.0.1:8317',
      cpa_management_key: 'test-key',
    });
  });

  it('resolves project id if missing, falls back to secondary endpoint, and aggregates into Claude & GPT and Gemini families', async () => {
    const apiCallsMade: Array<{ url?: string; data?: string; auth_index?: string }> = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({
            files: [
              { auth_index: 'anti-1', provider: 'antigravity', email: 'anti@google.com' },
            ],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
      }
      if (url.includes('/api-call')) {
        const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : {};
        apiCallsMade.push(body);

        if (body.url.includes(':loadCodeAssist')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 200,
              body: JSON.stringify({
                cloudaicompanionProject: { id: 'discovered-project-123' },
              }),
            }),
          };
        }

        // Primary fetchAvailableModels fails (500), forcing fallback to secondary
        if (body.url === 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 500,
              body: 'Internal Server Error',
            }),
          };
        }

        // Secondary daily-cloudcode-pa succeeds!
        if (body.url === 'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              statusCode: 200,
              body: JSON.stringify({
                models: {
                  'claude-4-6-sonnet': {
                    quotaInfo: {
                      remainingFraction: 0.8,
                      resetTime: new Date(Date.now() + 7200 * 1000).toISOString(),
                    },
                  },
                  'gpt-4.6-turbo': {
                    quota_info: {
                      remaining_fraction: '0.35',
                      reset_time: 0,
                    },
                  },
                  'gemini-3-pro': {
                    quotaInfo: {
                      remainingFraction: 0.9,
                      resetTime: new Date(Date.now() + 10000 * 1000).toISOString(),
                    },
                  },
                  'gemini-3-flash': {
                    quota_info: {
                      remaining: '0.5',
                      resetTime: `${Math.floor(Date.now() / 1000) + 5000}.5`,
                    },
                  },
                  'unrelated-model-xyz': { remainingFraction: 0.05 },
                },
              }),
            }),
          };
        }
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    // Verify project discovery call was made with $TOKEN$
    expect(apiCallsMade.some((c) => c.url?.includes(':loadCodeAssist'))).toBe(true);

    // Verify fallback endpoint was called with discovered project ID
    const fallbackCall = apiCallsMade.find((c) => c.url?.includes('daily-cloudcode-pa'));
    expect(fallbackCall).toBeDefined();
    expect(fallbackCall?.data).toContain('discovered-project-123');

    const text = wrapper.text();
    expect(text).toContain('anti@google.com');

    // "Claude & GPT models": lowest of 0.8 and 0.35 -> 35%
    expect(text).toContain('Claude & GPT models');
    expect(text).toContain('35%');

    // "Gemini models": lowest of 0.9 and 0.5 -> 50%
    expect(text).toContain('Gemini models');
    expect(text).toContain('50%');

    // Unrelated model was ignored
    expect(text).not.toContain('unrelated-model');
  });

  it('reuses existing project_id without loadCodeAssist call and handles account error', async () => {
    const apiCallsMade: Array<{ url?: string }> = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({
            files: [
              {
                auth_index: 'anti-with-project',
                provider: 'antigravity',
                email: 'project-user@google.com',
                project_id: 'pre-existing-project-999',
              },
            ],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
      }
      if (url.includes('/api-call')) {
        const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : {};
        apiCallsMade.push(body);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            status_code: 403,
            body: JSON.stringify({ error: { message: 'Permission denied on Google Cloud project', key: 'leaked_key_value' } }),
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    // loadCodeAssist was NOT called because project_id already existed!
    expect(apiCallsMade.some((c) => c.url?.includes(':loadCodeAssist'))).toBe(false);

    const text = wrapper.text();
    expect(text).toContain('project-user@google.com');
    expect(text).toContain('Permission denied on Google Cloud project');
    expect(text).not.toContain('leaked_key_value');
  });

  it('falls back to empty request data when project discovery yields nothing and flags no supported model quota', async () => {
    const apiCallsMade: Array<{ url?: string; data?: string }> = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth-files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'X-CPA-VERSION': '7.2.0' }),
          json: async () => ({
            files: [
              { auth_index: 'anti-noproject', provider: 'antigravity', email: 'noproject@google.com' },
            ],
          }),
        };
      }
      if (url.includes('/latest-version')) {
        return { ok: true, json: async () => ({ 'latest-version': 'v7.2.0' }) };
      }
      if (url.includes('/api-call')) {
        const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : {};
        apiCallsMade.push(body);

        if (body.url.includes(':loadCodeAssist')) {
          // loadCodeAssist returns empty/no companion project
          return {
            ok: true,
            status: 200,
            json: async () => ({ status_code: 200, body: '{}' }),
          };
        }

        if (body.url.includes(':fetchAvailableModels')) {
          // Models returned has no matching Claude 4.6 or Gemini 3 models
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status_code: 200,
              body: JSON.stringify({
                models: {
                  'random-model': { quotaInfo: { remainingFraction: 0.5 } },
                },
              }),
            }),
          };
        }
      }
      return { ok: false, status: 404 };
    });

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.$nextTick();

    // fetchAvailableModels was still called with empty project data "{}"
    const fetchModelCall = apiCallsMade.find((c) => c.url?.includes(':fetchAvailableModels'));
    expect(fetchModelCall).toBeDefined();
    expect(fetchModelCall?.data).toBe('{}');

    const text = wrapper.text();
    expect(text).toContain('noproject@google.com');
    expect(text).toContain('Claude & GPT models');
    expect(text).toContain('Gemini models');
    expect(text).toContain('no supported model quota returned');
  });
});
