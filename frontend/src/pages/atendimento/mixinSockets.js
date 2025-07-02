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
      ultimoAck: new Map(), // Mapa para rastrear último ack de cada mensagem
      debounceTimeout: null,
      isFirstLoad: true, // Controle para primeira carga
      createdTimestamp: null // Novo campo para armazenar o timestamp de criação
    }
  },
  computed: {
    isMessageProcessing () {
      return this.$store.getters['atendimentoTicket/isMessageProcessing']
    }
  },
  created () {
    this.createdTimestamp = Date.now()
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
      const self = this
      socket.on('connect', () => {
        socket.on(`tenant:${usuario.tenantId}:appMessage`, (data) => {
          if (data.action === 'create' && data.message) {
            // Processar a nova mensagem
            const messageWithTicket = {
              ...data.message,
              ticket: data.ticket
            }

            self.$store.commit('UPDATE_MESSAGES', messageWithTicket)
          } else if (data.action === 'update' && data.message) {
            // Atualizar a mensagem no store para refletir mudanças como isDeleted ou status canceled
            const messageWithTicket = {
              ...data.message,
              ticket: data.ticket
            }

            self.$store.commit('UPDATE_MESSAGES', messageWithTicket)

            // Se a mensagem tem scheduleDate e foi cancelada, chamar também UPDATE_MESSAGE_STATUS
            if (data.message.scheduleDate && data.message.status === 'canceled') {
              self.$store.commit('UPDATE_MESSAGE_STATUS', {
                ...data.message,
                ticket: data.ticket
              })
            }
          }
        })
      })
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
            // Verificar se deve enviar notificação
            const shouldNotify = checkTicketFilter(data.payload.ticket) &&
                !data.payload.fromMe &&
                !data.payload.read &&
                data.payload.ticket.userId !== userId

            if (shouldNotify) {
              // Não tocar som na primeira carga (primeiros 3 segundos)
              if (!self.isFirstLoad || (Date.now() - self.createdTimestamp) > 3000) {
                self.handlerNotifications(data.payload)
              }
            }

            // Garantir que temos o ID do ticket no payload
            const ticketId = data.payload.ticket?.id
            if (!ticketId) {
              console.warn('[socketTicketList] ID do ticket ausente no payload:', data.payload)
              return
            }

            // Garantir que temos o ID do ticket no payload
            if (data.payload.ticket && !data.payload.ticketId) {
              data.payload.ticketId = data.payload.ticket.id
            }

            // Adicionar mensagem ao processamento
            const messageId = data.payload.id || data.payload.messageId
            if (messageId) {
              self.$store.commit('ADD_MESSAGE_PROCESSING', messageId)
            } else {
              console.warn('[DEBUG] Mensagem sem ID encontrada:', data.payload)
            }

            // Atualizar mensagem primeiro
            const messagePayload = {
              ...data.payload,
              id: data.payload.id || data.payload.messageId // Garantir que sempre temos um ID
            }
            self.$store.commit('UPDATE_MESSAGES', messagePayload)
            self.scrollToBottom()

            // Remover mensagem do processamento após atualização
            if (messageId) {
              self.$store.commit('REMOVE_MESSAGE_PROCESSING', messageId)
            }

            // Atualizar contagem de não lidas apenas se for uma nova mensagem não lida
            // e não for do usuário atual
            if (data.payload.ticket?.unreadMessages !== undefined &&
                !data.payload.fromMe &&
                !data.payload.read &&
                data.payload.ticket.userId !== userId) {
              self.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', {
                type: self.status,
                ticket: {
                  id: data.payload.ticket.id,
                  unreadMessages: data.payload.ticket.unreadMessages
                }
              })
            } else {
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
              console.error('[DEBUG] Erro ao consultar tickets:', err)
              self.$notificarErro('Algum problema', err)
            }
          }

          if (data.type === 'chat:update') {
            const messageId = data.payload.messageId
            const ticketId = data.payload.ticket?.id

            // Pular se dados obrigatórios estiverem ausentes
            if (!messageId || !ticketId) {
              console.warn('[DEBUG] Dados obrigatórios ausentes em chat:update:', {
                messageId,
                ticketId
              })
              return
            }

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
              console.warn('[DEBUG] Dados obrigatórios ausentes em chat:ack:', {
                messageId,
                ticketId,
                payload: data.payload
              })
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

            // Verificar se deve processar imediatamente
            const chave = `${ticketId}-${messageId}`
            const statusAtual = self.ultimoStatusMensagem.get(chave)

            // Processar imediatamente nos casos:
            // 1. ACK >= 3 (mensagem lida)
            // 2. Não existe status atual
            // 3. ACK é maior que o atual
            // 4. ACK 5 (áudio ouvido) mesmo se atual for 3 (visualizado)
            const processarImediatamente = data.payload.ack >= 3 ||
                                         !statusAtual ||
                                         data.payload.ack > statusAtual.ack ||
                                         (data.payload.ack === 5 && statusAtual?.ack === 3)

            if (processarImediatamente) {
              // Processar áudios imediatamente para melhor responsividade
              if (data.payload.mediaType === 'audio') {

              }
              self.atualizarStatusMensagem(statusPayload)
            } else {
              // Para outros casos, usar debounce
              self.atualizarStatusMensagemComDebounce(statusPayload)
            }

            // 🔥 NOVO: Atualizar ACK da última mensagem no ticket se necessário
            if (data.payload.ticket && data.payload.fromMe) {
              self.$store.commit('UPDATE_TICKET_LAST_MESSAGE_ACK', {
                ticketId: data.payload.ticket.id,
                lastMessageAck: data.payload.ack,
                lastMessageFromMe: data.payload.fromMe
              })
            }
          }

          if (data.type === 'chat:messagesRead') {
            const ticketId = data.payload.ticketId
            const unreadMessages = data.payload.unreadMessages

            // Atualizar contagem de mensagens não lidas do ticket
            self.atualizarNaoLidas({
              ticketId,
              unreadMessages,
              type: self.status
            })

            // Atualizar notificações para refletir a mudança
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
              console.error('[DEBUG] Erro ao consultar tickets após chat:messagesRead:', err)
              self.$notificarErro('Algum problema', err)
            }
          }

          if (data.type === 'ticket:update') {
            const ticket = data.payload

            // Verificar se o ticket deve ser exibido com base nos filtros atuais
            if (checkTicketFilter(ticket)) {
              self.$store.commit('UPDATE_TICKET', ticket)
            } else {
              self.$store.commit('DELETE_TICKET', ticket.id)
            }
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
            // Enviar notificação push via backend
            if (pass_noti) {
              fetch('/api/push/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({
                  title: 'Novo cliente pendente',
                  body: `Cliente: ${data.payload.contact.name}`,
                  icon: '/icons/icon-128x128.png',
                  data: { url: '/atendimento' }
                })
              })
            }
          }
        })

        socket.on(`${usuario.tenantId}:contactList`, function (data) {
          self.$store.commit('UPDATE_CONTACT', data.payload)
        })

        // 🔥 NOVO: Listener para eventos de leitura automática
        socket.on(`${usuario.tenantId}:messageRead`, function (data) {
          if (data.type === 'message:read' && data.payload) {
            const { messageId, ticketId, ack, ticket } = data.payload

            // Atualizar status da mensagem como lida
            self.$store.commit('UPDATE_MESSAGE_STATUS', {
              id: messageId,
              messageId,
              ticketId,
              read: true,
              ack: ack || 3,
              ticket
            })

            // Atualizar contador de mensagens não lidas do ticket
            if (ticket && ticket.unreadMessages !== undefined) {
              self.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', {
                type: self.status || 'open',
                ticket: {
                  id: ticketId,
                  unreadMessages: ticket.unreadMessages,
                  answered: ticket.answered
                }
              })

              // 🔥 NOVO: Atualizar notifications para sincronizar menu lateral e título da guia
              self.atualizarNotificacoesGlobais()
            }
          }
        })

        // 🔥 NOVO: Listener para eventos específicos de auto-read
        socket.on(`${usuario.tenantId}:messageAutoRead`, function (data) {
          if (data.type === 'message:autoRead' && data.payload) {
            const { messageId, ticketId, ack, ticket } = data.payload

            // Destacar visualmente que foi uma leitura automática
            // Pode ser usado para mostrar uma indicação visual diferente
            self.$store.commit('UPDATE_MESSAGE_STATUS', {
              id: messageId,
              messageId,
              ticketId,
              read: true,
              ack: ack || 3,
              automatic: true, // Flag para indicar leitura automática
              ticket
            })

            // Atualizar contador de mensagens não lidas do ticket
            if (ticket && ticket.unreadMessages !== undefined) {
              self.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', {
                type: self.status || 'open',
                ticket: {
                  id: ticketId,
                  unreadMessages: ticket.unreadMessages,
                  answered: ticket.answered
                }
              })

              // 🔥 NOVO: Atualizar notifications para sincronizar menu lateral e título da guia
              self.atualizarNotificacoesGlobais()
            }

            // Notificação removida conforme solicitado
            /*
            // Mostrar notificação sutil (opcional)
            if (self.$q && self.$q.notify) {
              self.$q.notify({
                type: 'positive',
                message: '📱 Sincronizado com WhatsApp',
                caption: 'Mensagem marcada como lida automaticamente',
                position: 'bottom-right',
                timeout: 3000,
                actions: [
                  { icon: 'close', color: 'white', round: true, handler: () => {} }
                ]
              })
            }
            */
          }
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
        // Permitir ACK 5 sobrescrever ACK 3 (áudio ouvido sobrescreve visualizado)
        const podeAtualizar = ack > statusAtual.ack ||
                             (ack === 5 && statusAtual.ack === 3)

        // Se o ack atual é maior que o novo e não é o caso especial do ACK 5
        if (!podeAtualizar) {
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
        case 5:
          return 'played' // ACK 5 = áudio ouvido/reproduzido
        case 3:
          return 'received'
        case 2:
          return 'delivered' // Keep as 'delivered' for display purposes
        case 1:
          return 'sended'
        default:
          return 'pending'
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
    },
    // Marcar que a primeira carga foi concluída
    markFirstLoadComplete () {
      this.isFirstLoad = false
    },

    // 🔥 NOVO: Método para atualizar notificações globais (menu lateral e título da guia)
    async atualizarNotificacoesGlobais () {
      try {
        // Atualizar notifications (tickets em andamento com mensagens não lidas)
        const paramsOpen = {
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

        const { data: dataOpen } = await ConsultarTickets(paramsOpen)
        this.$store.commit('UPDATE_NOTIFICATIONS', dataOpen)

        // Atualizar título da guia
        if (this.$root && this.$root.atualizarTituloGuia) {
          this.$root.atualizarTituloGuia()
        } else {
          // Fallback: atualizar título diretamente
          const notifications = this.$store.getters.notifications
          const notifications_p = this.$store.getters.notifications_p

          // Importar dinamicamente a função de atualização do título
          import('src/helpers/helpersNotifications').then(mod => {
            mod.atualizarTituloGuia(notifications, notifications_p)
          })
        }
      } catch (err) {
        console.error('[Frontend] ❌ Erro ao atualizar notificações globais:', err)
      }
    }
  }
}
