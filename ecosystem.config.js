// PM2 process definition for the OctaneRPG Discord bot.
//
//   cd <repo root>            (e.g. ~/OctaneRPG)
//   pm2 start ecosystem.config.js
//   pm2 save
//
// The bot reads its settings from bot/.env (never committed). `cwd` is resolved from this file, so the repo can live
// anywhere. `NODE_ENV=production` selects TOKEN_PROD / CLIENT_ID_PROD (see bot/bot.js).
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'octanerpg',
      cwd: path.join(__dirname, 'bot'),
      script: 'bot.js',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      max_memory_restart: '400M',
      time: true,
    },
  ],
};
