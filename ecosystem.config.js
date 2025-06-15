module.exports = {
  apps: [
    {
      name: 'chat-backend-prod',
      script: './dist/server.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      watch: false,
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100
    },
    {
      name: 'chat-backend-dev',
      script: './dist/server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: true,
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'logs', '.git'],
      watch_options: {
        followSymlinks: false
      }
    },
    {
      name: 'chat-frontend-prod',
      script: 'serve',
      env_production: {
        NODE_ENV: 'production',
        PM2_SERVE_PATH: './frontend/build',
        PM2_SERVE_PORT: 80,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html'
      },
      watch: false
    },
    {
      name: 'chat-frontend-dev',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      env_development: {
        NODE_ENV: 'development',
        PORT: 3002
      },
      watch: false,
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'build', '.git'],
      watch_options: {
        followSymlinks: false
      }
    }
  ]
};