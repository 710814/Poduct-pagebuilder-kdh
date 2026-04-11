import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // 보안 강화: API 키는 클라이언트 번들에 포함하지 않음
      // 대신 환경 변수(VITE_ 접두사)를 통해 런타임에 주입
      // 또는 GAS 프록시를 통해 서버 사이드에서만 사용
      define: {
        // API 키는 더 이상 번들에 포함하지 않음
        // 필요시 VITE_GEMINI_API_KEY 환경 변수 사용
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // 번들 최적화 설정
        rollupOptions: {
          output: {
            // 청크 분할 전략
            manualChunks: {
              // 벤더 라이브러리 분리
              'vendor-react': ['react', 'react-dom'],
              'vendor-ui': ['lucide-react'],
              'vendor-utils': ['jszip', 'file-saver'],
              // 서비스 분리
              'services': [
                './services/geminiService',
                './services/firebaseService',
                './services/templateService'
              ],
            },
          },
        },
        // 청크 크기 경고 임계값 (500KB)
        chunkSizeWarningLimit: 500,
        // 소스맵 생성 (프로덕션에서는 false 권장)
        sourcemap: mode === 'development',
      },
    };
});
