// PM2 — processos do Arqueia na VM (sem Docker).
// Uso:
//   pm2 start infrastructure/pm2/ecosystem.config.js
//   pm2 save && pm2 startup
//
// Portas: api 4001, web 4002 (cp2b usa 3001). Ajuste conforme .env.
module.exports = {
  apps: [
    {
      name: 'arqueia-api',
      cwd: './apps/api',
      script: 'dist/main.js',      // build do Nest
      instances: 1,
      env: { NODE_ENV: 'production', API_PORT: 4001 },
      max_memory_restart: '600M',
    },
    {
      name: 'arqueia-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4002',       // Next em produção
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '800M',
    },
    {
      name: 'arqueia-worker',
      cwd: './apps/worker',
      script: 'dist/main.js',      // consumidor de filas Redis
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
  ],
};
