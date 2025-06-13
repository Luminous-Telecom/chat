module.exports = {
  apps: [
    {
      name: "izing-backend",
      script: "dist/server.js",
      exec_mode: "cluster",
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      cron_restart: "00 00 * * *"
    }
  ]
};
