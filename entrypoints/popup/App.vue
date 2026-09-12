<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import {
  STORAGE_KEY_BASE_URL,
  STORAGE_KEY_MANAGEMENT_KEY,
  validateAndNormalizeUrl,
  saveConnection,
  clearConnection,
} from '@/utils/connection';
import { discoverProviderAccounts, checkLatestVersion } from '@/services/quota';
import {
  type ProviderGroup,
  formatCountdown,
  formatLocalResetTime,
} from '@/utils/providers';

const baseUrl = ref('http://127.0.0.1:8317');
const managementKey = ref('');
const savedBaseUrl = ref<string | null>(null);
const savedManagementKey = ref<string | null>(null);

const showKey = ref(false);
const showSettings = ref(false);
const loading = ref(false);
const errorMsg = ref<string | null>(null);

// Discovery & Quota state
const groups = ref<ProviderGroup[]>([]);
const currentVersion = ref<string | undefined>(undefined);
const latestVersion = ref<string | undefined>(undefined);
const updateAvailable = ref(false);
const refreshing = ref(false);
const discoveryError = ref<string | null>(null);

// Error details expansion map by authIndex
const expandedErrors = ref<Record<string, boolean>>({});

// Timer for local countdown updates (10s interval, no network)
const currentTime = ref(Date.now());
let countdownInterval: ReturnType<typeof setInterval> | null = null;

let activeAbortController: AbortController | null = null;

async function runRefresh(): Promise<void> {
  if (!savedBaseUrl.value || !savedManagementKey.value) return;
  if (refreshing.value) return; // deduplicate in-flight

  refreshing.value = true;
  discoveryError.value = null;
  latestVersion.value = undefined;
  updateAvailable.value = false;
  groups.value = [];
  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();

  try {
    const res = await discoverProviderAccounts(
      savedBaseUrl.value,
      savedManagementKey.value,
      activeAbortController.signal
    );

    if (!res.ok) {
      discoveryError.value = res.error ?? 'Failed to load quota snapshot';
      groups.value = [];
      return;
    }

    groups.value = res.groups;
    currentVersion.value = res.currentVersion;

    // Fire independent, non-blocking version check with discovered currentVersion
    checkLatestVersion(
      savedBaseUrl.value,
      savedManagementKey.value,
      res.currentVersion,
      activeAbortController.signal
    )
      .then((verRes) => {
        if (verRes.latestVersion) {
          latestVersion.value = verRes.latestVersion;
          updateAvailable.value = verRes.updateAvailable;
        }
      })
      .catch(() => {});

  } finally {
    refreshing.value = false;
  }
}

async function loadSavedConfig(): Promise<void> {
  const stored = await browser.storage.local.get([STORAGE_KEY_BASE_URL, STORAGE_KEY_MANAGEMENT_KEY]);
  const storedUrl = stored[STORAGE_KEY_BASE_URL];
  const storedKey = stored[STORAGE_KEY_MANAGEMENT_KEY];

  if (typeof storedUrl === 'string' && typeof storedKey === 'string' && storedUrl && storedKey) {
    savedBaseUrl.value = storedUrl;
    savedManagementKey.value = storedKey;
    baseUrl.value = storedUrl;
    managementKey.value = storedKey;
    await runRefresh();
  } else {
    savedBaseUrl.value = null;
    savedManagementKey.value = null;
    groups.value = [];
  }
}

onMounted(() => {
  loadSavedConfig();
  countdownInterval = setInterval(() => {
    currentTime.value = Date.now();
  }, 10_000);
});

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  if (activeAbortController) {
    activeAbortController.abort();
  }
});

async function handleSave(): Promise<void> {
  errorMsg.value = null;
  loading.value = true;

  if (activeAbortController) {
    activeAbortController.abort();
  }
  refreshing.value = false;
  activeAbortController = new AbortController();
  const candidateUrl = baseUrl.value;
  const candidateKey = managementKey.value;
  const oldUrl = savedBaseUrl.value ?? undefined;

  try {
    const res = await saveConnection(
      candidateUrl,
      candidateKey,
      oldUrl,
      activeAbortController.signal
    );
    if (!res.ok) {
      errorMsg.value = res.error ?? 'Connection failed';
      return;
    }

    const norm = validateAndNormalizeUrl(candidateUrl);
    const trimmedKey = candidateKey.trim();
    baseUrl.value = norm.normalized ?? candidateUrl;
    managementKey.value = trimmedKey;
    savedBaseUrl.value = norm.normalized ?? candidateUrl;
    savedManagementKey.value = trimmedKey;
    showSettings.value = false;

    // Reset previous snapshot state before loading from the new connection
    groups.value = [];
    currentVersion.value = undefined;
    latestVersion.value = undefined;
    updateAvailable.value = false;
    discoveryError.value = null;

    await runRefresh();
  } finally {
    loading.value = false;
  }
}

async function handleClear(): Promise<void> {
  if (loading.value) return;
  if (activeAbortController) {
    activeAbortController.abort();
  }
  refreshing.value = false;
  loading.value = true;
  try {
    await clearConnection(savedBaseUrl.value ?? undefined);
    savedBaseUrl.value = null;
    savedManagementKey.value = null;
    baseUrl.value = 'http://127.0.0.1:8317';
    managementKey.value = '';
    showSettings.value = false;
    errorMsg.value = null;
    groups.value = [];
    currentVersion.value = undefined;
    latestVersion.value = undefined;
    updateAvailable.value = false;
  } finally {
    loading.value = false;
  }
}

function getProgressColor(percent: number | null): string {
  if (percent === null) return 'bg-zinc-400';
  if (percent > 50) return 'bg-emerald-500';
  if (percent > 20) return 'bg-amber-500';
  return 'bg-rose-500';
}

function getTextColor(percent: number | null): string {
  if (percent === null) return 'text-zinc-500';
  if (percent > 50) return 'text-emerald-600 dark:text-emerald-400';
  if (percent > 20) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}
</script>

<template>
  <main class="w-[400px] max-h-[600px] overflow-y-auto p-4 text-sm font-sans bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
    <!-- Header -->
    <header class="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200 dark:border-zinc-800">
      <div class="flex items-center gap-2">
        <h1 class="font-bold text-base">CLI Proxy API Quotas</h1>
      </div>

      <div class="flex items-center gap-2">
        <!-- Version Info -->
        <span
          v-if="updateAvailable && currentVersion && latestVersion"
          class="text-xs text-amber-600 dark:text-amber-400 font-mono"
        >
          {{ currentVersion }} → {{ latestVersion }} available
        </span>
        <span
          v-else-if="currentVersion"
          class="text-xs text-zinc-400 font-mono"
        >
          v{{ currentVersion }}
        </span>

        <!-- Refresh button -->
        <button
          v-if="savedBaseUrl && !showSettings"
          type="button"
          data-testid="refresh-btn"
          :disabled="refreshing"
          class="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Refresh"
          @click="runRefresh"
        >
          🔄
        </button>

        <!-- Settings button -->
        <button
          v-if="savedBaseUrl || showSettings"
          type="button"
          data-testid="settings-btn"
          :disabled="refreshing || loading"
          class="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Settings"
          @click="showSettings = !showSettings"
        >
          ⚙️
        </button>
      </div>
    </header>

    <!-- Settings / First-run Form -->
    <div v-if="!savedBaseUrl || showSettings" class="space-y-4">
      <div>
        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
          {{ savedBaseUrl ? 'Connection Settings' : 'Connect to CLIProxyAPI' }}
        </h2>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
          Enter the management URL and secret key for your CLIProxyAPI instance.
        </p>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium mb-1 text-zinc-700 dark:text-zinc-300">Base URL</label>
          <input
            v-model="baseUrl"
            data-testid="base-url"
            type="text"
            placeholder="http://127.0.0.1:8317"
            :disabled="loading"
            class="w-full px-3 py-1.5 border rounded text-xs bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label class="block text-xs font-medium mb-1 text-zinc-700 dark:text-zinc-300">Management Key</label>
          <div class="relative">
            <input
              v-model="managementKey"
              data-testid="management-key"
              :type="showKey ? 'text' : 'password'"
              placeholder="Enter secret key"
              :disabled="loading"
              class="w-full pl-3 pr-10 py-1.5 border rounded text-xs bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              data-testid="toggle-key-visibility"
              :disabled="loading"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-50"
              @click="showKey = !showKey"
            >
              {{ showKey ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>

        <div v-if="errorMsg" class="p-2 text-xs rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900">
          {{ errorMsg }}
        </div>

        <div class="flex items-center justify-between pt-2">
          <div class="flex gap-2">
            <button
              type="button"
              data-testid="save-btn"
              :disabled="loading"
              class="px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              @click="handleSave"
            >
              {{ loading ? 'Testing & Saving…' : 'Save & Test' }}
            </button>
            <button
              v-if="savedBaseUrl && showSettings"
              type="button"
              :disabled="loading"
              class="px-3 py-1.5 rounded text-xs border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
              @click="showSettings = false; errorMsg = null"
            >
              Cancel
            </button>
          </div>

          <button
            v-if="savedBaseUrl"
            type="button"
            data-testid="clear-btn"
            :disabled="loading || refreshing"
            class="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            @click="handleClear"
          >
            Clear configuration
          </button>
        </div>
      </div>
    </div>

    <!-- Dashboard View -->
    <div v-else class="space-y-4">
      <!-- Global Discovery Error -->
      <div
        v-if="discoveryError"
        class="p-3 bg-red-50 dark:bg-red-950/40 rounded border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-2"
      >
        <div class="font-medium flex items-center justify-between">
          <span>Failed to load accounts</span>
          <button
            type="button"
            class="underline text-[11px] hover:opacity-80"
            @click="runRefresh"
          >
            Retry
          </button>
        </div>
        <p class="text-zinc-600 dark:text-zinc-400">{{ discoveryError }}</p>
      </div>

      <!-- Loading state on initial refresh -->
      <div v-else-if="refreshing" class="py-8 text-center text-xs text-zinc-500">
        Loading provider accounts…
      </div>

      <!-- Empty state -->
      <div v-else-if="groups.length === 0" class="py-8 text-center text-xs text-zinc-500">
        No supported provider accounts found.
      </div>

      <!-- Provider Groups -->
      <div v-else class="space-y-4">
        <section v-for="group in groups" :key="group.provider" class="space-y-2">
          <h2 class="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {{ group.title }}
          </h2>

          <div class="space-y-2.5">
            <div
              v-for="account in group.accounts"
              :key="account.authIndex"
              class="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2.5"
            >
              <!-- Account Header -->
              <div class="flex items-center justify-between">
                <span class="font-medium text-xs truncate max-w-[260px]" :title="account.displayName">
                  {{ account.displayName }}
                </span>
                <div class="flex items-center gap-1.5">
                  <span
                    v-if="account.manualResetCredits !== undefined"
                    class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                  >
                    {{ account.manualResetCredits }} credits
                  </span>
                  <span
                    v-if="account.statusBadge"
                    class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                  >
                    {{ account.statusBadge }}
                  </span>
                </div>
              </div>

              <!-- Quota Windows -->
              <div v-if="account.windows && account.windows.length > 0" class="space-y-2 pt-1">
                <div v-for="win in account.windows" :key="win.label" class="space-y-1">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-zinc-600 dark:text-zinc-400 font-medium">{{ win.label }}</span>
                    <div class="flex items-center gap-2">
                      <span
                        v-if="win.resetAt"
                        class="text-[10px] text-zinc-400 dark:text-zinc-500"
                        :title="formatLocalResetTime(win.resetAt)"
                      >
                        {{ formatCountdown(win.resetAt, currentTime) }}
                      </span>
                      <span :class="['font-mono font-semibold', getTextColor(win.remainingPercent)]">
                        {{ win.remainingPercent !== null ? `${win.remainingPercent}%` : '—' }}
                      </span>
                    </div>
                  </div>

                  <!-- Progress Bar -->
                  <div class="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      :class="['h-full rounded-full transition-all duration-300', getProgressColor(win.remainingPercent)]"
                      :style="{ width: `${win.remainingPercent ?? 0}%` }"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Account-level Error -->
              <div v-else-if="account.error" class="pt-1 text-xs text-red-600 dark:text-red-400 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="truncate">{{ account.error.message }}</span>
                  <button
                    v-if="account.error.status || account.error.code"
                    type="button"
                    class="text-[10px] text-zinc-500 underline ml-2 shrink-0"
                    @click="expandedErrors[account.authIndex] = !expandedErrors[account.authIndex]"
                  >
                    {{ expandedErrors[account.authIndex] ? 'Hide Details' : 'Details' }}
                  </button>
                </div>
                <div
                  v-if="expandedErrors[account.authIndex]"
                  class="text-[10px] font-mono p-1.5 rounded bg-red-100/50 dark:bg-red-950/50 text-zinc-700 dark:text-zinc-300"
                >
                  <div v-if="account.error.status">HTTP Status: {{ account.error.status }}</div>
                  <div v-if="account.error.code">Code: {{ account.error.code }}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>
