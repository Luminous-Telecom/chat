<template>
  <div class="ticket-item-container">
    <div
      clickable
      @click="abrirChatContato(ticket)"
      :class="{
        'ticket-item': true,
        'ticket-item--pending': ticket.status === 'pending',
        'ticket-item--open': ticket.status === 'open',
        'ticket-item--closed': ticket.status === 'closed',
        'ticket-item--loading': recarregando,
        'ticket-item--selected': isSelected
      }"
        >
      <!-- Main Content -->
      <div class="ticket-content">
        <!-- Header -->
        <div class="ticket-header">
          <div class="ticket-contact-name">
            {{ !ticket.name ? ticket.contact.name : ticket.name }}
            <!-- Badge de mensagens não lidas -->
            <div
              v-if="ticket.unreadMessages && ticket.unreadMessages > 0"
              class="unread-badge"
            >
              {{ ticket.unreadMessages }}
            </div>
          </div>
          <div class="ticket-time">
            {{ dataInWords(ticket.lastMessageAt, ticket.updatedAt) }}
          </div>
        </div>

                <!-- Last Message -->
        <div class="ticket-last-message">
          <div class="message-content">
            <!-- Status da mensagem (só mostra se não há mensagens não lidas) -->
            <div
              v-if="shouldShowMessageStatus"
              class="message-status-icon"
              :class="getMessageStatusClass"
            >
              <q-icon
                :name="getMessageStatusIcon"
                :color="getMessageStatusColor"
                size="15px"
              />
            </div>
            <span class="message-text">{{ ticket.lastMessage }}</span>
          </div>
        </div>

        <!-- Footer Info -->
        <div class="ticket-footer">
          <div class="ticket-details">
            <div class="ticket-channel">
              <q-icon
                :name="`img:${ticket.channel}-logo.png`"
                size="12px"
                class="channel-icon"
              />
              <span class="channel-name">{{ ticket.whatsapp && ticket.whatsapp.name }}</span>
            </div>
            <div class="ticket-queue">
              <q-icon name="mdi-account-group" size="10px" />
              <span>{{ `${ticket.queue || obterNomeFila(ticket) || 'Sem fila'}` }}</span>
            </div>
          </div>

          <div class="ticket-metadata">
            <div class="ticket-id">#{{ ticket.id }}</div>
            <div class="ticket-user">{{ ticket.username }}</div>
          </div>

          <!-- Status Icons - movido para o footer -->
          <div class="ticket-status-icons">
            <!-- Ticket Resolvido -->
            <div
              v-if="ticket.status === 'closed'"
              class="status-icon status-icon--resolved"
            >
              <q-icon name="mdi-check-circle" size="14px" />
              <q-tooltip>Atendimento Resolvido</q-tooltip>
            </div>

            <!-- ChatBot ativo -->
            <div
              v-if="(ticket.stepAutoReplyId && ticket.autoReplyId && ticket.status === 'pending') || (ticket.chatFlowId && ticket.stepChatFlow && ticket.status === 'pending')"
              class="status-icon status-icon--bot"
            >
              <q-icon name="mdi-robot" size="14px" />
              <q-tooltip>ChatBot atendendo</q-tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { formatDistance, parseJSON } from 'date-fns'
import pt from 'date-fns/locale/pt-BR'
import mixinAtualizarStatusTicket from './mixinAtualizarStatusTicket'

export default {
  name: 'ItemTicket',
  mixins: [mixinAtualizarStatusTicket],
  data () {
    return {
      recalcularHora: 1,
      recarregando: false // Estado para controlar loading do recarregamento
    }
  },
  computed: {
    isSelected () {
      return this.ticket.id === this.$store.getters.ticketFocado?.id
    },

    // Determina se deve mostrar o status da mensagem
    shouldShowMessageStatus () {
      // Só mostrar status se:
      // 1. A última mensagem foi enviada por nós (fromMe)
      // 2. Não há mensagens não lidas (ticket.unreadMessages === 0)
      // 3. Temos informações de status (lastMessageAck existe)
      return this.ticket.lastMessageFromMe &&
             (!this.ticket.unreadMessages || this.ticket.unreadMessages === 0) &&
             this.ticket.lastMessageAck !== undefined
    },

    // Classe CSS para o status da mensagem
    getMessageStatusClass () {
      const ack = this.ticket.lastMessageAck || 0
      return `status-${ack}`
    },

    // Ícone baseado no ACK da última mensagem
    getMessageStatusIcon () {
      const ack = this.ticket.lastMessageAck || 0
      const icons = {
        0: 'mdi-clock-outline', // Pendente
        1: 'mdi-check', // Enviado
        2: 'mdi-check-all', // Entregue
        3: 'mdi-check-all', // Lida/Recebida
        4: 'mdi-check-all', // Lida/Recebida
        5: 'mdi-check-all' // Áudio ouvido
      }
      return icons[ack] || 'mdi-clock-outline'
    },

    // Cor baseada no ACK da última mensagem
    getMessageStatusColor () {
      const ack = this.ticket.lastMessageAck || 0
      if (ack >= 3) {
        return 'blue-12' // Azul para lida/ouvida
      } else if (ack === 2) {
        return 'grey-7' // Cinza para entregue
      } else if (ack === 1) {
        return 'grey-5' // Cinza claro para enviado
      }
      return 'grey-4' // Cinza mais claro para pendente
    }
  },
  props: {
    ticket: {
      type: Object,
      default: () => ({})
    },
    buscaTicket: {
      type: Boolean,
      default: false
    },
    filas: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    obterNomeFila (ticket) {
      try {
        const fila = this.filas.find(f => f.id === ticket.queueId)
        if (fila) {
          return fila.queue
        }
        return ''
      } catch (error) {
        return ''
      }
    },
    dataInWords (timestamp, updated) {
      let data = parseJSON(updated)
      if (timestamp) {
        data = new Date(Number(timestamp))
      }
      return formatDistance(data, new Date(), { locale: pt })
    },
    async abrirChatContato (ticket) {
      // Permitir visualizar ticket sempre, removendo a restrição para tickets pendentes
      // O botão "Atender" continuará disponível para iniciar o atendimento quando necessário

      if (this.$q.screen.lt.md && ticket.status !== 'pending') {
        this.$root.$emit('infor-cabecalo-chat:acao-menu')
      }

      // Verificar se o ticket já está focado
      const isAlreadyFocused = (ticket.id === this.$store.getters.ticketFocado.id && this.$route.name === 'chat')

      if (isAlreadyFocused) {
        // 🔄 NOVO: Se o ticket já está focado, recarregar o chat
        await this.recarregarChat(ticket)
        return
      }

      this.$store.commit('SET_HAS_MORE', true)
      this.$store.dispatch('AbrirChatMensagens', ticket)
    },

    async recarregarChat (ticket) {
      // Evitar múltiplos recarregamentos simultâneos
      if (this.recarregando) return

      try {
        this.recarregando = true

        // 🔄 Recarregar silenciosamente sem notificações
        await this.$store.dispatch('RecarregarChatMensagens', ticket)

        // Focar o input após recarregar
        setTimeout(() => {
          this.$root.$emit('ticket:refocus-input')
        }, 300)
      } catch (error) {
        console.error('[recarregarChat] Erro ao recarregar chat:', error)

        // Mostrar erro para o usuário
        this.$q.notify({
          type: 'negative',
          message: '❌ Erro ao recarregar conversa',
          caption: 'Tente novamente',
          position: 'bottom-right',
          timeout: 3000,
          actions: [
            {
              icon: 'close',
              color: 'white',
              round: true,
              handler: () => {}
            }
          ]
        })
      } finally {
        this.recarregando = false
      }
    }
  },
  watch: {
    'ticket.status': {
      handler (newStatus, oldStatus) {
        if (newStatus !== oldStatus) {
          this.$forceUpdate()
        }
      }
    },
    'ticket.unreadMessages': {
      handler (newCount, oldCount) {
        if (newCount !== oldCount) {
        }
      }
    }
  },
  created () {
    setInterval(() => {
      this.recalcularHora++
    }, 20000)
  }
}
</script>

<style lang="scss" scoped>
.ticket-item-container {
  margin: 6px;
}

.ticket-item {
  position: relative;
  background: #f1f1f1;
  border-radius: 8px;
  padding: 8px 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;

  &:hover {
    background: rgba(25, 118, 210, 0.05);
  }

  &--pending {
    background: linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%);
  }

  &--closed {
    opacity: 0.8;
  }

  &--selected {
    background: linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(25, 118, 210, 0.15) 100%);
    transform: translateY(-1px);

    .ticket-contact-name {
      color: #1976d2;
      font-weight: 700;
    }

    .ticket-last-message {
      color: #1976d2;
      font-weight: 500;
    }
  }

  &--loading {
    position: relative;
    opacity: 0.8;
    pointer-events: none;

    &::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 20px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #1976d2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      z-index: 10;
    }

    &::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 8px;
      z-index: 9;
    }
  }
}

.ticket-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.unread-badge {
  background: linear-gradient(135deg, #f44336, #e57373);
  color: white;
  border-radius: 12px;
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  animation: badge-bounce 0.6s ease-out;
  margin-left: 6px;
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 3px;

  .ticket-contact-name {
    font-weight: 600;
    font-size: 13px;
    color: #2c3e50;
    flex: 1;
    margin-right: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ticket-time {
    font-size: 10px;
    color: #7b8794;
    font-weight: 500;
    white-space: nowrap;
    background: rgba(123, 135, 148, 0.1);
    padding: 1px 6px;
    border-radius: 8px;
  }
}

.ticket-last-message {
  font-size: 11px;
  color: #5a6c7d;
  line-height: 1.3;
  margin-bottom: 4px;

  .message-content {
    display: flex;
    align-items: center;
    gap: 4px; // Espaçamento menor igual WhatsApp Web

    .message-text {
      flex: 1;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .message-status-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 12px;  // Menor para ficar mais sutil igual WhatsApp
      height: 12px; // Menor para ficar mais sutil igual WhatsApp
      border-radius: 2px; // Bordas menos arredondadas
      background: transparent; // Sem background para ficar mais limpo
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      margin-right: 2px; // Pequeno espaço extra antes do texto
    }
  }
}

.ticket-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  gap: 8px;
}

.ticket-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;

  .ticket-channel,
  .ticket-queue {
    display: flex;
    align-items: center;
    gap: 3px;
    color: #7b8794;

    .channel-icon {
      border-radius: 2px;
    }

    .channel-name {
      background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
      padding: 1px 5px;
      border-radius: 6px;
      font-weight: 500;
      color: #1976d2;
    }
  }
}

.ticket-metadata {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 1px;

  .ticket-id {
    font-weight: 600;
    color: #34495e;
    background: rgba(52, 73, 94, 0.1);
    padding: 1px 4px;
    border-radius: 6px;
    font-size: 8px;
  }

  .ticket-user {
    color: #7b8794;
    font-size: 8px;
  }
}

.ticket-status-icons {
  display: flex;
  gap: 4px;
  align-items: center;

    .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;

    &--resolved {
      background: linear-gradient(135deg, #4caf50, #66bb6a);
      color: white;
    }

    &--bot {
      background: linear-gradient(135deg, #2196f3, #42a5f5);
      color: white;
      animation: bot-pulse 2s infinite;
    }
  }
}

// Dark mode styles
.body--dark {
  .ticket-item {
    background: rgba(144, 202, 249, 0);
    border-color: var(--dark-border);
    color: var(--dark-text-primary);

    &:hover {
      background: rgba(144, 202, 249, 0.199);
    }

    &--pending {
      background: rgba(255, 153, 0, 0);
    }

    &--selected {
      background: linear-gradient(135deg, rgba(144, 202, 249, 0.2) 0%, rgba(144, 202, 249, 0.3) 100%);

      .ticket-contact-name {
        color: var(--dark-accent);
        font-weight: 700;
      }

      .ticket-last-message {
        color: var(--dark-accent);
        font-weight: 500;
      }
    }

    .ticket-contact-name {
      color: var(--dark-text-secondary);
    }

    .ticket-time {
      background: rgba(255, 255, 255, 0.1);
      color: var(--dark-text-primary);
    }

    .ticket-details {
      color: var(--dark-text-primary);

      .channel-name {
        background: rgba(144, 202, 249, 0.2);
        color: var(--dark-accent);
      }
    }

    .ticket-metadata {
      .ticket-id {
        background: rgba(255, 255, 255, 0.1);
        color: var(--dark-text-secondary);
      }

      .ticket-user {
        color: var(--dark-text-primary);
      }
    }
  }
}

// Animations
@keyframes badge-bounce {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes bot-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes spin {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

// Responsive
@media (max-width: 768px) {
  .ticket-item {
    padding: 8px 10px;
    margin-bottom: 3px;
    gap: 6px;
  }

  .ticket-content {
    gap: 4px;
  }

  .ticket-header {
    .ticket-contact-name {
      font-size: 12px;
    }
  }

  .ticket-last-message {
    font-size: 10px;
  }

  .ticket-footer {
    font-size: 8px;
    gap: 6px;
  }
}
</style>
