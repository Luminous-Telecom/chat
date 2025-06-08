module.exports = [
  {
    script: "npm",
    args: "run dev:server",
    name: "izing-backend-dev",
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
      ".nyc_output"
    ],
    env: {
      NODE_ENV: "development"
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_file: "./logs/pm2-combined.log",
    time: true,
    restart_delay: 4000
  }
];
