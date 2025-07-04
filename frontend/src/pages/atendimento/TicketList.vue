<template>
  <div class="ticket-list-container">
    <q-scroll-area
      ref="scrollAreaTickets"
      class="ticket-scroll-area modern-scrollbar"
      :class="{ 'ticket-scroll-area--loading': loading }"
      @scroll="onScroll"
    >
      <!-- Lista de tickets -->
      <div class="tickets-wrapper">
        <ItemTicket
          v-for="(ticket, key) in cTickets"
          :key="`ticket-list-${key}`"
          :ticket="ticket"
          :filas="filas"
        />

        <!-- Empty state -->
        <div v-if="!loading && cTickets.length === 0" class="empty-state">
          <div class="empty-state-icon">
            <q-icon name="mdi-ticket-outline" size="48px" />
          </div>
          <div class="empty-state-title">Nenhum atendimento encontrado</div>
          <div class="empty-state-subtitle">
            Não há tickets disponíveis no momento
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="loading-container">
        <div class="loading-content">
          <div class="loading-spinner">
            <q-spinner-dots
              color="primary"
              size="40px"
            />
          </div>
          <div class="loading-text">
            Carregando atendimentos...
          </div>
        </div>
      </div>
    </q-scroll-area>
  </div>
</template>

<script>
import ItemTicket from './ItemTicket.vue'
import { mapGetters } from 'vuex'
import { ConsultarTickets } from 'src/service/tickets'
import socket from 'src/utils/socket'

export default {
  name: 'TocketList',
  components: {
    ItemTicket
  },
  props: {
    filas: {
      type: Array,
      default: () => []
    },
    status: {
      type: String,
      default: 'open'
    },
    searchParam: {
      type: String,
      default: ''
    },
    showAll: {
      type: Boolean,
      default: false
    },
    withUnreadMessages: {
      type: Boolean,
      default: false
    },
    isNotAssignedUser: {
      type: Boolean,
      default: false
    },
    includeNotQueueDefined: {
      type: Boolean,
      default: true
    },
    queuesIds: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      loading: false,
      countTickets: 0,
      hasMore: true,
      pesquisaTickets: {
        pageNumber: 1,
        count: null
        // date: new Date(),
      }
    }
  },
  computed: {
    ...mapGetters([
      'getTickets',
      'ticketFocado',
      'whatsapps'
    ]),
    cTickets () {
      return this.getTickets(this.status)
    }
  },
  watch: {
    'ticketFocado.id': {
      handler (newVal, oldVal) {
        // //console.log('DEBUG: ticketFocado.id changed:', { newVal, oldVal, ticketFocado: this.ticketFocado })
        if (this.ticketFocado?.id) {
          // console.log('[DEBUG FRONTEND] Emitting joinChatBox with tenantId:', this.ticketFocado.tenantId, 'ticketId:', this.ticketFocado.id)
          // console.log('[DEBUG FRONTEND] Channel:', `tenant:${this.ticketFocado.tenantId}:joinChatBox`)
        } else {
          // console.log('[DEBUG FRONTEND] Cannot emit joinChatBox - socket:', !!this.socket, 'ticketId:', this.ticketFocado?.id)
        }
      },
      immediate: true
    }
  },
  methods: {
    onScroll (info) {
      if (info.verticalPercentage <= 0.85) return
      this.onLoadMore()
    },
    async onLoadMore () {
      if (this.cTickets.length === 0 || !this.hasMore || this.loading) {
        return
      }
      try {
        this.loading = true
        this.pesquisaTickets.pageNumber++
        await this.consultarTickets()
        this.loading = false
      } catch (error) {
        this.loading = false
      }
    },
    async consultarTickets (paramsInit = {}) {
      const params = {
        ...this.pesquisaTickets,
        status: this.status,
        searchParam: this.searchParam,
        showAll: this.showAll,
        withUnreadMessages: this.withUnreadMessages,
        isNotAssignedUser: this.isNotAssignedUser,
        includeNotQueueDefined: this.includeNotQueueDefined,
        queuesIds: this.queuesIds,
        ...paramsInit
      }

      if (params.pageNumber == 1) {
        this.$store.commit('RESET_TICKETS', this.status)
      }

      try {
        const { data } = await ConsultarTickets(params)
        this.countTickets = data.count // count total de tickets no status
        this.$store.commit('LOAD_TICKETS', {
          tickets: data.tickets,
          filters: params
        })
        this.hasMore = data.hasMore
      } catch (err) {
        this.$notificarErro('Algum problema', err)
        console.error(err)
      }
      // return () => clearTimeout(delayDebounceFn)
    },
    // async BuscarTicketFiltro () {
    //   this.$store.commit('RESET_TICKETS', this.status)
    //   this.loading = true
    //   localStorage.setItem('filtrosAtendimento', JSON.stringify(this.pesquisaTickets))
    //   this.pesquisaTickets = {
    //     ...this.pesquisaTickets,
    //     pageNumber: 1
    //   }
    //   await this.consultarTickets(this.pesquisaTickets)
    //   this.loading = false
    //   this.$setConfigsUsuario({ isDark: this.$q.dark.isActive })
    // },
    scrollToBottom () {
      setTimeout(() => {
        this.$eventBus.emit('scrollToBottomMessageChat')
      }, 200)
    },
    ticketListSocket () {
      // console.log('[DEBUG] Initializing ticketListSocket')
      const usuario = JSON.parse(localStorage.getItem('usuario'))
      // console.log('[DEBUG] Socket created with tenantId:', usuario?.tenantId)

      const shouldUpdateTicket = (ticket) => {
        const result = (!ticket.userId || ticket.userId === usuario?.userId || this.showAll) &&
          (!ticket.queueId || this.queuesIds.indexOf(ticket.queueId) > -1)

        console.log('[shouldUpdateTicket] Verificando ticket:', {
          ticketId: ticket.id,
          ticketUserId: ticket.userId,
          usuarioUserId: usuario?.userId,
          showAll: this.showAll,
          ticketQueueId: ticket.queueId,
          queuesIds: this.queuesIds,
          result: result
        })

        return result
      }

      const notBelongsToUserQueues = (ticket) =>
        ticket.queueId && this.queuesIds.indexOf(ticket.queueId) === -1

      socket.on('connect', () => {
        socket.emit(`tenant:${usuario.tenantId}:joinTickets`, this.status)
        socket.emit(`tenant:${usuario.tenantId}:joinNotification`)
      })

      socket.on('disconnect', (reason) => {
        // console.log('[DEBUG] Socket disconnected:', reason)
      })

      socket.on('connect_error', (error) => {
        console.error('[DEBUG] Socket connection error:', error)
      })

      socket.on(`tenant:${usuario.tenantId}:ticket`, (data) => {
        if (data.action === 'updateUnread') {
          this.$store.commit('RESET_UNREAD', { type: this.status, ticketId: data.ticketId })
        }

        if (data.action === 'update' && shouldUpdateTicket(data.ticket)) {
          this.$store.commit('UPDATE_TICKET', {
            ticket: data.ticket,
            filters: {
              status: [this.status],
              showAll: this.showAll,
              withUnreadMessages: this.withUnreadMessages,
              isNotAssignedUser: this.isNotAssignedUser,
              includeNotQueueDefined: this.includeNotQueueDefined,
              queuesIds: this.queuesIds
            }
          })
        }

        if (data.action === 'update' && notBelongsToUserQueues(data.ticket)) {
          this.$store.commit('DELETE_TICKET', { type: this.status, ticketId: data.ticket.id })
        }

        if (data.action === 'delete') {
          this.$store.commit('DELETE_TICKET', { type: this.status, ticketId: data.ticketId })
        }
      })

      socket.on(`tenant:${usuario.tenantId}:ticketList`, (data) => {
        if (data.type === 'chat:create') {
          // console.log('[DEBUG] Processando chat:create no ticketList:', data.payload)
        }
      })
    },
    registerPropWatchers (propNames) {
      propNames.forEach(propName => {
        this.$watch(propName, (newVal, oldVal) => {
          if (propName != 'searchParam') {
            this.ticketListSocket()
          }
          this.consultarTickets({ pageNumber: 1 })
        })
      })
    }
  },
  mounted () {
    // //console.log('DEBUG: TicketList mounted - ticketFocado:', this.ticketFocado)
    // //console.log('DEBUG: TicketList mounted - socket:', this.socket)
    // this.consultarTickets()
    this.ticketListSocket()
    this.registerPropWatchers([
      'status',
      'showAll',
      'withUnreadMessages',
      'isNotAssignedUser',
      'includeNotQueueDefined',
      'queuesIds',
      'searchParam'
    ])
  },
  beforeDestroy () {
    // Remover: if (this.socket) { this.socket.disconnect() }
  }
}
</script>

<style lang="scss" scoped>
.ticket-list-container {
  height: calc(100vh - 300px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ticket-scroll-area {
  flex: 1;
  background: transparent;

  &--loading {
    overflow: hidden;
  }

  // Estilização customizada do scroll removida - usando scrollbar global
}

.tickets-wrapper {
  padding: 4px 0;
  min-height: 100%;

  // Animação suave para novos tickets
  :deep(.ticket-item-container) {
    animation: ticket-fade-in 0.5s ease-out;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  text-align: center;
  opacity: 0.7;
  animation: fade-in 0.6s ease-out;

  .empty-state-icon {
    margin-bottom: 16px;
    color: #9e9e9e;
    animation: float 3s ease-in-out infinite;
  }

  .empty-state-title {
    font-size: 18px;
    font-weight: 600;
    color: #5a6c7d;
    margin-bottom: 8px;
  }

  .empty-state-subtitle {
    font-size: 14px;
    color: #7b8794;
    max-width: 300px;
    line-height: 1.4;
  }
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  min-height: 200px;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  animation: fade-in 0.5s ease-out;

  .loading-spinner {
    animation: pulse 2s ease-in-out infinite;
  }

  .loading-text {
    font-size: 14px;
    color: #7b8794;
    font-weight: 500;
    text-align: center;
  }
}

// Dark mode
.body--dark {
  .ticket-list-container {
    background: transparent;
  }

  .ticket-scroll-area {
    :deep(.q-scrollarea__thumb--v) {
      background: rgba(144, 202, 249, 0.3);

      &:hover {
        background: rgba(144, 202, 249, 0.5);
      }
    }

    :deep(.q-scrollarea__bar--v) {
      background: rgba(255, 255, 255, 0.05);
    }
  }

  .empty-state {
    .empty-state-icon {
      color: var(--dark-text-primary);
      opacity: 0.5;
    }

    .empty-state-title {
      color: var(--dark-text-secondary);
    }

    .empty-state-subtitle {
      color: var(--dark-text-primary);
    }
  }

  .loading-content {
    .loading-text {
      color: var(--dark-text-primary);
    }
  }
}

// Animations
@keyframes ticket-fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

// Responsive
@media (max-width: 768px) {
  .ticket-list-container {
    height: calc(100vh - 200px);
  }

  .empty-state {
    height: 300px;
    padding: 20px;

    .empty-state-title {
      font-size: 16px;
    }

    .empty-state-subtitle {
      font-size: 13px;
    }
  }
}
</style>
