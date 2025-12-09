import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'react-simple-maps',
      'recharts',
      'react-dropzone',
    ],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Ensure pdfjs-dist uses the correct path
      'pdfjs-dist/legacy/build/pdf.mjs': 'pdfjs-dist/build/pdf.mjs',
    },
  },
  build: {
    commonjsOptions: {
      include: [/lucide-react/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host:"127.0.0.1",
    strictPort: false,
    hmr: {
      overlay: true,
    },
  },
});
