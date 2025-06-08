#!/bin/bash

# Script para gerenciar o desenvolvimento com PM2
# Uso: ./pm2-dev.sh [start|stop|restart|status|logs]

COMMAND=${1:-start}

case $COMMAND in
  "start")
    echo "🚀 Iniciando todos os serviços de desenvolvimento..."
    node start-dev.js
    ;;
  "stop")
    echo "🛑 Parando todos os serviços..."
    pm2 delete all
    ;;
  "restart")
    echo "🔄 Reiniciando todos os serviços..."
    pm2 restart all
    ;;
  "status")
    echo "📊 Status dos serviços:"
    pm2 status
    ;;
  "logs")
    echo "📝 Logs dos serviços (Ctrl+C para sair):"
    pm2 logs
    ;;
  "backend")
    echo "🔧 Iniciando apenas o backend..."
    cd backend && pm2 start ecosystem.config.js
    ;;
  "vue")
    echo "🔧 Iniciando apenas o frontend Vue..."
    cd frontend-vue && pm2 start ecosystem.config.js
    ;;
  "react")
    echo "🔧 Iniciando apenas o frontend React..."
    cd frontend-react && pm2 start ecosystem.config.js
    ;;
  "help")
    echo "📖 Comandos disponíveis:"
    echo "  start   - Inicia todos os serviços"
    echo "  stop    - Para todos os serviços"
    echo "  restart - Reinicia todos os serviços"
    echo "  status  - Mostra status dos serviços"
    echo "  logs    - Mostra logs em tempo real"
    echo "  backend - Inicia apenas o backend"
    echo "  vue     - Inicia apenas o frontend Vue"
    echo "  react   - Inicia apenas o frontend React"
    echo "  help    - Mostra esta ajuda"
    ;;
  *)
    echo "❌ Comando inválido: $COMMAND"
    echo "Use: ./pm2-dev.sh help para ver os comandos disponíveis"
    exit 1
    ;;
esac