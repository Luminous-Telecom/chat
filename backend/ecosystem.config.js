module.exports = [
  {
    script: "node_modules/.bin/ts-node-dev",
    args: "--respawn --transpile-only --ignore node_modules src/server.ts",
    name: "izing-backend-dev",
    exec_mode: "fork",
    instances: 1,
    env: {
      NODE_ENV: "development",
      NODE_OPTIONS: "--max-old-space-size=4096",
      FRONTEND_URL_REACT: "http://devfront.fenixnetcom.com.br:4000",
      FRONTEND_URL_VUE: "http://devfront.fenixnetcom.com.br:8080"
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_file: "./logs/pm2-combined.log",
    time: true,
    max_memory_restart: "1G"
  }
];
