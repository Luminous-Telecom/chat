<template>
  <div class="ticket-item-container">
    <div
      clickable
      @click="abrirChatContato(ticket)"
      :class="{
        'ticket-item': true,
        'ticket-item--active': ticket.id === $store.getters['ticketFocado'].id,
        'ticket-item--not-answered': ticket.answered == false && ticket.isGroup == false && ticket.status == 'open',
        'ticket-item--pending': ticket.status === 'pending',
        'ticket-item--open': ticket.status === 'open',
        'ticket-item--closed': ticket.status === 'closed',
        'ticket-item--loading': recarregando
      }"
    >
      <!-- Tooltip para ticket ativo indicando que pode recarregar -->
      <q-tooltip
        v-if="ticket.id === $store.getters['ticketFocado'].id"
        content-class="bg-blue-9 text-white"
        anchor="center left"
        self="center right"
        :offset="[10, 0]"
      >
        🔄 Clique novamente para recarregar a conversa
      </q-tooltip>
      <!-- Status Border -->
      <div class="ticket-status-border" :class="`ticket-status-border--${ticket.status}`"></div>

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
          {{ ticket.lastMessage }}
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
    // Computed removido - shouldShowAttendButton não é mais necessário
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

  &:hover {
    transform: translateY(-2px);
    border-color: #1976d2;
    box-shadow: 0 2px 12px rgba(25, 118, 210, 0.15);
  }

    &--active {
    background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
    border: 2px solid #1976d2;
    position: relative;

    .ticket-status-border {
      background: linear-gradient(135deg, #1976d2, #7b1fa2);
    }

    // Indicar que é clicável para recarregar
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(25, 118, 210, 0.25);

      &::after {
        content: "🔄";
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 12px;
        opacity: 0.8;
        animation: rotate-refresh 1s infinite linear;
      }
    }

    // Pulsação sutil para indicar que é interativo
    animation: active-pulse 3s infinite;
  }

  &--not-answered {
    .ticket-status-border--open {
      background: linear-gradient(135deg, #ff6f00, #ff8f00);
      animation: pulse-warning 2s infinite;
    }
  }

  &--pending {
    background: linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%);

    .ticket-status-border--pending {
      background: linear-gradient(135deg, #f57c00, #e91e63);
    }
  }

  &--closed {
    opacity: 0.8;

    .ticket-status-border--closed {
      background: linear-gradient(135deg, #4caf50, #66bb6a);
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

.ticket-status-border {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 8px 0 0 8px;

  &--open {
    background: linear-gradient(135deg, #1976d2, #1e88e5);
  }

  &--pending {
    background: linear-gradient(135deg, #f57c00, #ff9800);
  }

  &--closed {
    background: linear-gradient(135deg, #4caf50, #66bb6a);
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
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
    background: var(--dark-secondary);
    border-color: var(--dark-border);
    color: var(--dark-text-primary);

    &:hover {
      background: var(--dark-tertiary);
      border-color: var(--dark-accent);
    }

        &--active {
      background: rgba(144, 202, 249, 0.1);
      border: 2px solid #90caf9;
    }

    &--pending {
      background: rgba(255, 152, 0, 0.1);
    }

    .ticket-contact-name {
      color: var(--dark-text-secondary);
    }

    .ticket-last-message {
      color: var(--dark-text-primary);
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
@keyframes pulse-warning {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

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

@keyframes rotate-refresh {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes active-pulse {
  0%, 100% {
    border-color: #1976d2;
    box-shadow: 0 2px 12px rgba(25, 118, 210, 0.15);
  }
  50% {
    border-color: #42a5f5;
    box-shadow: 0 2px 12px rgba(66, 165, 245, 0.2);
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
