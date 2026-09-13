import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  manifest: {
    name: 'CLI Proxy API Quotas',
    description: 'CLI Proxy API Quotas',
    permissions: ['storage'],
    optional_host_permissions: [
      'https://*/*',
    ],
  },
  webExt: {
    disabled: true,
  },
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
