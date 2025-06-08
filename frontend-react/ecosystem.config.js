module.exports = [
  {
    script: "npm",
    args: "start",
    name: "izing-frontend-react-dev",
    exec_mode: "fork",
    instances: 1,
    watch: false,
    watch_delay: 1000,
    ignore_watch: [
      "node_modules",
      "dist",
      "build",
      "*.log",
      ".git",
      "coverage",
      ".nyc_output",
      "public"
    ],
    env: {
      NODE_ENV: "development"
    },
    env_development: {
      NODE_ENV: "development"
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_file: "./logs/pm2-combined.log",
    time: true,
    restart_delay: 4000
  }
];