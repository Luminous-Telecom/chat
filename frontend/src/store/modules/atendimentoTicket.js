import { ConsultarDadosTicket, LocalizarMensagens } from 'src/service/tickets'
import { Notify } from 'quasar'
import $router from 'src/router'
import { orderBy } from 'lodash'
import { parseISO } from 'date-fns'

const orderMessages = (messages) => {
  const newMessages = orderBy(messages, (obj) => parseISO(obj.timestamp || obj.createdAt), ['asc'])
  return [...newMessages]
}

const checkTicketFilter = (ticket) => {
  const filtroPadrao = {
    searchParam: '',
    pageNumber: 1,
    status: ['open', 'pending'],
    showAll: false,
    count: null,
    queuesIds: [],
    withUnreadMessages: false,
    isNotAssignedUser: false,
    includeNotQueueDefined: true
    // date: new Date(),
  }

  const NotViewTicketsChatBot = () => {
    const configuracoes = JSON.parse(localStorage.getItem('configuracoes'))
    const conf = configuracoes?.find(c => c.key === 'NotViewTicketsChatBot')
    return (conf?.value === 'enabled')
  }

  const DirectTicketsToWallets = () => {
    const configuracoes = JSON.parse(localStorage.getItem('configuracoes'))
    const conf = configuracoes?.find(c => c.key === 'DirectTicketsToWallets')
    return (conf?.value === 'enabled')
  }

  const isNotViewAssignedTickets = () => {
    const configuracoes = JSON.parse(localStorage.getItem('configuracoes'))
    const conf = configuracoes?.find(c => c.key === 'NotViewAssignedTickets')
    return (conf?.value === 'enabled')
  }
  const filtros = JSON.parse(localStorage.getItem('filtrosAtendimento')) || filtroPadrao
  const usuario = JSON.parse(localStorage.getItem('usuario'))
  const UserQueues = JSON.parse(localStorage.getItem('queues'))
  const filasCadastradas = JSON.parse(localStorage.getItem('filasCadastradas') || '[]')
  const profile = localStorage.getItem('profile')
  const isAdminShowAll = profile === 'admin' && filtros.showAll
  const isQueuesTenantExists = filasCadastradas.length > 0

  const userId = usuario?.userId || +localStorage.getItem('userId')

  // Verificar se é admin e se está solicitando para mostrar todos
  if (isAdminShowAll) {
    return true
  }

  // se ticket for um grupo, todos podem verificar.
  if (ticket.isGroup) {
    return true
  }

  // se status do ticket diferente do staatus filtrado, retornar false
  if (filtros.status.length > 0 && !filtros.status.includes(ticket.status)) {
    return false
  }

  // verificar se já é um ticket do usuário
  if (ticket?.userId == userId) {
    return true
  }

  // Não visualizar tickets ainda com o Chatbot
  // desde que ainda não exista usuário ou fila definida
  if (NotViewTicketsChatBot() && ticket.autoReplyId) {
    if (!ticket?.userId && !ticket.queueId) {
      return false
    }
  }

  // Se o ticket não possuir fila definida, checar o filtro
  // permite visualizar tickets sem filas definidas é falso.
  // if (isQueuesTenantExists && !ticket.queueId && !filtros.includeNotQueueDefined) {
  //   return false
  // }

  let isValid = true

  // verificar se o usuário possui fila liberada
  if (isQueuesTenantExists) {
    // Se ticket não tem fila (queueId null) e está buscando não atribuídos, permitir
    if (!ticket.queueId && filtros.isNotAssignedUser) {
      isValid = true
    } else if (ticket.queueId) {
      const isQueueUser = UserQueues.findIndex(q => ticket.queueId === q.id)
      if (isQueueUser !== -1) {
        isValid = true
      } else {
        return false
      }
    } else {
      return false
    }
  }

  // verificar se a fila do ticket está filtrada
  if (isQueuesTenantExists && filtros?.queuesIds.length) {
    const isQueue = filtros.queuesIds.findIndex(q => ticket.queueId === q)
    if (isQueue == -1) {
      return false
    }
  }

  // se configuração para carteira ativa: verificar se já é um ticket da carteira do usuário
  if (DirectTicketsToWallets() && (ticket?.contact?.wallets?.length || 0) > 0) {
    const idx = ticket?.contact?.wallets.findIndex(w => w.id == userId)
    if (idx !== -1) {
      return true
    }
    return false
  }

  // verificar se o parametro para não permitir visualizar
  // tickets atribuidos à outros usuários está ativo
  if (isNotViewAssignedTickets() && (ticket?.userId || userId) !== userId) {
    // se usuário não estiver atribuido, permitir visualizar
    if (!ticket?.userId) {
      return true
    }
    return false
  }

  // verificar se filtro somente tickets não assinados (isNotAssingned) ativo
  if (filtros.isNotAssignedUser) {
    return filtros.isNotAssignedUser && !ticket.userId
  }

  return isValid
}

const atendimentoTicket = {
  state: {
    chatTicketDisponivel: false,
    tickets: [],
    ticketsLocalizadosBusca: [],
    ticketFocado: {
      contacts: {
        tags: [],
        wallets: [],
        extraInfo: []
      }
    },
    hasMore: false,
    contatos: [],
    mensagens: [],
    processingMessages: new Set(),
    messagesByTicket: {}
  },
  mutations: {
    // OK
    SET_HAS_MORE (state, payload) {
      state.hasMore = payload
    },
    // OK
    LOAD_TICKETS (state, payload) {
      // console.log('[DEBUG] LOAD_TICKETS mutation chamada:', {
      //  ticketsCount: payload.length,
      //  payload: payload
      // })
      const tickets = payload
      if (payload.length) {
        tickets.forEach(ticket => {
          const ticketIndex = state.tickets.findIndex(t => t.id === ticket.id)
          if (ticketIndex !== -1) {
            if (checkTicketFilter(ticket)) {
              // console.log('[DEBUG] Atualizando ticket existente:', ticket.id)
              state.tickets[ticketIndex] = ticket
              if (ticket.unreadMessages > 0) {
                state.tickets[ticketIndex].unreadMessages = ticket.unreadMessages
              }
            } else {
              // console.log('[DEBUG] Removendo ticket que não passou no filtro:', ticket.id)
              state.tickets.splice(ticketIndex, 1)
            }
          } else {
            if (checkTicketFilter(ticket)) {
              // console.log('[DEBUG] Adicionando novo ticket:', ticket.id)
              state.tickets.push(ticket)
            } else {
              // console.log('[DEBUG] Ticket não passou no filtro, não adicionado:', ticket.id)
            }
          }
        })
      }
      // Note: hasMore is handled separately via SET_HAS_MORE mutation
      // state.hasMore will be set by the separate SET_HAS_MORE commit in Index.vue
    },
    RESET_TICKETS (state) {
      state.hasMore = true
      state.tickets = []
    },
    RESET_UNREAD (state, payload) {
      const tickets = [...state.tickets]
      const ticketId = payload.ticketId
      const ticketIndex = tickets.findIndex(t => t.id === ticketId)
      if (ticketIndex !== -1) {
        tickets[ticketIndex] = payload
        // Manter o valor de unreadMessages do payload ao invés de zerar
        tickets[ticketIndex].unreadMessages = payload.unreadMessages || 0
      }
      state.tickets = tickets
    },
    ADD_MESSAGE_PROCESSING (state, messageId) {
      state.processingMessages.add(messageId)
    },
    REMOVE_MESSAGE_PROCESSING (state, messageId) {
      state.processingMessages.delete(messageId)
    },
    // OK
    UPDATE_TICKET (state, payload) {
      // console.log('[DEBUG] UPDATE_TICKET mutation chamada:', payload.id)
      const ticketIndex = state.tickets.findIndex(t => t.id === payload.id)
      if (ticketIndex !== -1) {
        // atualizar ticket se encontrado
        const tickets = [...state.tickets]
        tickets[ticketIndex] = {
          ...tickets[ticketIndex],
          ...payload,
          // ajustar informações por conta das mudanças no front
          username: payload?.user?.name || payload?.username || tickets[ticketIndex].username,
          profilePicUrl: payload?.contact?.profilePicUrl || payload?.profilePicUrl || tickets[ticketIndex].profilePicUrl,
          name: payload?.contact?.name || payload?.name || tickets[ticketIndex].name
        }
        if (checkTicketFilter(tickets[ticketIndex])) {
          // console.log('[DEBUG] Atualizando ticket existente no UPDATE_TICKET:', payload.id)
          state.tickets = tickets
        } else {
          // console.log('[DEBUG] Removendo ticket no UPDATE_TICKET (não passou no filtro):', payload.id)
          tickets.splice(ticketIndex, 1)
          state.tickets = tickets
        }

        // atualizar se ticket focado
        if (state.ticketFocado.id == payload.id) {
          state.ticketFocado = {
            ...state.ticketFocado,
            ...payload
            // conservar as informações do contato
            // contact: state.ticketFocado.contact
          }
        }
      } else {
        if (checkTicketFilter(payload)) {
          // console.log('[DEBUG] Adicionando novo ticket no UPDATE_TICKET:', payload.id)
          const tickets = [...state.tickets]
          tickets.unshift({
            ...payload,
            // ajustar informações por conta das mudanças no front
            username: payload?.user?.name || payload?.username,
            profilePicUrl: payload?.contact?.profilePicUrl || payload?.profilePicUrl,
            name: payload?.contact?.name || payload?.name
          })
          state.tickets = tickets
        } else {
          // console.log('[DEBUG] Ticket não adicionado no UPDATE_TICKET (não passou no filtro):', payload.id)
        }
      }
    },

    DELETE_TICKET (state, payload) {
      const ticketId = payload
      const ticketIndex = state.tickets.findIndex(t => t.id === ticketId)
      if (ticketIndex !== -1) {
        state.tickets.splice(ticketIndex, 1)
      }
      // return state.tickets
    },

    // UPDATE_TICKET_MESSAGES_COUNT (state, payload) {

    //   const { ticket, searchParam } = payload
    //   const ticketIndex = state.tickets.findIndex(t => t.id === ticket.id)
    //   if (ticketIndex !== -1) {
    //     state.tickets[ticketIndex] = ticket
    //     state.tickets.unshift(state.tickets.splice(ticketIndex, 1)[0])
    //   } else if (!searchParam) {
    //     state.tickets.unshift(ticket)
    //   }
    //   // return state.tickets
    // },

    UPDATE_TICKET_FOCADO_CONTACT (state, payload) {
      state.ticketFocado.contact = payload
    },
    UPDATE_CONTACT (state, payload) {
      if (state.ticketFocado.contactId == payload.id) {
        state.ticketFocado.contact = payload
      }
      const ticketIndex = state.tickets.findIndex(t => t.contactId === payload.id)
      if (ticketIndex !== -1) {
        const tickets = [...state.tickets]
        tickets[ticketIndex].contact = payload
        tickets[ticketIndex].name = payload.name
        tickets[ticketIndex].profilePicUrl = payload.profilePicUrl
        state.tickets = tickets
      }
    },
    // OK
    TICKET_FOCADO (state, payload) {
      // Manter o status original do ticket sem forçar mudança de 'pending' para 'open'
      // Isso permite que o botão "Iniciar o atendimento" apareça corretamente
      state.ticketFocado = payload
      // return state.ticketFocado
    },
    // OK
    LOAD_INITIAL_MESSAGES (state, payload) {
      const { messages, messagesOffLine } = payload
      state.mensagens = []
      const newMessages = orderMessages([...messages, ...messagesOffLine])
      state.mensagens = newMessages
    },
    // OK
    LOAD_MORE_MESSAGES (state, payload) {
      const { messages, messagesOffLine } = payload
      const arrayMessages = [...messages, ...messagesOffLine]
      const newMessages = []
      arrayMessages.forEach((message, index) => {
        const messageIndex = state.mensagens.findIndex(m => m.id === message.id)
        if (messageIndex !== -1) {
          state.mensagens[messageIndex] = message
          arrayMessages.splice(index, 1)
        } else {
          newMessages.push(message)
        }
      })
      const messagesOrdered = orderMessages(newMessages)
      state.mensagens = [...messagesOrdered, ...state.mensagens]
    },
    // OK
    UPDATE_MESSAGES (state, payload) {
      // console.log('[DEBUG] UPDATE_MESSAGES mutation called with payload:', payload)
      // console.log('[DEBUG] Current ticketFocado:', state.ticketFocado)

      // Criar um cache de mensagens por ticket se não existir
      if (!state.messagesByTicket) {
        state.messagesByTicket = {}
      }

      const ticketId = payload.ticket.id

      // Inicializar array de mensagens para o ticket se não existir
      if (!state.messagesByTicket[ticketId]) {
        state.messagesByTicket[ticketId] = []
      }

      // Atualizar mensagens no cache do ticket
      const messageIndex = state.messagesByTicket[ticketId].findIndex(m => m.id === payload.id)
      if (messageIndex !== -1) {
        // console.log('[DEBUG] Atualizando mensagem existente no cache do ticket:', ticketId)
        state.messagesByTicket[ticketId][messageIndex] = payload
      } else {
        // console.log('[DEBUG] Adicionando nova mensagem ao cache do ticket:', ticketId)
        state.messagesByTicket[ticketId].push(payload)
      }

      // Se o ticket estiver focado, atualizar também o array de mensagens visível
      if (state.ticketFocado.id === ticketId) {
        // console.log('[DEBUG] Atualizando mensagens do ticket focado')
        state.mensagens = [...state.messagesByTicket[ticketId]]

        if (payload.scheduleDate && payload.status == 'pending') {
          const idxScheduledMessages = state.ticketFocado.scheduledMessages.findIndex(m => m.id === payload.id)
          if (idxScheduledMessages === -1) {
            state.ticketFocado.scheduledMessages.push(payload)
          }
        }
      }

      // Atualizar informações do ticket na lista
      const TicketIndexUpdate = state.tickets.findIndex(t => t.id == ticketId)
      if (TicketIndexUpdate !== -1) {
        // console.log('[DEBUG] Atualizando ticket na lista')
        const tickets = [...state.tickets]
        const unreadMessages = payload.ticket.unreadMessages
        tickets[TicketIndexUpdate] = {
          ...state.tickets[TicketIndexUpdate],
          answered: payload.ticket.answered,
          unreadMessages,
          lastMessage: payload.mediaName || payload.body
        }
        state.tickets = tickets
        // console.log('[DEBUG] Ticket atualizado na lista:', tickets[TicketIndexUpdate])
      }
    },
    // OK
    UPDATE_MESSAGE_STATUS (state, payload) {
      // Se ticket não for o focado, não atualizar.
      if (state.ticketFocado.id != payload.ticket.id) {
        return
      }
      const messageIndex = state.mensagens.findIndex(m => m.id === payload.id)
      const mensagens = [...state.mensagens]
      if (messageIndex !== -1) {
        // Preservar o campo fromMe ao atualizar a mensagem
        mensagens[messageIndex] = {
          ...mensagens[messageIndex],
          ...payload,
          fromMe: payload.fromMe !== undefined ? payload.fromMe : mensagens[messageIndex].fromMe
        }
        state.mensagens = mensagens
      }

      // Se existir mensagens agendadas no ticket focado,
      // tratar a atualização das mensagens deletadas.
      if (state.ticketFocado?.scheduledMessages) {
        const scheduledMessages = [...state.ticketFocado.scheduledMessages]
        const scheduled = scheduledMessages.filter(m => m.id != payload.id)
        state.ticketFocado.scheduledMessages = scheduled
      }
    },
    // OK
    RESET_MESSAGE (state) {
      state.mensagens = []
      // return state.mensagens
    },
    UPDATE_TICKET_UNREAD_MESSAGES (state, payload) {
      const ticketIndex = state.tickets.findIndex(t => t.id === payload.ticket.id)
      if (ticketIndex !== -1) {
        const tickets = [...state.tickets]
        tickets[ticketIndex] = {
          ...tickets[ticketIndex],
          unreadMessages: payload.ticket.unreadMessages
        }
        state.tickets = tickets
      }
    },
    ADD_PROCESSING_MESSAGE (state, messageId) {
      state.processingMessages.add(messageId)
    },
    REMOVE_PROCESSING_MESSAGE (state, messageId) {
      state.processingMessages.delete(messageId)
    }
  },
  actions: {
    async LocalizarMensagensTicket ({ commit, dispatch }, params) {
      const mensagens = await LocalizarMensagens(params)
      // commit('TICKET_FOCADO', mensagens.data.ticket)
      commit('SET_HAS_MORE', mensagens.data.hasMore)
      // commit('UPDATE_TICKET_CONTACT', mensagens.data.ticket.contact)
      if (params.pageNumber === 1) {
        commit('LOAD_INITIAL_MESSAGES', mensagens.data)
      } else {
        commit('LOAD_MORE_MESSAGES', mensagens.data)
      }
    },
    async AbrirChatMensagens ({ commit, dispatch }, data) {
      try {
        await commit('TICKET_FOCADO', {})
        await commit('RESET_MESSAGE')
        const ticket = await ConsultarDadosTicket(data)
        await commit('TICKET_FOCADO', ticket.data)
        // commit('SET_HAS_MORE', true)
        const params = {
          ticketId: data.id,
          pageNumber: 1
        }
        await dispatch('LocalizarMensagensTicket', params)

        await $router.push({ name: 'chat', params, query: { t: new Date().getTime() } })
      } catch (error) {
        // posteriormente é necessário investigar o motivo de está caindo em erro
        if (!error) return
        const errorMsg = error?.response?.data?.error
        if (errorMsg) {
          Notify.create({
            type: 'negative',
            message: error.response.data.error,
            progress: true,
            position: 'top'
          })
        } else {
          Notify.create({
            type: 'negative',
            message: `Ops... Ocorreu um problema não identificado. ${JSON.stringify(error)}`,
            progress: true,
            position: 'top'
          })
        }
      }
    },
    addProcessingMessage ({ commit }, messageId) {
      commit('ADD_PROCESSING_MESSAGE', messageId)
    },
    removeProcessingMessage ({ commit }, messageId) {
      commit('REMOVE_PROCESSING_MESSAGE', messageId)
    }
  },
  getters: {
    getTickets: state => status => {
      return state.tickets.filter(t => t.status === status)
    },
    messagesByTicket: state => state.messagesByTicket || {},
    isMessageProcessing: state => messageId => state.processingMessages.has(messageId)
  }
}

export default atendimentoTicket
