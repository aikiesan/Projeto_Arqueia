// PM2 — processos do Arqueia na VM (sem Docker).
// Uso:
//   pm2 start infrastructure/pm2/ecosystem.config.js
//   pm2 save && pm2 startup
//
// Execute a partir de /data/arqueia/repo como o usuário lucas.
module.exports = {
  apps: [
    {
      name: 'arqueia-api',
      cwd: '/data/arqueia/repo/apps/api',
      script: 'dist/main.js',      // build do Nest
      instances: 1,
      env: { NODE_ENV: 'production', API_PORT: 4001 },
      max_memory_restart: '600M',
    },
    {
      name: 'arqueia-web',
      cwd: '/data/arqueia/repo/apps/web',
      script: '/data/arqueia/repo/node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 4002', // Somente o Apache expõe o Next em produção
      instances: 1,
      env: { NODE_ENV: 'production', NEXT_PUBLIC_BASE_PATH: '/arqueia' },
      max_memory_restart: '800M',
    },
    {
      name: 'arqueia-worker',
      cwd: '/data/arqueia/repo/apps/worker',
      script: 'dist/main.js',      // consumidor de filas Redis
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
  ],
};
