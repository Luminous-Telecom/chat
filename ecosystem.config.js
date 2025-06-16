module.exports = {
  apps: [
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