module.exports = {
  apps: [{
    name: "izing-backend-dev",
    script: "dist/server.js",
    exec_mode: "cluster",
    instances: 1,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "development",
      NODE_OPTIONS: "--max-old-space-size=4096"
    },
    env_production: {
      NODE_ENV: "production",
      NODE_OPTIONS: "--max-old-space-size=4096"
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_file: "./logs/pm2-combined.log",
    time: true,
    // Otimizações para inicialização mais rápida
    wait_ready: true, // Aguarda o sinal 'ready' do processo
    listen_timeout: 30000, // 30 segundos para iniciar
    kill_timeout: 5000, // 5 segundos para encerrar
    restart_delay: 1000, // 1 segundo entre tentativas de reinício
    max_restarts: 3, // Máximo de 3 tentativas de reinício
    // Configurações de performance
    node_args: [
      "--optimize-for-size",
      "--max-old-space-size=4096",
      "--gc-interval=100"
    ],
    // Ignorar arquivos desnecessários
    ignore_watch: [
      "node_modules",
      "dist",
      "logs",
      "*.log",
      ".git",
      "coverage",
      ".nyc_output"
    ]
  }]
}; 