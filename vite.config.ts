import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/csindex-api': {
          target: 'https://www.csindex.com.cn',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/csindex-api/, ''),
          secure: true,
        },
        '/sina-api': {
          target: 'https://vip.stock.finance.sina.com.cn',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/sina-api/, ''),
          secure: false,
        },
        '/dj-api': {
          target: 'https://danjuanfunds.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/dj-api/, ''),
          secure: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://danjuanfunds.com/',
          },
        },
        '/djapi': {
          target: 'https://danjuanfunds.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/djapi/, '/djapi'),
          secure: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://danjuanfunds.com/',
          },
        },
      },
    },
  };
});
