import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: No API key is baked into the build (the original config injected
// GEMINI_API_KEY at build time, which ships the key to every visitor).
// Gemini stays optional and session-only, entered by the user in the app.
export default defineConfig({
  // GitHub Pages serves this repo under /Skibidi-Sigma-IQ/; local dev stays at /.
  base: process.env.GITHUB_ACTIONS ? '/Skibidi-Sigma-IQ/' : '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
