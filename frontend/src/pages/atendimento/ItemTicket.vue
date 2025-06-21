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
        'ticket-item--closed': ticket.status === 'closed'
      }"
    >
      <!-- Status Border -->
      <div class="ticket-status-border" :class="`ticket-status-border--${ticket.status}`"></div>

      <!-- Main Content -->
      <div class="ticket-content">
        <!-- Avatar Section -->
        <div class="ticket-avatar-section">
          <!-- Botão de atender sempre visível quando shouldShowAttendButton for true -->
          <div
            v-if="shouldShowAttendButton"
            class="attend-button-container"
            @click.stop="iniciarAtendimento(ticket)"
          >
                         <div class="attend-button">
               <q-icon name="mdi-send-circle" size="20px" />
               <div class="attend-button-label">Atender</div>
             </div>
            <div
              v-if="ticket.unreadMessages && ticket.unreadMessages > 0"
              class="unread-badge"
            >
              {{ ticket.unreadMessages }}
            </div>
          </div>

          <!-- Avatar do contato - só aparece quando não estiver pending -->
          <div
            v-else
            class="contact-avatar-container"
          >
            <div class="contact-avatar">
              <img
                v-if="ticket.profilePicUrl"
                :src="ticket.profilePicUrl"
                class="avatar-image"
                @error="$event.target.style.display='none'"
              />
                             <q-icon
                 v-else
                 name="mdi-account-circle"
                 size="32px"
                 class="avatar-icon"
               />
            </div>
            <div
              v-if="ticket.unreadMessages && ticket.unreadMessages > 0"
              class="unread-badge"
            >
              {{ ticket.unreadMessages }}
            </div>
          </div>
        </div>

        <!-- Info Section -->
        <div class="ticket-info-section">
          <!-- Header -->
          <div class="ticket-header">
            <div class="ticket-contact-name">
              {{ !ticket.name ? ticket.contact.name : ticket.name }}
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
          </div>

          <!-- Status Icons -->
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
      recalcularHora: 1
    }
  },
  computed: {
    shouldShowAttendButton () {
      const ticket = this.ticket
      const isPending = ticket.status === 'pending'
      const isNotInSearch = this.buscaTicket === false || this.buscaTicket === undefined
      return isPending && isNotInSearch
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
    abrirChatContato (ticket) {
      console.log(`[abrirChatContato] Iniciando abertura de chat para ticket ${ticket.id} com status: ${ticket.status}`)

      // Permitir visualizar ticket sempre, removendo a restrição para tickets pendentes
      // O botão "Atender" continuará disponível para iniciar o atendimento quando necessário

      if (this.$q.screen.lt.md && ticket.status !== 'pending') {
        this.$root.$emit('infor-cabecalo-chat:acao-menu')
      }

      // Verificar se o ticket já não está focado
      if (!((ticket.id !== this.$store.getters.ticketFocado.id || this.$route.name !== 'chat'))) {
        console.log(`[abrirChatContato] Ticket ${ticket.id} já está focado, não abrindo novamente`)
        return
      }

      console.log(`[abrirChatContato] Abrindo chat para ticket ${ticket.id} (status: ${ticket.status})`)
      this.$store.commit('SET_HAS_MORE', true)
      this.$store.dispatch('AbrirChatMensagens', ticket)
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
  margin-bottom: 4px;
  padding: 0 8px;
}

.ticket-item {
  position: relative;
  background: white;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow: hidden;
  min-height: 60px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-color: rgba(25, 118, 210, 0.2);
  }

  &--active {
    background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
    box-shadow: 0 4px 16px rgba(25, 118, 210, 0.15);
    border-color: #1976d2;

    .ticket-status-border {
      background: linear-gradient(135deg, #1976d2, #7b1fa2);
    }
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
}

.ticket-status-border {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 2px 0 0 2px;

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
  gap: 8px;
  align-items: center;
}

.ticket-avatar-section {
  flex-shrink: 0;
  position: relative;
}

.attend-button-container {
  position: relative;
  cursor: pointer;

  .attend-button {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #4caf50, #66bb6a);
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);

    &:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
    }

    &:active {
      transform: scale(0.95);
    }

    .attend-button-label {
      font-size: 8px;
      font-weight: 600;
      margin-top: 1px;
    }
  }
}

.contact-avatar-container {
  position: relative;

  .contact-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
    border: 1px solid rgba(25, 118, 210, 0.1);

    .avatar-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .avatar-icon {
      color: #9e9e9e;
    }
  }
}

.unread-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: linear-gradient(135deg, #f44336, #e57373);
  color: white;
  border-radius: 50%;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(244, 67, 54, 0.3);
  animation: badge-bounce 0.6s ease-out;
}

.ticket-info-section {
  flex: 1;
  min-width: 0;
  position: relative;
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
  align-items: flex-end;
  font-size: 9px;
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
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  gap: 4px;

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
      box-shadow: 0 1px 4px rgba(76, 175, 80, 0.3);
    }

    &--bot {
      background: linear-gradient(135deg, #2196f3, #42a5f5);
      color: white;
      box-shadow: 0 1px 4px rgba(33, 150, 243, 0.3);
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
      border-color: var(--dark-accent);
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

    .contact-avatar {
      background: rgba(144, 202, 249, 0.2);
      border-color: rgba(144, 202, 249, 0.3);
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

// Responsive
@media (max-width: 768px) {
  .ticket-item {
    padding: 6px 8px;
    margin-bottom: 3px;
    min-height: 55px;
  }

  .ticket-content {
    gap: 6px;
  }

  .ticket-header {
    .ticket-contact-name {
      font-size: 12px;
    }
  }

  .ticket-last-message {
    font-size: 10px;
  }

  .contact-avatar-container .contact-avatar,
  .attend-button-container .attend-button {
    width: 32px;
    height: 32px;
  }
}
</style>
