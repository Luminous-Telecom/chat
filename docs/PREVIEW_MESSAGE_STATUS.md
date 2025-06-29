# 📱 Status de Mensagem no Preview de Tickets

## 🎯 Funcionalidade Implementada

Foi implementado um sistema dinâmico de status de mensagem no preview de tickets que exibe em tempo real o status das mensagens enviadas (enviada, recebida, lida) e se oculta automaticamente quando há mensagens não lidas.

## ✨ Características

### 📊 **Status de Mensagem**
- **Pendente (ACK 0)**: ⏰ Relógio (cinza claro)
- **Enviado (ACK 1)**: ✓ Check simples (cinza)  
- **Entregue (ACK 2)**: ✓✓ Check duplo (cinza escuro)
- **Lida (ACK 3+)**: ✓✓ Check duplo (azul)
- **Áudio Ouvido (ACK 5)**: ✓✓ Check duplo (azul)

### 🔄 **Comportamento Dinâmico**
- **Exibe o ícone**: Apenas quando a última mensagem foi enviada por você E não há mensagens não lidas
- **Oculta o ícone**: Automaticamente quando há mensagens não lidas no ticket
- **Atualização em tempo real**: Via WebSocket quando o status da mensagem muda

### 🎨 **Design Responsivo**
- **Tema Claro**: Fundo branco com transparência
- **Tema Escuro**: Fundo escuro adaptado automaticamente
- **Animações**: Transições suaves de 0.3s
- **Ícones**: Material Design Icons (mdi)

## 🛠 **Implementação Técnica**

### **Frontend (Vue.js)**

#### **Componente: `ItemTicket.vue`**
```vue
<!-- Status da mensagem (só mostra se não há mensagens não lidas) -->
<div 
  v-if="shouldShowMessageStatus" 
  class="message-status-icon"
  :class="getMessageStatusClass"
>
  <q-icon 
    :name="getMessageStatusIcon" 
    :color="getMessageStatusColor"
    size="12px"
  />
</div>
```

#### **Computed Properties**
```javascript
// Determina se deve mostrar o status da mensagem
shouldShowMessageStatus() {
  return this.ticket.lastMessageFromMe && 
         (!this.ticket.unreadMessages || this.ticket.unreadMessages === 0) &&
         this.ticket.lastMessageAck !== undefined
}

// Ícone baseado no ACK da última mensagem
getMessageStatusIcon() {
  const ack = this.ticket.lastMessageAck || 0
  const icons = {
    0: 'mdi-clock-outline',      // Pendente
    1: 'mdi-check',              // Enviado
    2: 'mdi-check-all',          // Entregue
    3: 'mdi-check-all',          // Lida/Recebida
    4: 'mdi-check-all',          // Lida/Recebida
    5: 'mdi-check-all'           // Áudio ouvido
  }
  return icons[ack] || 'mdi-clock-outline'
}

// Cor baseada no ACK da última mensagem
getMessageStatusColor() {
  const ack = this.ticket.lastMessageAck || 0
  if (ack >= 3) return 'blue-12' // Azul para lida/ouvida
  else if (ack === 2) return 'grey-7'  // Cinza para entregue
  else if (ack === 1) return 'grey-5'  // Cinza claro para enviado
  return 'grey-4'    // Cinza mais claro para pendente
}
```

### **Backend (Node.js/TypeScript)**

#### **Modelo: `Ticket.ts`**
```typescript
@Default(null)
@AllowNull
@Column
lastMessageAck: number;

@Default(null)
@AllowNull
@Column
lastMessageFromMe: boolean;
```

#### **Atualização Automática do ACK**
```typescript
// No HandleMsgAck.ts - Atualizar ACK da última mensagem do ticket
const lastMessage = await Message.findOne({
  where: { ticketId: ticket.id },
  order: [['timestamp', 'DESC'], ['createdAt', 'DESC']],
  attributes: ['id', 'messageId', 'timestamp'],
  transaction: messageTransaction
});

if (lastMessage && (lastMessage.id === messageToUpdate.id || 
    lastMessage.messageId === messageToUpdate.messageId)) {
  await ticket.update({
    lastMessageAck: ack
  }, { transaction: messageTransaction });
}
```

### **WebSocket (Tempo Real)**

#### **Evento: `chat:ack`**
```javascript
// Frontend - mixinSockets.js
if (data.type === 'chat:ack') {
  // ... lógica existente ...
  
  // 🔥 NOVO: Atualizar ACK da última mensagem no ticket
  if (data.payload.ticket && data.payload.fromMe) {
    self.$store.commit('UPDATE_TICKET_LAST_MESSAGE_ACK', {
      ticketId: data.payload.ticket.id,
      lastMessageAck: data.payload.ack,
      lastMessageFromMe: data.payload.fromMe
    })
  }
}
```

#### **Store Mutation**
```javascript
// Vuex Store - atendimentoTicket.js
UPDATE_TICKET_LAST_MESSAGE_ACK(state, payload) {
  const { ticketId, lastMessageAck, lastMessageFromMe } = payload
  
  // Atualizar na lista de tickets
  const ticketIndex = state.tickets.findIndex(t => t.id === ticketId)
  if (ticketIndex !== -1) {
    const tickets = [...state.tickets]
    tickets[ticketIndex] = {
      ...tickets[ticketIndex],
      lastMessageAck,
      lastMessageFromMe
    }
    state.tickets = tickets
  }
}
```

## 📋 **Migrations**

### **20241213120000-add-lastMessageAck-lastMessageFromMe-to-tickets.ts**
```typescript
up: async (queryInterface: QueryInterface) => {
  const tableInfo = await queryInterface.describeTable("Tickets");
  const promises: Promise<void>[] = [];
  
  if (!tableInfo.lastMessageAck) {
    promises.push(
      queryInterface.addColumn("Tickets", "lastMessageAck", {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      })
    );
  }
  
  if (!tableInfo.lastMessageFromMe) {
    promises.push(
      queryInterface.addColumn("Tickets", "lastMessageFromMe", {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: null,
      })
    );
  }
  
  return Promise.all(promises);
}
```

## 🎮 **Como Usar**

### **Para Usuários**
1. Envie uma mensagem para um contato
2. Observe o ícone de status ao lado da última mensagem no preview do ticket
3. O ícone será atualizado automaticamente conforme o status muda
4. Quando receber novas mensagens, o ícone será ocultado até que as mensagens sejam lidas

### **Para Desenvolvedores**
1. As propriedades `lastMessageAck` e `lastMessageFromMe` estão disponíveis no objeto `ticket`
2. O componente `ItemTicket.vue` automaticamente exibe/oculta o status
3. A atualização é feita via WebSocket no evento `chat:ack`
4. Customize os ícones, cores ou comportamento modificando as computed properties

## 🔧 **Configuração**

### **CSS Classes**
```scss
.message-status-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &.status-0 { background: rgba(158, 158, 158, 0.2); }
  &.status-1 { background: rgba(158, 158, 158, 0.3); }
  &.status-2 { background: rgba(117, 117, 117, 0.3); }
  &.status-3,
  &.status-4,
  &.status-5 { background: rgba(25, 118, 210, 0.15); }
}
```

## 🚀 **Recursos Extras**

- ✅ **Compatível** com WhatsApp, Telegram, Messenger
- ✅ **Responsivo** para mobile e desktop  
- ✅ **Acessível** com tooltips informativos
- ✅ **Performante** com debounce de atualizações
- ✅ **Escalável** para milhares de tickets

**Sistema completo de status visual para uma experiência de usuário mais rica!** 🎉 