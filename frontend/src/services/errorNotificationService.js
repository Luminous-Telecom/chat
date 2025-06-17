import { ConsultarTickets } from 'src/service/tickets'

class ErrorNotificationService {
  constructor () {
    this.checkInterval = null
    this.isRunning = false
  }

  // Iniciar monitoramento de erros
  startMonitoring () {
    if (this.isRunning) return

    this.isRunning = true
    this.checkInterval = setInterval(() => {
      this.checkScheduledMessagesErrors()
    }, 5 * 60 * 1000) // Verificar a cada 5 minutos
  }

  // Parar monitoramento
  stopMonitoring () {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isRunning = false
  }

  // Verificar mensagens agendadas com problemas
  async checkScheduledMessagesErrors () {
    try {
      // Buscar mensagens agendadas que estão atrasadas
      const params = {
        searchParam: '',
        pageNumber: 1,
        status: ['pending'],
        showAll: true,
        count: null,
        queuesIds: [],
        withUnreadMessages: false,
        isNotAssignedUser: false,
        includeNotQueueDefined: true
      }

      const { data } = await ConsultarTickets(params)

      if (data.tickets && data.tickets.length > 0) {
        const now = new Date()

        data.tickets.forEach(ticket => {
          if (ticket.scheduledMessages && ticket.scheduledMessages.length > 0) {
            ticket.scheduledMessages.forEach(message => {
              if (message.scheduleDate && message.status === 'pending') {
                const scheduledDate = new Date(message.scheduleDate)

                // Se a mensagem está atrasada (mais de 5 minutos)
                if (scheduledDate < now && (now - scheduledDate) > 5 * 60 * 1000) {
                  this.notifyScheduledMessageError(message, ticket)
                }
              }
            })
          }
        })
      }
    } catch (error) {
      console.error('Erro ao verificar mensagens agendadas:', error)
    }
  }

  // Notificar sobre mensagem agendada com problema
  notifyScheduledMessageError (message, ticket) {
    const errorNotification = {
      id: `scheduled-${message.id}-${Date.now()}`,
      tipo: 'mensagem_agendada',
      title: 'Mensagem Agendada Atrasada',
      message: `Mensagem agendada para ${ticket.contact?.name || 'Contato'} está atrasada`,
      details: {
        messageId: message.id,
        ticketId: ticket.id,
        scheduledDate: message.scheduleDate,
        messageBody: message.body?.substring(0, 50) + '...',
        contactName: ticket.contact?.name
      },
      timestamp: new Date().toLocaleString('pt-BR'),
      resolved: false
    }

    // Emitir evento para o store
    if (window.Vue && window.Vue.prototype.$store) {
      window.Vue.prototype.$store.commit('ADD_ERROR_NOTIFICATION', errorNotification)
    }

    // Mostrar notificação visual
    if (window.Vue && window.Vue.prototype.$q) {
      window.Vue.prototype.$q.notify({
        type: 'negative',
        message: 'Mensagem Agendada Atrasada',
        caption: `Mensagem para ${ticket.contact?.name || 'Contato'} está atrasada`,
        position: 'top',
        timeout: 8000,
        actions: [
          { label: 'Ver Detalhes', color: 'white' },
          { label: 'OK', color: 'white' }
        ]
      })
    }
  }

  // Verificar erros de conexão do WhatsApp
  checkWhatsAppConnectionErrors (whatsapps) {
    const errors = []

    whatsapps.forEach(whatsapp => {
      if (['DISCONNECTED', 'TIMEOUT', 'PAIRING'].includes(whatsapp.status)) {
        errors.push({
          id: `whatsapp-${whatsapp.id}-${whatsapp.status}`,
          tipo: 'conexao_whatsapp',
          title: this.getConnectionErrorTitle(whatsapp.status),
          message: this.getConnectionErrorMessage(whatsapp.status, whatsapp.name),
          details: {
            whatsappId: whatsapp.id,
            whatsappName: whatsapp.name,
            status: whatsapp.status
          },
          timestamp: new Date().toLocaleString('pt-BR'),
          resolved: false
        })
      }
    })

    return errors
  }

  getConnectionErrorTitle (status) {
    switch (status) {
      case 'DISCONNECTED':
        return 'WhatsApp Desconectado'
      case 'TIMEOUT':
        return 'Timeout de Conexão'
      case 'PAIRING':
        return 'Problema de Emparelhamento'
      default:
        return 'Erro de Conexão'
    }
  }

  getConnectionErrorMessage (status, whatsappName) {
    switch (status) {
      case 'DISCONNECTED':
        return `WhatsApp ${whatsappName} está desconectado`
      case 'TIMEOUT':
        return `WhatsApp ${whatsappName} apresentou timeout`
      case 'PAIRING':
        return `WhatsApp ${whatsappName} com problema de emparelhamento`
      default:
        return `WhatsApp ${whatsappName} com erro de conexão`
    }
  }
}

// Criar instância singleton
const errorNotificationService = new ErrorNotificationService()

export default errorNotificationService
