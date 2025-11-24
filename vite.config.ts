import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js']
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    host: true, // Permite acesso via IP na rede local durante desenvolvimento
  }
});
