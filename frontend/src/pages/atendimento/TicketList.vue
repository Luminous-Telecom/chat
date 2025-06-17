<template>
  <div>
    <q-scroll-area
      ref="scrollAreaTickets"
      style="height: calc(100vh - 300px)"
      @scroll="onScroll"
    >
      <!-- <q-separator /> -->
      <ItemTicket
        v-for="(ticket, key) in cTickets"
        :key="`ticket-list-${key}`"
        :ticket="ticket"
        :filas="filas"
      />
      <div v-if="loading">
        <div class="row justify-center q-my-md">
          <q-spinner
            color="white"
            size="3em"
            :thickness="3"
          />
        </div>
        <div class="row col justify-center q-my-sm text-white">
          Carregando...
        </div>
      </div>
    </q-scroll-area>

  </div>
</template>

<script>
import ItemTicket from './ItemTicket.vue'
import { mapGetters } from 'vuex'
import { ConsultarTickets } from 'src/service/tickets'
import { socketIO } from '../../utils/socket'

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
      socket: null,
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
        if (this.socket && this.ticketFocado?.id) {
          // console.log('[DEBUG FRONTEND] Emitting joinChatBox with tenantId:', this.ticketFocado.tenantId, 'ticketId:', this.ticketFocado.id)
          // console.log('[DEBUG FRONTEND] Channel:', `tenant:${this.ticketFocado.tenantId}:joinChatBox`)
        } else {
          // console.log('[DEBUG FRONTEND] Cannot emit joinChatBox - socket:', !!this.socket, 'ticketId:', this.ticketFocado?.id)
        }
      },
      immediate: true
    },
    socket: {
      handler (newVal, oldVal) {
        // //console.log('DEBUG: socket changed:', { newVal, oldVal, ticketFocado: this.ticketFocado })
        if (this.socket && this.ticketFocado?.id) {
          // console.log('[DEBUG FRONTEND] Socket handler - Emitting joinChatBox with tenantId:', this.ticketFocado.tenantId, 'ticketId:', this.ticketFocado.id)
          // console.log('[DEBUG FRONTEND] Socket handler - Channel:', `tenant:${this.ticketFocado.tenantId}:joinChatBox`)
        } else {
          // console.log('[DEBUG FRONTEND] Socket handler - Cannot emit joinChatBox - socket:', !!this.socket, 'ticketId:', this.ticketFocado?.id)
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
        this.$root.$emit('scrollToBottomMessageChat')
      }, 200)
    },
    ticketListSocket () {
      // console.log('[DEBUG] Initializing ticketListSocket')
      this.socket = socketIO()
      const usuario = JSON.parse(localStorage.getItem('usuario'))
      // console.log('[DEBUG] Socket created with tenantId:', usuario?.tenantId)

      const shouldUpdateTicket = (ticket) =>
        (!ticket.userId || ticket.userId === usuario?.userId || this.showAll) &&
        (!ticket.queueId || this.queuesIds.indexOf(ticket.queueId) > -1)

      const notBelongsToUserQueues = (ticket) =>
        ticket.queueId && this.queuesIds.indexOf(ticket.queueId) === -1

      this.socket.on('connect', () => {
        // console.log('[DEBUG FRONTEND] Socket connected successfully')
        // console.log('[DEBUG FRONTEND] Usuario tenantId:', usuario.tenantId)
        // console.log('[DEBUG FRONTEND] Joining tickets room:', `tenant:${usuario.tenantId}:joinTickets`, 'status:', this.status)
        this.socket.emit(`tenant:${usuario.tenantId}:joinTickets`, this.status)
        // console.log('[DEBUG FRONTEND] Joining tickets room completed')
        // console.log('[DEBUG FRONTEND] Joining notification room:', `tenant:${usuario.tenantId}:joinNotification`)
        this.socket.emit(`tenant:${usuario.tenantId}:joinNotification`)
        // console.log('[DEBUG FRONTEND] Joining notification room completed')
      })

      this.socket.on('disconnect', (reason) => {
        // console.log('[DEBUG] Socket disconnected:', reason)
      })

      this.socket.on('connect_error', (error) => {
        console.error('[DEBUG] Socket connection error:', error)
      })

      this.socket.on(`tenant:${usuario.tenantId}:ticket`, (data) => {
        // console.log('[DEBUG] Evento ticket recebido:', data)
        if (data.action === 'updateUnread') {
          // console.log('[DEBUG] Atualizando mensagens não lidas:', data)
          this.$store.commit('RESET_UNREAD', { type: this.status, ticketId: data.ticketId })
        }

        if (data.action === 'update' && shouldUpdateTicket(data.ticket)) {
          // console.log('[DEBUG] Atualizando ticket:', data.ticket)
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
          // console.log('[DEBUG] Deletando ticket:', data.ticket)
          this.$store.commit('DELETE_TICKET', { type: this.status, ticketId: data.ticketId })
        }
      })

      // console.log('[DEBUG TICKETLIST] Registrando listener para canal:', `tenant:${usuario.tenantId}:appMessage`)
      // console.log('[DEBUG TICKETLIST] Usuario tenantId:', usuario.tenantId)

      this.socket.on(`tenant:${usuario.tenantId}:appMessage`, (data) => {
        // console.log('[DEBUG TICKETLIST] ===== EVENTO APPMESSAGE RECEBIDO =====', data)
        // console.log('[DEBUG TICKETLIST] Canal:', `tenant:${usuario.tenantId}:appMessage`)
        // console.log('[DEBUG TICKETLIST] Action:', data.action)
        // console.log('[DEBUG TICKETLIST] Message isDeleted:', data.message?.isDeleted)
        // console.log('[DEBUG TICKETLIST] Message ID:', data.message?.id)
        // console.log('[DEBUG TICKETLIST] Ticket ID:', data.ticket?.id)

        if (data.action === 'create' && shouldUpdateTicket(data.ticket)) {
          if (this.ticketFocado.id !== data.ticket.id && this.status !== 'closed' && !data.message.fromMe && !data.ticket.chatFlowId) {
            this.$root.$emit('handlerNotifications', data.message)
          }
          // console.log('[DEBUG] Criando mensagem de app, atualizando contagem não lidas:', {
          //  type: this.status,
          //  ticket: data.ticket
          // })
          this.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', { type: this.status, ticket: data.ticket })
        }

        if (data.action === 'update' && shouldUpdateTicket(data.ticket)) {
          // console.log('[DEBUG TICKETLIST] Atualizando mensagem de app:', data)
          // console.log('[DEBUG TICKETLIST] Message isDeleted:', data.message?.isDeleted)
          // console.log('[DEBUG TICKETLIST] Message ID:', data.message?.id)
          // console.log('[DEBUG TICKETLIST] shouldUpdateTicket result:', shouldUpdateTicket(data.ticket))

          // Atualizar a mensagem no store para refletir mudanças como isDeleted
          const messageWithTicket = {
            ...data.message,
            ticket: data.ticket
          }
          // console.log('[DEBUG TICKETLIST] Mensagem preparada para store:', messageWithTicket)
          this.$store.commit('UPDATE_MESSAGES', messageWithTicket)
          // console.log('[DEBUG TICKETLIST] UPDATE_MESSAGES executado')

          // Atualizar contagem de mensagens não lidas se necessário
          this.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', { type: this.status, ticket: data.ticket })
          // console.log('[DEBUG TICKETLIST] UPDATE_TICKET_UNREAD_MESSAGES executado')
        } else {
          // console.log('[DEBUG TICKETLIST] Condição não atendida:')
          // console.log('[DEBUG TICKETLIST] - action:', data.action)
          // console.log('[DEBUG TICKETLIST] - shouldUpdateTicket:', shouldUpdateTicket(data.ticket))
          // console.log('[DEBUG TICKETLIST] - ticket:', data.ticket)
        }
      })

      // Add listener for chat:create events
      this.socket.on(`tenant:${usuario.tenantId}:ticketList`, (data) => {
        // console.log('[DEBUG] Evento ticketList recebido:', data)
        if (data.type === 'chat:create') {
          // console.log('[DEBUG] Processando chat:create no ticketList:', data.payload)
        }
      })
    },
    registerPropWatchers (propNames) {
      propNames.forEach(propName => {
        this.$watch(propName, (newVal, oldVal) => {
          if (propName != 'searchParam') {
            if (this.socket) {
              this.socket.disconnect()
            }
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
    if (this.socket) {
      this.socket.disconnect()
    }
  }
}
</script>

<style lang="scss" scoped>
</style>
