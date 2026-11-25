import http from 'node:http';
import path from 'node:path';
import express from 'express';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: 'simulator',
      timestamp: Date.now(),
    });
  });

  const server = http.createServer(app);

  if (IS_PROD) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
      plugins: [
        {
          name: 'disable-vite-client-hmr-ws',
          transform(code, id) {
            if (id.replace(/\\/g, '/').endsWith('/vite/dist/client/client.mjs')) {
              return code.replace(
                /const transport = normalizeModuleRunnerTransport\([\s\S]*?let willUnload = false;/,
                `const transport = normalizeModuleRunnerTransport({
  async connect() {},
  async disconnect() {},
  send() {},
});
let willUnload = false;`,
              );
            }
          },
        },
      ],
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex World Simulator server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
