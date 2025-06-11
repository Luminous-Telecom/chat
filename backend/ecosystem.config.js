module.exports = {
  apps: [
    {
      name: "izing-backend-dev",
      script: 'npm',
      args: 'run dev:server',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      error_file: './logs/pm2-error-dev.log',
      out_file: './logs/pm2-out-dev.log',
      log_file: './logs/pm2-combined-dev.log',
      time: true
    }
  ],
  deploy: {
    production: {
      name: "izing-backend-prod",
      script: "dist/server.js",
      exec_mode: "cluster",
      instances: "max",
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-error-prod.log',
      out_file: './logs/pm2-out-prod.log',
      log_file: './logs/pm2-combined-prod.log',
      time: true,
      cron_restart: "00 00 * * *"
    }
  }
};
