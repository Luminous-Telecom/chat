const usuario = JSON.parse(localStorage.getItem('usuario'))
import Router from 'src/router/index'
import checkTicketFilter from 'src/utils/checkTicketFilter'
import { socketIO } from 'src/utils/socket'
import { ConsultarTickets } from 'src/service/tickets'

const socket = socketIO()

const userId = +localStorage.getItem('userId')

// localStorage.debug = '*'

socket.on(`tokenInvalid:${socket.id}`, () => {
  socket.disconnect()
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  localStorage.removeItem('profile')
  localStorage.removeItem('userId')
  localStorage.removeItem('usuario')
  setTimeout(() => {
    Router.push({
      name: 'login'
    })
  }, 1000)
})

export default {
  data () {
    return {
      processingMessages: new Set() // Set para controlar mensagens em processamento
    }
  },
  computed: {
    isMessageProcessing () {
      return messageId => this.$store.getters['atendimentoTicket/isMessageProcessing'](messageId)
    }
  },
  methods: {
    scrollToBottom () {
      setTimeout(() => {
        this.$root.$emit('scrollToBottomMessageChat')
      }, 200)
    },
    socketMessagesList () {

    },
    socketTicket () {
      socket.on('connect', () => {
        socket.on(`${usuario.tenantId}:ticket`, data => {
          if (data.action === 'update' && data.ticket.userId === userId) {
            if (data.ticket.status === 'open' && !data.ticket.isTransference) {
              this.$store.commit('TICKET_FOCADO', data.ticket)
            }
          }
        })
      })

      // socket.on(`${usuario.tenantId}:contact`, data => {
      //   if (data.action === 'update') {
      //     this.$store.commit('UPDATE_TICKET_CONTACT', data.contact)
      //     if (this.$store.getters.ticketFocado.contactId === data.contact.id) {
      //       this.$store.commit('UPDATE_TICKET_FOCADO_CONTACT', data.contact)
      //     }
      //   }
      // })
    },
    socketTicketList () {
      this.socketTicketListNew()
    },
    socketTicketListNew () {
      socket.on('connect', () => {
        socket.on(`${usuario.tenantId}:ticketList`, async data => {
          if (data.type === 'chat:create') {
            if (
              !data.payload.read &&
              (data.payload.ticket.userId === userId || !data.payload.ticket.userId) &&
              data.payload.ticket.id !== this.$store.getters.ticketFocado.id
            ) {
              if (checkTicketFilter(data.payload.ticket)) {
                this.handlerNotifications(data.payload)
              }
            }
            this.$store.commit('UPDATE_MESSAGES', data.payload)
            this.scrollToBottom()
            // Atualiza notificações de mensagem
            const params = {
              searchParam: '',
              pageNumber: 1,
              status: ['open'],
              showAll: false,
              count: null,
              queuesIds: [],
              withUnreadMessages: true,
              isNotAssignedUser: false,
              includeNotQueueDefined: true
            }
            try {
              const { data } = await ConsultarTickets(params)
              this.countTickets = data.count
              this.$store.commit('UPDATE_NOTIFICATIONS', data)
            } catch (err) {
              this.$notificarErro('Algum problema', err)
              console.error(err)
            }
          }

          if (data.type === 'chat:update') {
            // Verificar se a mensagem está em processamento
            if (this.isMessageProcessing(data.payload.messageId)) {
              return
            }
            this.$store.commit('UPDATE_MESSAGE_STATUS', {
              ticketId: data.payload.ticketId,
              messageId: data.payload.messageId,
              read: data.payload.read,
              ticket: data.payload.ticket
            })
          }

          if (data.type === 'chat:ack') {
            // Verificar se a mensagem está em processamento
            if (this.isMessageProcessing(data.payload.messageId)) {
              return
            }
            this.$store.commit('UPDATE_MESSAGE_STATUS', {
              ticketId: data.payload.ticketId,
              messageId: data.payload.messageId,
              ack: data.payload.ack,
              ticket: data.payload.ticket
            })
          }

          if (data.type === 'chat:messagesRead') {
            this.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', {
              type: this.status,
              ticket: {
                id: data.payload.ticketId,
                unreadMessages: data.payload.unreadMessages
              }
            })
          }
        })

        socket.on(`${usuario.tenantId}:ticketList`, async data => {
          var verify = []
          if (data.type === 'notification:new') {
            const params = {
              searchParam: '',
              pageNumber: 1,
              status: ['pending'],
              showAll: false,
              count: null,
              queuesIds: [],
              withUnreadMessages: false,
              isNotAssignedUser: false,
              includeNotQueueDefined: true
            }
            try {
              const data_noti = await ConsultarTickets(params)
              this.$store.commit('UPDATE_NOTIFICATIONS_P', data_noti.data)
              verify = data_noti
            } catch (err) {
              this.$notificarErro('Algum problema', err)
              console.error(err)
            }
            // Faz verificação para se certificar que notificação pertence a fila do usuário
            var pass_noti = false
            verify.data.tickets.forEach((element) => { pass_noti = (element.id == data.payload.id ? true : pass_noti) })
            // Exibe Notificação
            if (pass_noti) {
              // eslint-disable-next-line no-new
              new self.Notification('Novo cliente pendente', {
                body: 'Cliente: ' + data.payload.contact.name,
                tag: 'simple-push-demo-notification'
              })
            }
          }
        })

        socket.on(`${usuario.tenantId}:contactList`, data => {
          this.$store.commit('UPDATE_CONTACT', data.payload)
        })
      })
    },
    socketDisconnect () {
      socket.disconnect()
    }
  }
}
