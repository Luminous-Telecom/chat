<template>
  <div class="ticket-item-container">
    <div
      clickable
      @click="abrirChatContato(ticket)"
      @contextmenu.prevent="showContextMenu($event)"
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
            <span class="ticket-contact-name-text">
              {{ ((!ticket.name ? ticket.contact.name : ticket.name) || '').length > 30
                ? ((!ticket.name ? ticket.contact.name : ticket.name) || '').slice(0, 30) + '...'
                : ((!ticket.name ? ticket.contact.name : ticket.name) || '') }}
            </span>
            <!-- Etiquetas -->
            <div v-if="ticket.tags && ticket.tags.length > 0" class="ticket-tags-preview">
              <q-chip style="margin-left: 0px;"
                v-for="tag in ticket.tags"
                :key="tag.id || tag"
                size="sm"
                :style="{ backgroundColor: getTagColor(tag), color: getContrastColor(getTagColor(tag)) }"
                class="ticket-tag-chip"
              >
                {{ getTagName(tag) }}
              </q-chip>
            </div>
            <!-- Badge de mensagens não lidas -->
            <div
              v-if="ticket.unreadMessages && ticket.unreadMessages > 0"
              class="unread-badge"
            >
              {{ ticket.unreadMessages }}
            </div>
          </div>
          <div class="ticket-header-right">
            <div class="ticket-time">
              {{ dataInWords(ticket.lastMessageAt, ticket.updatedAt) }}
            </div>
            <div class="ticket-id">#{{ ticket.id }}</div>
            <!-- Indicador de ticket fixado -->
            <div v-if="ticket.isPinned" class="ticket-pinned-indicator">
              <q-icon name="mdi-pin" size="14px" color="primary" />
              <q-tooltip>Ticket fixado no topo</q-tooltip>
            </div>
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
            <span class="message-text" v-html="formatarMensagemWhatsapp(
  (ticket.lastMessage || '').length > 60
    ? (ticket.lastMessage || '').slice(0, 60) + '...'
    : (ticket.lastMessage || '')
)"></span>
          </div>
        </div>

        <!-- Footer Info -->
        <div class="ticket-footer">
          <div class="ticket-details">
            <div class="ticket-channel">
              <q-icon
                :name="getChannelIcon(ticket.channel)"
                size="14px"
                class="channel-icon"
                :color="getChannelColor(ticket.channel)"
              />
              <span class="channel-name">{{ ticket.whatsapp && ticket.whatsapp.name }}</span>
            </div>
            <div class="ticket-queue">
              <q-icon name="mdi-account-group" size="10px" />
              <span>{{ `${ticket.queue || obterNomeFila(ticket) || 'Sem fila'}` }}</span>
            </div>
          </div>

          <div class="ticket-metadata">
            <div class="ticket-user">{{ ticket.username }}</div>
          </div>

          <!-- Status Icons - movido para o footer -->
          <div class="ticket-status-icons">
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

    <!-- Menu de Contexto -->
    <q-menu
      ref="contextMenu"
      v-model="showMenu"
      class="ticket-context-menu"
      context-menu
      auto-close
    >
      <q-list style="min-width: 200px;">
        <q-item
          clickable
          v-close-popup
          @click="toggleReadStatus"
          class="context-menu-item"
        >
          <q-item-section avatar>
            <q-icon 
              :name="ticket.unreadMessages > 0 ? 'mdi-email-check' : 'mdi-email-outline'" 
              :color="ticket.unreadMessages > 0 ? 'primary' : 'grey-6'"
            />
          </q-item-section>
          <q-item-section>
            {{ ticket.unreadMessages > 0 ? 'Marcar como lido' : 'Marcar como não lido' }}
          </q-item-section>
        </q-item>

        <q-separator />

        <q-item
          clickable
          v-close-popup
          @click="togglePinnedStatus"
          class="context-menu-item"
        >
          <q-item-section avatar>
            <q-icon 
              :name="ticket.isPinned ? 'mdi-pin-off' : 'mdi-pin'" 
              :color="ticket.isPinned ? 'negative' : 'primary'"
            />
          </q-item-section>
          <q-item-section>
            {{ ticket.isPinned ? 'Desfixar do topo' : 'Fixar no topo' }}
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </div>
</template>

<script>
import { formatDistance, parseJSON } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import mixinAtualizarStatusTicket from './mixinAtualizarStatusTicket'
import mixinCommon from './mixinCommon'
import { MarcarComoLido, MarcarComoNaoLido, TogglePinnedTicket } from 'src/service/tickets'

export default {
  name: 'ItemTicket',
  mixins: [mixinAtualizarStatusTicket, mixinCommon],
  data () {
    return {
      recalcularHora: 1,
      recarregando: false, // Estado para controlar loading do recarregamento
      showMenu: false // Controle para mostrar/ocultar o menu de contexto
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
    },
    etiquetas: {
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
      return formatDistance(data, new Date(), { locale: ptBR })
    },
    getTagColor (tag) {
      // Se for objeto, pega a cor, senão tenta buscar na lista de etiquetas
      if (typeof tag === 'object' && tag.color) return tag.color
      if (this.etiquetas && this.etiquetas.length > 0) {
        const found = this.etiquetas.find(e => e.id === (tag.id || tag))
        return found ? found.color : 'primary'
      }
      return 'primary'
    },
    getTagName (tag) {
      if (typeof tag === 'object' && tag.tag) return tag.tag
      if (this.etiquetas && this.etiquetas.length > 0) {
        const found = this.etiquetas.find(e => e.id === (tag.id || tag))
        return found ? found.tag : 'Tag'
      }
      return 'Tag'
    },
    getContrastColor (backgroundColor) {
      // Função para determinar se usar texto branco ou preto baseado na cor de fundo
      if (!backgroundColor) return '#000000'
      
      // Converter hex para RGB
      const hex = backgroundColor.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16)
      const g = parseInt(hex.substr(2, 2), 16)
      const b = parseInt(hex.substr(4, 2), 16)
      
      // Calcular luminância
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      
      // Retornar branco para fundos escuros, preto para fundos claros
      return luminance > 0.5 ? '#000000' : '#ffffff'
    },
    async abrirChatContato (ticket) {
      // Permitir visualizar ticket sempre, removendo a restrição para tickets pendentes
      // O botão "Atender" continuará disponível para iniciar o atendimento quando necessário

      if (this.$q.screen.lt.md && ticket.status !== 'pending') {
        this.$eventBus.emit('infor-cabecalo-chat:acao-menu')
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

    getChannelIcon (channel) {
      const icons = {
        whatsapp: 'mdi-whatsapp',
        instagram: 'mdi-instagram',
        telegram: 'mdi-telegram',
        messenger: 'mdi-facebook-messenger',
        waba: 'mdi-whatsapp'
      }
      return icons[channel] || 'mdi-message'
    },

    getChannelColor (channel) {
      return 'green' // Verde do Quasar para todos os canais
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
          this.$eventBus.emit('ticket:refocus-input')
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
    },

    showContextMenu(event) {
      // Usar a API do q-menu para context menu
      this.$refs.contextMenu.show(event);
    },

    async toggleReadStatus () {
      try {
        if (this.ticket.unreadMessages > 0) {
          // Marcar como lido
          await MarcarComoLido(this.ticket.id)
          
          // Atualizar o ticket na lista
          this.$store.commit('UPDATE_TICKET', {
            ...this.ticket,
            unreadMessages: 0
          })
        } else {
          // Marcar como não lido
          await MarcarComoNaoLido(this.ticket.id)
          
          // Atualizar o ticket na lista (assumindo que há pelo menos 1 mensagem)
          this.$store.commit('UPDATE_TICKET', {
            ...this.ticket,
            unreadMessages: 1
          })
        }
        
        this.showMenu = false
      } catch (error) {
        console.error('Erro ao alterar status de leitura:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao alterar status de leitura. Tente novamente.',
          position: 'bottom-right'
        })
      }
    },

    async togglePinnedStatus () {
      try {
        const response = await TogglePinnedTicket(this.ticket.id)
        const updatedTicket = response.data
        
        // Atualizar o ticket na lista
        this.$store.commit('UPDATE_TICKET', {
          ...this.ticket,
          isPinned: updatedTicket.isPinned
        })
        
        // Buscar tickets atualizados para refletir a nova ordem
        if (this.$parent && typeof this.$parent.BuscarTicketFiltro === 'function') {
          this.$parent.BuscarTicketFiltro()
        }
        
        this.showMenu = false
      } catch (error) {
        console.error('Erro ao alternar status de fixado:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao fixar/desfixar ticket. Tente novamente.',
          position: 'bottom-right'
        })
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

.ticket-tags-preview {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  /* Removido max-height e overflow-y para evitar quebra desnecessária */
}

.ticket-tag-chip {
  font-size: 11px !important;
  font-weight: 500 !important;
  padding: 2px 4px !important;
  border-radius: 8px !important;
  min-height: 20px !important;
  line-height: 1.2 !important;
}

.ticket-item {
  position: relative;
  background: #f1f1f1;
  border-radius: 8px;
  padding: 4px 6px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;

  &:hover {
    background: rgba(25, 118, 210, 0.05);
  }

  &--pending {
            background: #fff3e0;
  }

  &--closed {
    opacity: 0.8;
  }

  &--selected {
            background: rgba(25, 118, 210, 0.1);
    transform: translateY(-1px);

    .ticket-contact-name {
      color: #1976d2;
      font-weight: 700;
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
  width: 100%;
}

.unread-badge {
        background: #f44336;
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
  margin-bottom: 1px;

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

  .ticket-header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;

    .ticket-time {
      font-size: 10px;
      color: #7b8794;
      font-weight: 500;
      white-space: nowrap;
      background: rgba(123, 135, 148, 0.1);
      padding: 1px 6px;
      border-radius: 8px;
    }

    .ticket-id {
      font-weight: 600;
      color: #34495e;
      font-size: 9px;
    }
  }
}



.ticket-last-message {
  font-size: 13px;
  line-height: 1.3;
  margin-bottom: 4px;

  .message-content {
    display: flex;
    align-items: center;
    gap: 4px; // Espaçamento menor igual WhatsApp Web

    .message-text {
      flex: 1;
      display: -webkit-box;
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
  gap: 4px;
}

.ticket-details {
  display: flex;
  flex-direction: row;
  gap: 8px;
  flex: 1;
  align-items: center;

  .ticket-channel,
  .ticket-queue {
    display: flex;
    align-items: center;
    gap: 3px;
    color: #7b8794;

    .channel-icon {
      border-radius: 50%;
      color: #25D366 !important;
    }

    .channel-name {
      background: #e3f2fd;
      padding: 2px 5px;
      border-radius: 4px;
      font-weight: 500;
      color: #1976d2;
      font-size: 9px;
    }
  }
}

.ticket-metadata {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 1px;





  .ticket-user {
    color: #7b8794;
    font-size: 8px;
  }
}

.ticket-pinned-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  animation: pin-bounce 0.3s ease-in-out;
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
      background: #4caf50;
      color: white;
    }

    &--bot {
      background: #2196f3;
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
      background: rgba(144, 202, 249, 0.2);
    }

    .ticket-contact-name {
      color: var(--dark-text-secondary);
    }

    .ticket-time {
      background: rgba(255, 255, 255, 0.1);
      color: var(--dark-text-primary);
    }

    .ticket-header-right {
          .ticket-id {
      color: var(--dark-text-primary);
    }

    .ticket-pinned-indicator {
      color: var(--dark-accent);
    }
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

@keyframes pin-bounce {
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
  }
}

.message-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
  max-width: 100%;
}

.ticket-contact-name-text {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-word;
}

/* Responsive para o drawer de tickets */
@media (max-width: 768px) {
  .tickets-drawer {
    height: 100vh !important;
    max-height: 100vh !important;
  }

  .tickets-drawer-header {
    flex-shrink: 0;
    max-height: 140px;
    min-height: 140px;
  }

  .tickets-scroll-area {
    height: calc(100vh - 140px) !important;
    min-height: calc(100vh - 140px) !important;
  }
}

/* Estilos para o menu de contexto */
.ticket-context-menu {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.context-menu-item {
  padding: 8px 16px;
  border-radius: 4px;
  margin: 2px 4px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(25, 118, 210, 0.1);
  }
}

/* Dark mode para o menu de contexto */
.body--dark {
  .ticket-context-menu {
    background: var(--q-color-dark);
    border-color: var(--dark-border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .context-menu-item {
    &:hover {
      background-color: rgba(144, 202, 249, 0.1);
    }
  }
}
</style>
