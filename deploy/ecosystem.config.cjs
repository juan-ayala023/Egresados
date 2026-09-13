// =============================================================================
// pm2: los dos procesos de Homecoming 80 Años.
//
// Se suman al pm2 que ya corre en el servidor (el servicio pm2-eventos), al
// lado de la app del colegio. NO se reemplaza nada de lo que ya hay.
//
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save               <- para que vuelvan a arrancar si se reinicia
//
// Los puertos: 4000 para la API y 3002 para el sitio. El 3001 lo usa la app
// del colegio y el 8000 es FastAPI_TCS (gunicorn). Ninguno se pisa.
// =============================================================================
const RAIZ = __dirname + '/..'

module.exports = {
  apps: [
    {
      name: 'homecoming-api',
      cwd: RAIZ + '/back-homeparty-main',
      script: 'src/server.js',
      // El .env lo lee el propio backend desde su carpeta (dotenv).
      env: { NODE_ENV: 'production' },
      // Si se cae, vuelve. Si se cae en bucle, pm2 espera antes de insistir.
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // La base es un archivo: UN solo proceso. Dos procesos con SQLite en
      // el mismo archivo se pisan las reservas de cupo.
      instances: 1,
      exec_mode: 'fork',
      out_file: RAIZ + '/logs/api.log',
      error_file: RAIZ + '/logs/api.error.log',
      time: true,
    },
    {
      name: 'homecoming-web',
      cwd: RAIZ,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      instances: 1,
      exec_mode: 'fork',
      out_file: RAIZ + '/logs/web.log',
      error_file: RAIZ + '/logs/web.error.log',
      time: true,
    },
  ],
}
