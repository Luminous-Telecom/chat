# 🚀 Desenvolvimento com PM2 - Projeto Izing

Este guia explica como usar o PM2 para executar os serviços de desenvolvimento do projeto Izing, substituindo o `npm start` tradicional.

## 📋 Pré-requisitos

- Node.js (versão 18 ou superior)
- PM2 instalado globalmente: `npm install -g pm2`
- Dependências instaladas em todos os projetos

## 🔧 Instalação das Dependências

### Instalar todas as dependências de uma vez:
```bash
npm run install:all
```

### Ou instalar individualmente:
```bash
# Backend
npm run install:backend

# Frontend Vue
npm run install:frontend-vue

# Frontend React
npm run install:frontend-react
```

## 🚀 Iniciando os Serviços

### Iniciar todos os serviços de desenvolvimento:
```bash
npm run dev
```

Este comando irá:
1. Parar todos os processos PM2 existentes
2. Iniciar o backend em modo de desenvolvimento
3. Iniciar o frontend Vue em modo de desenvolvimento
4. Iniciar o frontend React em modo de desenvolvimento

### Iniciar serviços individualmente:
```bash
# Apenas o backend
npm run dev:backend

# Apenas o frontend Vue
npm run dev:frontend-vue

# Apenas o frontend React
npm run dev:frontend-react
```

## 📊 Monitoramento

### Ver status dos serviços:
```bash
npm run status
# ou
pm2 status
```

### Ver logs em tempo real:
```bash
npm run logs
# ou
pm2 logs
```

### Ver logs de um serviço específico:
```bash
pm2 logs izing-backend-dev
pm2 logs izing-frontend-vue-dev
pm2 logs izing-frontend-react-dev
```

## 🔄 Gerenciamento dos Serviços

### Reiniciar todos os serviços:
```bash
npm run restart
# ou
pm2 restart all
```

### Reiniciar um serviço específico:
```bash
pm2 restart izing-backend-dev
pm2 restart izing-frontend-vue-dev
pm2 restart izing-frontend-react-dev
```

### Parar todos os serviços:
```bash
npm run stop
# ou
pm2 delete all
```

### Parar um serviço específico:
```bash
pm2 delete izing-backend-dev
pm2 delete izing-frontend-vue-dev
pm2 delete izing-frontend-react-dev
```

## 🌐 URLs de Acesso

Após iniciar os serviços, você pode acessar:

- **Backend API**: http://localhost:8080 (ou a porta configurada)
- **Frontend Vue**: http://localhost:8081 (ou a porta configurada)
- **Frontend React**: http://localhost:3000 (porta padrão do React)

## 📁 Estrutura dos Arquivos de Configuração

```
izing.open.io/
├── package.json                    # Scripts de desenvolvimento
├── start-dev.js                    # Script principal para iniciar todos os serviços
├── README-DEV.md                   # Este arquivo
├── backend/
│   └── ecosystem.config.js         # Configuração PM2 do backend
├── frontend-vue/
│   └── ecosystem.config.js         # Configuração PM2 do frontend Vue
└── frontend-react/
    └── ecosystem.config.js         # Configuração PM2 do frontend React
```

## 🔧 Configurações Personalizadas

### Backend (ecosystem.config.js)
- Executa: `npm run dev:server`
- Nome do processo: `izing-backend-dev`
- Modo: fork
- Ambiente: development

### Frontend Vue (ecosystem.config.js)
- Executa: `npm run dev`
- Nome do processo: `izing-frontend-vue-dev`
- Modo: fork
- Ambiente: development

### Frontend React (ecosystem.config.js)
- Executa: `npm start`
- Nome do processo: `izing-frontend-react-dev`
- Modo: fork
- Ambiente: development

## 🐛 Solução de Problemas

### Erro: "PM2 not found"
```bash
npm install -g pm2
```

### Erro: "Port already in use"
1. Verifique processos em execução: `pm2 status`
2. Pare todos os processos: `pm2 delete all`
3. Verifique portas em uso: `netstat -tulpn | grep :PORTA`

### Logs não aparecem
```bash
# Verificar se os diretórios de log existem
mkdir -p backend/logs
mkdir -p frontend-vue/logs
mkdir -p frontend-react/logs
```

### Reiniciar PM2 daemon
```bash
pm2 kill
pm2 resurrect
```

## 💡 Vantagens do PM2 para Desenvolvimento

1. **Gerenciamento Centralizado**: Todos os serviços em um só lugar
2. **Logs Organizados**: Logs separados por serviço com timestamps
3. **Auto-restart**: Reinicia automaticamente em caso de falha
4. **Monitoramento**: Status e métricas em tempo real
5. **Facilidade**: Comandos simples para gerenciar múltiplos serviços

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Documentação oficial do PM2: https://pm2.keymetrics.io/
- Issues do projeto Izing