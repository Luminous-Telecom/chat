module.exports = [
  {
    script: "node_modules/.bin/ts-node-dev",
    args: "--inspect=9229 --respawn --transpile-only --ignore node_modules src/server.ts",
    name: "izing-backend-dev",
    exec_mode: "fork",
    instances: 1,
    env: {
      NODE_ENV: "development"
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_file: "./logs/pm2-combined.log",
    time: true
  }
];
