import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode
  const env = loadEnv(mode, process.cwd(), '');

  // Priority: VITE_BACKEND_URL -> BACKEND_URL -> VITE_SOCKET_URL (if local/http) -> http://localhost:5000
  const backendTarget =
    env.VITE_BACKEND_URL ||
    env.BACKEND_URL ||
    (env.VITE_SOCKET_URL && !env.VITE_SOCKET_URL.startsWith('/') ? env.VITE_SOCKET_URL : null) ||
    'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err: any, req: any, res: any) => {
              // If client connection was closed or aborted by browser navigation, ignore client disconnect
              if (req?.destroyed || req?.socket?.destroyed || err?.code === 'ECONNABORTED') {
                return;
              }
              console.error(`[Vite Proxy Error] ${req?.method || 'GET'} ${req?.url || ''} -> ${backendTarget}:`, err.message);
              if (res && 'writeHead' in res && !(res as any).headersSent) {
                (res as any).writeHead(502, { 'Content-Type': 'application/json' });
                (res as any).end(
                  JSON.stringify({
                    success: false,
                    message: 'Backend proxy error: Ensure backend server is running on ' + backendTarget,
                    error: err.message,
                  })
                );
              }
            });
          },
        },
        '/socket.io': {
          target: backendTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err: any, req: any) => {
              // Gracefully handle expected WebSocket connection resets (client tab close / reload)
              if (err?.code === 'ECONNRESET' || err?.code === 'ECONNABORTED' || err?.code === 'EPIPE') {
                return;
              }
              console.error(`[Vite WS Proxy Error] ${req?.url || '/socket.io'}:`, err.message);
            });
            proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
              socket.on('error', (err: any) => {
                // Gracefully handle socket stream reset during tab close / HMR reload
                if (err?.code === 'ECONNRESET' || err?.code === 'ECONNABORTED' || err?.code === 'EPIPE') {
                  return;
                }
                console.error('[Vite WS Proxy Socket Stream Error]:', err.message);
              });
            });
          },
        },
      },
    },
  };
});
