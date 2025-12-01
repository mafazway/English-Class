
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Vercel injects env vars into process.env, so we fallback to it
  const apiKey = env.API_KEY || process.env.API_KEY;

  return {
    plugins: [react()],
    server: {
      host: true, // Listen on all addresses
      hmr: {
        clientPort: 443,
      }
    },
    define: {
      // Safely inject the API key as a string
      'process.env.API_KEY': JSON.stringify(apiKey),
    }
  };
});
