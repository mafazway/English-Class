import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      hmr: {
        clientPort: 443,
      }
    },
    define: {
      // Safely inject the API key. 
      // NOTE: We do NOT define 'process.env': {} as it breaks other libraries.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    }
  };
});