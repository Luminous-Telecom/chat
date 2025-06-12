const usuario = JSON.parse(localStorage.getItem('usuario'))
import Router from 'src/router/index'
import checkTicketFilter from 'src/utils/checkTicketFilter'
import { socketIO } from 'src/utils/socket'
import { ConsultarTickets } from 'src/service/tickets'
import { debounce } from 'quasar'

const socket = socketIO()
const DEBOUNCE_TIME = 300 // Manter em 300ms para ser responsivo mas evitar duplicações
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
      processingMessages: new Set(), // Set para controlar mensagens em processamento
      ultimoStatusMensagem: new Map(), // Mapa para rastrear último status da mensagem
      ultimaAtualizacaoNaoLidas: new Map(), // Mapa para rastrear última atualização de não lidas
      ultimoAck: new Map() // Mapa para rastrear último ack de cada mensagem
    }
  },
  computed: {
    isMessageProcessing () {
      return this.$store.getters['atendimentoTicket/isMessageProcessing']
    }
  },
  created () {
    // Criar versões com debounce das funções de atualização
    this.atualizarStatusMensagemComDebounce = debounce(this.atualizarStatusMensagem, DEBOUNCE_TIME)
    this.atualizarNaoLidasComDebounce = debounce(this.atualizarNaoLidas, DEBOUNCE_TIME)
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
      const self = this // Guardar contexto do componente

      socket.on('connect', () => {
        socket.on(`${usuario.tenantId}:ticketList`, async function (data) {
          if (data.type === 'chat:create') {
            if (
              !data.payload.read &&
              (data.payload.ticket.userId === userId || !data.payload.ticket.userId) &&
              data.payload.ticket.id !== self.$store.getters.ticketFocado.id
            ) {
              if (checkTicketFilter(data.payload.ticket)) {
                self.handlerNotifications(data.payload)
              }
            }
            // Garantir que temos o ID do ticket no payload
            const ticketId = data.payload.ticket?.id
            if (!ticketId) {
              console.warn('[socketTicketList] ID do ticket ausente no payload:', data.payload)
              return
            }

            // Atualizar mensagem primeiro
            const messagePayload = {
              ...data.payload,
              id: data.payload.id || data.payload.messageId // Garantir que sempre temos um ID
            }
            self.$store.commit('UPDATE_MESSAGES', messagePayload)
            self.scrollToBottom()

            // Atualizar contagem de não lidas apenas se for uma nova mensagem não lida
            // e não for do usuário atual
            if (data.payload.ticket?.unreadMessages !== undefined &&
                !data.payload.fromMe &&
                !data.payload.read &&
                data.payload.ticket.userId !== userId) {
              // Usar o valor do backend diretamente
              self.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', {
                type: self.status,
                ticket: {
                  id: data.payload.ticket.id,
                  unreadMessages: data.payload.ticket.unreadMessages
                }
              })
            }

            // Atualizar notificações de mensagem
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
              self.countTickets = data.count
              self.$store.commit('UPDATE_NOTIFICATIONS', data)
            } catch (err) {
              self.$notificarErro('Algum problema', err)
              console.error(err)
            }
          }

          if (data.type === 'chat:update') {
            const messageId = data.payload.messageId
            const ticketId = data.payload.ticket?.id

            // Pular se dados obrigatórios estiverem ausentes
            if (!messageId || !ticketId) {
              return
            }

            // Usar atualização com debounce
            self.atualizarStatusMensagemComDebounce({
              messageId,
              ticketId,
              read: data.payload.read || false, // Garantir que read nunca seja undefined
              ticket: data.payload.ticket
            })
          }

          if (data.type === 'chat:ack') {
            const messageId = data.payload.id || data.payload.messageId // Garantir que temos um ID
            const ticketId = data.payload.ticket?.id

            // Pular se dados obrigatórios estiverem ausentes
            if (!messageId || !ticketId) {
              console.warn('[chat:ack] Dados obrigatórios ausentes:', data.payload)
              return
            }

            // Preparar payload comum
            const statusPayload = {
              id: messageId,
              messageId: data.payload.messageId,
              ticketId,
              ack: data.payload.ack,
              read: data.payload.ack >= 3, // Considerar lido quando ack >= 3
              status: data.payload.status,
              ticket: data.payload.ticket
            }

            // Atualizar status imediatamente para ack >= 3 (mensagem lida)
            // ou quando o ack é maior que o atual
            const chave = `${ticketId}-${messageId}`
            const statusAtual = self.ultimoStatusMensagem.get(chave)

            if (data.payload.ack >= 3 || !statusAtual || data.payload.ack > statusAtual.ack) {
              self.atualizarStatusMensagem(statusPayload)
            } else {
              // Para outros casos, usar debounce
              self.atualizarStatusMensagemComDebounce(statusPayload)
            }
          }

          if (data.type === 'chat:messagesRead') {
            const ticketId = data.payload.ticketId
            if (!ticketId) {
              console.warn('[socketTicketList] ID do ticket ausente no payload de messagesRead:', data.payload)
              return
            }

            // Usar o valor do backend diretamente
            self.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', {
              type: self.status,
              ticket: {
                id: ticketId,
                unreadMessages: data.payload.unreadMessages
              }
            })
          }
        })

        socket.on(`${usuario.tenantId}:ticketList`, async function (data) {
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
              self.$store.commit('UPDATE_NOTIFICATIONS_P', data_noti.data)
              verify = data_noti
            } catch (err) {
              self.$notificarErro('Algum problema', err)
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

        socket.on(`${usuario.tenantId}:contactList`, function (data) {
          self.$store.commit('UPDATE_CONTACT', data.payload)
        })
      })
    },
    socketDisconnect () {
      socket.disconnect()
    },
    // Método auxiliar para atualizar status da mensagem
    atualizarStatusMensagem (payload) {
      const { id, messageId, ticketId, ack, read, status, ticket, fromMe } = payload
      if (!messageId || !ticketId) {
        console.warn('[atualizarStatusMensagem] Dados obrigatórios ausentes:', payload)
        return
      }

      const chave = `${ticketId}-${messageId}`
      const statusAtual = this.ultimoStatusMensagem.get(chave)

      // Se já temos um status atual, verificar se a nova atualização é relevante
      if (statusAtual) {
        // Se o ack atual é maior que o novo, ignorar a atualização silenciosamente
        if (statusAtual.ack > ack) {
          return
        }

        // Se o ack é igual e o read não mudou, ignorar a atualização
        if (statusAtual.ack === ack && statusAtual.read === (read || false)) {
          return
        }
      }

      // Atualizar último status conhecido
      const novoStatus = {
        ack,
        read: read || false,
        fromMe: fromMe // Preservar o valor de fromMe
      }
      this.ultimoStatusMensagem.set(chave, novoStatus)
      this.ultimoAck.set(chave, ack)

      // Commit no store com todos os dados necessários
      this.$store.commit('UPDATE_MESSAGE_STATUS', {
        id: id || messageId,
        ticketId,
        messageId,
        ack,
        read: novoStatus.read,
        status: status || this.getStatusFromAck(ack),
        ticket,
        fromMe: fromMe // Garantir que fromMe seja incluído no commit
      })

      // Não atualizar contagem de não lidas aqui, deixar o backend controlar
    },

    // Método auxiliar para obter status a partir do ack
    getStatusFromAck (ack) {
      switch (ack) {
        case 3:
          return 'received'
        case 2:
          return 'delivered'
        default:
          return 'sended'
      }
    },

    // Método auxiliar para atualizar mensagens não lidas
    atualizarNaoLidas (payload) {
      const { ticketId, unreadMessages, type } = payload
      if (!ticketId || unreadMessages === undefined) {
        console.warn('[atualizarNaoLidas] Dados obrigatórios ausentes:', payload)
        return
      }

      const chave = `${ticketId}-${type || 'open'}`
      const contagemAtual = this.ultimaAtualizacaoNaoLidas.get(chave)

      // Pular se a contagem não mudou ou é inválida
      if (contagemAtual === unreadMessages || unreadMessages < 0) {
        return
      }

      // Atualizar última contagem conhecida
      this.ultimaAtualizacaoNaoLidas.set(chave, unreadMessages)

      // Commit no store
      this.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', {
        type: type || 'open',
        ticket: {
          id: ticketId,
          unreadMessages
        }
      })
    }
  }
}
