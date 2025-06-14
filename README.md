# IZING - Sistema de Atendimento Multicanal com IA

![IZING Logo](frontend/public/izing-logo_5_transparent.png)

## 📋 Sobre o Projeto

O **IZING** é um sistema completo de atendimento multicanal que integra diferentes plataformas de comunicação com recursos avançados de automação e inteligência artificial. Desenvolvido para empresas que precisam de um atendimento eficiente e centralizado.

## 🚀 Principais Funcionalidades

### 📱 Integrações Multicanal
- **WhatsApp Business** - Integração completa via Baileys
- **Telegram** - Bot integrado para atendimento
- **Instagram** - Mensagens diretas e comentários
- **Facebook Messenger** - Atendimento via Messenger
- **API Externa** - Integração com sistemas terceiros

### 🤖 Automação e IA
- **ChatBot Inteligente** - Fluxos de conversa automatizados
- **Chat Flow Builder** - Construtor visual de fluxos
- **Auto Resposta** - Respostas automáticas configuráveis
- **Mensagens Rápidas** - Templates de mensagens pré-definidas
- **Horário de Atendimento** - Controle automático de disponibilidade

### 👥 Gestão de Atendimento
- **Sistema de Filas** - Distribuição inteligente de tickets
- **Múltiplos Usuários** - Controle de acesso e permissões
- **Tickets** - Sistema completo de gerenciamento de atendimentos
- **Observações** - Anotações internas nos tickets
- **Transferência de Atendimento** - Entre usuários e filas

### 📊 Relatórios e Analytics
- **Dashboard Executivo** - Visão geral dos atendimentos
- **Painel de Atendimentos** - Monitoramento em tempo real
- **Relatório de Contatos** - Análise detalhada da base
- **Estatísticas por Usuário** - Performance individual
- **Relatórios por Etiquetas** - Segmentação avançada
- **Relatórios por Estado** - Análise geográfica

### 📞 Gestão de Contatos
- **Base de Contatos Unificada** - Centralização de todos os canais
- **Etiquetas** - Sistema de categorização
- **Campos Customizados** - Informações personalizadas
- **Importação em Massa** - Upload de contatos via planilha
- **Histórico Completo** - Todas as interações registradas

### 📢 Campanhas e Marketing
- **Campanhas de Mensagens** - Envio em massa
- **Agendamento** - Programação de envios
- **Múltiplas Mensagens** - Sequência de mensagens
- **Mídia Integrada** - Envio de imagens, vídeos e documentos
- **Controle de Contatos** - Gestão de listas de campanhas

### ⚙️ Configurações Avançadas
- **Multi-tenant** - Suporte a múltiplas empresas
- **API Configurável** - Endpoints personalizáveis
- **Webhooks** - Integração com sistemas externos
- **Configurações Globais** - Personalização do sistema
- **Backup Automático** - Segurança dos dados

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** com TypeScript
- **Express.js** - Framework web
- **Sequelize** - ORM para banco de dados
- **PostgreSQL** - Banco de dados principal
- **Redis** - Cache e sessões
- **Bull** - Gerenciamento de filas
- **Socket.io** - Comunicação em tempo real
- **Baileys** - Integração WhatsApp
- **Telegraf** - Bot do Telegram
- **Instagram Private API** - Integração Instagram
- **Messenger API** - Integração Facebook

### Frontend
- **Vue.js 2** - Framework JavaScript
- **Quasar Framework** - Componentes UI
- **Axios** - Cliente HTTP
- **Socket.io Client** - Comunicação em tempo real
- **ApexCharts** - Gráficos e relatórios
- **Vue Router** - Roteamento
- **Vuex** - Gerenciamento de estado

## 📦 Estrutura do Projeto

```
izing/
├── backend/                 # API e serviços backend
│   ├── src/
│   │   ├── controllers/     # Controladores da API
│   │   ├── services/        # Lógica de negócio
│   │   ├── models/          # Modelos do banco de dados
│   │   ├── routes/          # Rotas da API
│   │   ├── libs/            # Bibliotecas e integrações
│   │   ├── jobs/            # Jobs e tarefas assíncronas
│   │   └── utils/           # Utilitários
│   └── package.json
├── frontend/                # Interface do usuário
│   ├── src/
│   │   ├── pages/           # Páginas da aplicação
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── layouts/         # Layouts da aplicação
│   │   ├── router/          # Configuração de rotas
│   │   └── store/           # Gerenciamento de estado
│   └── package.json
└── README.md
```

## 🚀 Como Executar

### Pré-requisitos
- Node.js >= 18
- PostgreSQL
- Redis
- NPM ou Yarn

### Backend
```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev:server
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuração

### Variáveis de Ambiente (Backend)
Crie um arquivo `.env` baseado no `.env.example`:

```env
# Database
DB_HOST=localhost
DB_USER=postgres
DB_PASS=password
DB_NAME=izing

# Redis
REDIS_URI=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# APIs
VUE_FACEBOOK_APP_ID=your-facebook-app-id
```

### Configuração do Frontend
Crie um arquivo `.env` no frontend:

```env
VUE_URL_API=http://localhost:8080
VUE_FACEBOOK_APP_ID=your-facebook-app-id
```

## 📱 Funcionalidades por Módulo

### 🏠 Dashboard
- Visão geral dos atendimentos
- Gráficos de performance
- Métricas em tempo real
- Painel de tickets por fila

### 💬 Atendimento
- Interface de chat unificada
- Suporte a múltiplos canais
- Envio de mídias
- Mensagens rápidas
- Transferência de tickets
- Observações internas

### 👤 Contatos
- Cadastro completo de contatos
- Histórico de conversas
- Etiquetas e categorização
- Campos personalizados
- Importação em massa

### 👥 Usuários
- Gestão de usuários
- Controle de permissões
- Associação a filas
- Relatórios individuais

### 🏷️ Etiquetas
- Sistema de categorização
- Cores personalizadas
- Filtros avançados
- Relatórios por etiqueta

### 📋 Filas
- Distribuição automática
- Horários de funcionamento
- Mensagens de saudação
- Controle de capacidade

### 🤖 Chat Flow
- Construtor visual de fluxos
- Condições e ações
- Integração com filas
- Testes em tempo real

### 📢 Campanhas
- Criação de campanhas
- Agendamento de envios
- Múltiplas mensagens
- Controle de contatos
- Relatórios de entrega

### 📊 Relatórios
- Relatórios de atendimento
- Análise de contatos
- Performance por usuário
- Exportação em Excel
- Gráficos interativos

### ⚙️ Configurações
- Configurações globais
- Personalização da interface
- Integrações externas
- Backup e restauração

## 🔌 APIs e Integrações

### API Externa
- Endpoints RESTful
- Autenticação via token
- Envio de mensagens
- Webhooks configuráveis
- Documentação Swagger

### Webhooks
- Eventos em tempo real
- Integração com CRM
- Notificações personalizadas
- Retry automático

## 🔒 Segurança

- Autenticação JWT
- Controle de acesso baseado em roles
- Criptografia de senhas
- Rate limiting
- Logs de auditoria
- Sanitização de dados

## 📈 Performance

- Cache Redis
- Otimização de queries
- Compressão de assets
- CDN para mídias
- Monitoramento com New Relic