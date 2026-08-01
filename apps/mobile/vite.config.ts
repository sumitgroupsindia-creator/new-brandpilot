import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brandpilot/web': path.resolve(__dirname, '../web/src'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
