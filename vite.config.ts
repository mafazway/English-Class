import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');
  
  // Vercel injects env vars into process.env, so we fallback to it.
  const apiKey = env.API_KEY || process.env.API_KEY || '';

  return {
    plugins: [react()],
    server: {
      host: true,
    },
    define: {
      // Safely inject the API key as a string replacement.
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Prevent crash if a library accesses process.env directly
      'process.env': JSON.stringify({}), 
    }
  };
});