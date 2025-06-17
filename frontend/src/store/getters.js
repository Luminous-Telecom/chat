import { orderBy } from 'lodash'
import { parseISO } from 'date-fns'

const orderTickets = (tickets) => {
  if (!tickets || !Array.isArray(tickets)) return []
  const newOrder = orderBy(tickets, (obj) => parseISO(obj.updatedAt), ['desc'])
  return newOrder
}

const getters = {
  notifications: state => state.notifications.notifications,
  notifications_p: state => state.notifications.notifications_p,
  errorNotifications: state => state.notifications.errorNotifications,
  errorNotificationsCount: state => state.notifications.errorNotificationsCount,
  hasErrorNotifications: state => state.notifications.hasErrorNotifications,
  tickets: state => orderTickets(state.atendimentoTicket.tickets),
  mensagensTicket: state => state.atendimentoTicket.mensagens,
  ticketFocado: state => state.atendimentoTicket.ticketFocado,
  hasMore: state => state.atendimentoTicket.hasMore,
  whatsapps: state => state.whatsapp.whatsApps,
  isSuporte: state => state.user.isSuporte,
  isAdmin: state => state.user.isAdmin
}
export default getters
