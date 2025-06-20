import { orderBy } from 'lodash'
import { parseISO } from 'date-fns'

const orderTickets = (tickets) => {
  if (!tickets || !Array.isArray(tickets)) return []
  const newOrder = orderBy(tickets, (obj) => parseISO(obj.updatedAt), ['desc'])
  return newOrder
}

const getters = {
  // ticketFocado: state => state.ticketFocado,
  // tickets: state => state.tickets,
  // hasMore: state => state.hasMore,
  // mensagenRapidas: state => state.mensagenRapidas,
  notifications: state => state.notifications.notifications,
  notifications_p: state => state.notifications.notifications_p,
  errorNotifications: state => state.notifications.errorNotifications,
  tickets: state => orderTickets(state.atendimentoTicket.tickets),
  // mensagensTicket: state => state.atendimentoTicket.mensagens, // Removido para evitar duplicidade
  ticketFocado: state => state.atendimentoTicket.ticketFocado,
  hasMore: state => state.atendimentoTicket.hasMore,
  whatsapps: state => state.whatsapp.whatsApps,
  isSuporte: state => state.user.isSuporte,
  isAdmin: state => state.user.isAdmin
  // socket: state => state.socket,
  // ackIcons: state => state.ackIcons,
  // usuario: state => state.usuario,
  // chatFocado: state => state.chatFocado,
  // chats: state => state.chats,
  // contatos: state => state.contatos
}
export default getters
