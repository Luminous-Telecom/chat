# Frontend - Eventos de Leitura Automática

## Descrição

Documentação dos novos eventos WebSocket que o frontend deve escutar para sincronizar dinamicamente a marcação de mensagens como lidas quando são lidas no WhatsApp Business.

## 🎯 Eventos WebSocket Disponíveis

### 1. `${tenantId}:messageRead`
**Descrição**: Evento específico quando uma mensagem é marcada como lida (manual ou automática)

**Payload**:
```javascript
{
  type: "message:read",
  payload: {
    messageId: "uuid-da-mensagem",
    ticketId: 123,
    read: true,
    source: "whatsapp_ack" | "manual" | "system",
    ack: 3,
    fromMe: false,
    automatic: true, // 🔥 NOVO: indica se foi automático
    timestamp: "2025-01-24T23:42:32.519Z",
    ticket: {
      id: 123,
      unreadMessages: 0,
      answered: true
    }
  }
}
```

### 2. `${tenantId}:messageAutoRead`
**Descrição**: Evento específico quando uma mensagem é lida automaticamente no WhatsApp Business

**Payload**:
```javascript
{
  type: "message:auto-read",
  payload: {
    messageId: "uuid-da-mensagem",
    ticketId: 123,
    contactId: 456,
    contactName: "João Silva",
    ack: 3,
    source: "whatsapp_business",
    timestamp: "2025-01-24T23:42:32.519Z",
    ticket: {
      id: 123,
      unreadMessages: 0,
      answered: true
    }
  }
}
```

### 3. `${tenantId}:ticketList` (Atualizado)
**Descrição**: Evento geral de ACK com informações sobre leitura automática

**Payload**:
```javascript
{
  type: "chat:ack",
  payload: {
    id: "uuid-da-mensagem",
    messageId: "messageId-whatsapp",
    ack: 3,
    status: "received",
    read: true,
    played: false,
    fromMe: false,
    mediaType: "conversation",
    wasMarkedAsRead: true, // 🔥 NOVO: se foi marcada como lida
    automatic: true, // 🔥 NOVO: se foi automático
    timestamp: "2025-01-24T23:42:32.519Z",
    ticket: {
      id: 123,
      status: "open",
      unreadMessages: 0,
      answered: true
    }
  }
}
```

## 🛠️ Implementação no Frontend

### Vue.js - Escutar Eventos

```javascript
// Em um componente Vue (Chat.vue, TicketList.vue, etc.)
mounted() {
  const socket = this.$socket;
  const tenantId = this.$store.getters.tenantId;

  // Evento específico de mensagem lida
  socket.on(`${tenantId}:messageRead`, this.handleMessageRead);
  
  // Evento específico de leitura automática
  socket.on(`${tenantId}:messageAutoRead`, this.handleMessageAutoRead);
  
  // Evento geral de ACK (já existente, mas com novos campos)
  socket.on(`${tenantId}:ticketList`, this.handleTicketUpdate);
},

beforeDestroy() {
  const tenantId = this.$store.getters.tenantId;
  this.$socket.off(`${tenantId}:messageRead`);
  this.$socket.off(`${tenantId}:messageAutoRead`);
},

methods: {
  handleMessageRead(data) {
    console.log('📖 Mensagem marcada como lida:', data);
    
    const { payload } = data;
    
    // Atualizar mensagem na lista
    this.updateMessageReadStatus(payload.messageId, payload.read);
    
    // Atualizar contador do ticket
    this.updateTicketUnreadCount(payload.ticketId, payload.ticket.unreadMessages);
    
    // Mostrar notificação se foi automático
    if (payload.automatic) {
      this.showAutoReadNotification(payload);
    }
  },

  handleMessageAutoRead(data) {
    console.log('📱 Leitura automática no WhatsApp:', data);
    
    const { payload } = data;
    
    // Mostrar toast/notificação discreta
    this.$q.notify({
      type: 'info',
      message: `Mensagem de ${payload.contactName} foi lida automaticamente`,
      timeout: 2000,
      position: 'top-right'
    });
    
    // Atualizar UI suavemente
    this.highlightTicketUpdate(payload.ticketId);
  },

  handleTicketUpdate(data) {
    if (data.type === 'chat:ack' && data.payload.automatic) {
      console.log('🔄 ACK automático recebido:', data);
      
      // Lógica específica para ACKs automáticos
      this.handleAutomaticAck(data.payload);
    }
    
    // Lógica existente para outros tipos de update...
  },

  updateMessageReadStatus(messageId, isRead) {
    // Encontrar e atualizar a mensagem na lista
    const message = this.messages.find(m => m.id === messageId);
    if (message) {
      this.$set(message, 'read', isRead);
      
      // Adicionar classe CSS para indicar leitura
      this.$nextTick(() => {
        const messageEl = this.$el.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl && isRead) {
          messageEl.classList.add('message-auto-read');
          
          // Remover classe após animação
          setTimeout(() => {
            messageEl.classList.remove('message-auto-read');
          }, 2000);
        }
      });
    }
  },

  updateTicketUnreadCount(ticketId, unreadCount) {
    // Atualizar ticket na lista
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (ticket) {
      this.$set(ticket, 'unreadMessages', unreadCount);
      
      // Atualizar badge de mensagens não lidas
      this.$nextTick(() => {
        this.updateUnreadBadge(ticketId, unreadCount);
      });
    }
  },

  showAutoReadNotification(payload) {
    // Notificação sutil para leitura automática
    this.$q.notify({
      type: 'positive',
      message: '✅ Sincronizado com WhatsApp',
      caption: 'Mensagem marcada como lida automaticamente',
      timeout: 3000,
      position: 'bottom-right',
      actions: [{
        icon: 'close',
        color: 'white',
        round: true
      }]
    });
  }
}
```

### CSS - Animações para Leitura Automática

```css
/* Animação para mensagem lida automaticamente */
.message-auto-read {
  animation: autoReadPulse 2s ease-in-out;
  background-color: #e8f5e8 !important;
}

@keyframes autoReadPulse {
  0% { 
    background-color: inherit; 
    transform: scale(1);
  }
  50% { 
    background-color: #d4edda; 
    transform: scale(1.02);
  }
  100% { 
    background-color: #e8f5e8; 
    transform: scale(1);
  }
}

/* Badge de mensagens não lidas com transição suave */
.unread-badge {
  transition: all 0.3s ease-in-out;
}

.unread-badge.updating {
  animation: badgeUpdate 0.5s ease-in-out;
}

@keyframes badgeUpdate {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); background-color: #28a745; }
  100% { transform: scale(1); }
}

/* Indicador visual de sincronização */
.sync-indicator {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #28a745;
  margin-left: 8px;
}

.sync-indicator::before {
  content: "📱";
  margin-right: 4px;
  animation: syncPulse 2s infinite;
}

@keyframes syncPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
```

### Store/Estado - Atualização de Dados

```javascript
// store/modules/messages.js ou similar
const mutations = {
  UPDATE_MESSAGE_READ_STATUS(state, { messageId, read, automatic }) {
    const message = state.messages.find(m => m.id === messageId);
    if (message) {
      message.read = read;
      message.lastSync = automatic ? Date.now() : null;
    }
  },

  UPDATE_TICKET_UNREAD_COUNT(state, { ticketId, unreadCount, answered }) {
    const ticket = state.tickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.unreadMessages = unreadCount;
      ticket.answered = answered;
      ticket.lastUpdate = Date.now();
    }
  },

  ADD_AUTO_READ_LOG(state, payload) {
    // Opcional: manter log de leituras automáticas
    state.autoReadLog.unshift({
      ...payload,
      timestamp: Date.now()
    });
    
    // Manter apenas os últimos 50 logs
    if (state.autoReadLog.length > 50) {
      state.autoReadLog = state.autoReadLog.slice(0, 50);
    }
  }
};

const actions = {
  handleMessageRead({ commit }, payload) {
    commit('UPDATE_MESSAGE_READ_STATUS', {
      messageId: payload.messageId,
      read: payload.read,
      automatic: payload.automatic
    });

    commit('UPDATE_TICKET_UNREAD_COUNT', {
      ticketId: payload.ticketId,
      unreadCount: payload.ticket.unreadMessages,
      answered: payload.ticket.answered
    });

    if (payload.automatic) {
      commit('ADD_AUTO_READ_LOG', payload);
    }
  }
};
```

## 🎨 UX/UI Recomendações

### Indicadores Visuais
1. **Ícone de sincronização** 📱 próximo a mensagens lidas automaticamente
2. **Animação sutil** quando mensagem é marcada como lida
3. **Toast discreto** informando sobre sincronização automática
4. **Badge atualizado** em tempo real com contador correto

### Feedback ao Usuário
1. **Notificação**: "✅ Mensagem sincronizada com WhatsApp"
2. **Tooltip**: "Lida automaticamente no WhatsApp Business"
3. **Log de atividades**: Histórico de sincronizações automáticas

### Estados da Interface
- 🔵 **Mensagem não lida** - Badge azul/contador
- ✅ **Lida manualmente** - Checkmark verde
- 📱 **Lida automaticamente** - Ícone WhatsApp + checkmark
- 🔄 **Sincronizando** - Spinner/loading

## 🚀 Exemplos Práticos

### 1. Lista de Tickets
```vue
<template>
  <q-item 
    v-for="ticket in tickets" 
    :key="ticket.id"
    :class="{ 'ticket-updated': ticket.lastUpdate > recentThreshold }"
  >
    <q-item-section>
      <q-item-label>{{ ticket.contact.name }}</q-item-label>
      <q-item-label caption>{{ ticket.lastMessage }}</q-item-label>
    </q-item-section>
    
    <q-item-section side>
      <q-badge 
        v-if="ticket.unreadMessages > 0"
        :label="ticket.unreadMessages"
        color="primary"
        class="unread-badge"
        :class="{ 'updating': ticket.lastUpdate > recentThreshold }"
      />
      <q-icon 
        v-else-if="ticket.answered"
        name="done_all"
        color="green"
        size="sm"
      />
    </q-item-section>
  </q-item>
</template>
```

### 2. Chat de Mensagens
```vue
<template>
  <div class="message-item" :data-message-id="message.id">
    <div class="message-content">
      {{ message.body }}
    </div>
    
    <div class="message-meta">
      <span class="timestamp">{{ formatTime(message.createdAt) }}</span>
      
      <!-- Indicador de leitura -->
      <span v-if="message.read" class="read-indicator">
        <q-icon name="done_all" color="green" size="xs" />
        <span v-if="message.lastSync" class="sync-indicator">
          📱 Auto
        </span>
      </span>
    </div>
  </div>
</template>
```

## 📊 Debugging e Monitoramento

### Console Logs
```javascript
// Adicionar logs para debugging
console.group('🔄 WhatsApp Sync Event');
console.log('Type:', data.type);
console.log('Automatic:', data.payload.automatic);
console.log('Source:', data.payload.source);
console.log('Ticket:', data.payload.ticketId);
console.log('Message:', data.payload.messageId);
console.groupEnd();
```

### Painel de Debug (Desenvolvimento)
```vue
<template>
  <q-expansion-item label="🔍 Debug - Auto Read Events" v-if="$q.dev">
    <q-list>
      <q-item v-for="log in autoReadLog" :key="log.timestamp">
        <q-item-section>
          <q-item-label>{{ log.contactName }}</q-item-label>
          <q-item-label caption>
            {{ log.source }} - {{ formatTime(log.timestamp) }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-expansion-item>
</template>
```

## 🔄 Sincronização Completa da Interface

### ✅ Sistema Implementado
O sistema agora sincroniza automaticamente **TODOS** os componentes da interface:

1. **Lista de tickets** - Badge de mensagens não lidas removido instantaneamente
2. **Menu lateral** - Contadores atualizados em tempo real  
3. **Título da guia** - Contador de notificações sincronizado
4. **Chat** - Status visual das mensagens atualizado
5. **Notificações** - Toast informativo sobre sincronização

### 🎯 Fluxo de Sincronização Completo
```
WhatsApp Business (leitura) 
    ↓
Backend (detecta ACK 3)
    ↓  
Eventos WebSocket emitidos
    ↓
Frontend recebe eventos
    ↓
┌─ Lista tickets atualizada
├─ Menu lateral sincronizado  
├─ Título da guia atualizado
├─ Chat com status correto
└─ Toast de confirmação
```

### 📱 Componentes Sincronizados

**Lista de Tickets (ItemTicket.vue)**
- Badge `unreadMessages` zerado dinamicamente
- Animação suave de remoção do badge
- Status visual atualizado

**Menu Lateral (MainLayout.vue)**  
- Contador de tickets com mensagens não lidas
- Badge numérico atualizado em tempo real
- Recálculo automático das notifications

**Título da Guia**
- Contador total de notificações
- Formatação: `(X) Lumis Suite` 
- Atualização via `atualizarTituloGuia()`

**Chat (MensagemChat.vue)**
- Ícones de ACK atualizados
- Status `read: true` nas mensagens
- Indicador visual de leitura automática

### 🛠️ Implementação Técnica

**Método de Sincronização Global**:
```javascript
async atualizarNotificacoesGlobais() {
  // Re-consultar tickets com mensagens não lidas
  const { data } = await ConsultarTickets(paramsOpen);
  this.$store.commit('UPDATE_NOTIFICATIONS', data);

  // Atualizar título da guia  
  import('src/helpers/helpersNotifications').then(mod => {
    mod.atualizarTituloGuia(notifications, notifications_p);
  });
}
```

**Listeners Atualizados**:
- `messageRead` → Sincroniza lista + menu + título
- `messageAutoRead` → Sincroniza tudo + mostra toast
- `ticketList` → Mantém funcionalidade existente

### 📊 Logs e Debug
```
[Frontend] 📖 Evento messageRead recebido
[Frontend] ✅ Mensagem marcada como lida automaticamente
[Frontend] 🔄 Notificações globais atualizadas após leitura automática
```

### 🎨 Feedback Visual
- **Toast discreto**: "📱 Sincronizado com WhatsApp"
- **Badge animado** que desaparece suavemente
- **Ícones de status** atualizados instantaneamente  
- **Título da guia** com contagem precisa

Agora o frontend tem **sincronização completa e em tempo real** com a leitura automática de mensagens! 🚀 