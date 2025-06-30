const usuario = JSON.parse(localStorage.getItem('usuario'))
import Router from 'src/router/index'
import { socketIO } from 'src/utils/socket'
import { ConsultarTickets } from 'src/service/tickets'
import { tocarSomNotificacao } from 'src/helpers/helpersNotifications'

const socket = socketIO()

const userId = +localStorage.getItem('userId')

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
  methods: {
    socketInitial () {
      socket.emit(`${usuario.tenantId}:joinNotification`)

      socket.io.on(`${usuario.tenantId}:whatsapp`, data => {
        if (data.action === 'update') {
          this.$store.commit('UPDATE_WHATSAPPS', data.whatsapp)
        }
      })

      socket.on(`${usuario.tenantId}:ticketList`, async data => {
        if (data.type === 'chat:create') {
          if (data.payload.fromMe) return
          if (data.payload.ticket.userId !== userId) return
          // eslint-disable-next-line no-unused-vars
          const message = new self.Notification('Contato: ' + data.payload.ticket.contact.name, {
            body: 'Mensagem: ' + data.payload.body,
            tag: 'simple-push-demo-notification',
            image: data.payload.ticket.contact.profilePicUrl,
            icon: data.payload.ticket.contact.profilePicUrl
          })

          // Tocar som de notificação usando o serviço centralizado
          tocarSomNotificacao()

          // Atualiza notificações de mensagem - busca todos os tickets em andamento
          try {
            // Buscar todos os tickets em andamento
            const paramsAll = {
              searchParam: '',
              pageNumber: 1,
              status: ['open'],
              showAll: false,
              count: null,
              queuesIds: [],
              withUnreadMessages: false,
              isNotAssignedUser: false,
              includeNotQueueDefined: true
            }

            const { data: dataAll } = await ConsultarTickets(paramsAll)

            // Buscar tickets com mensagens não lidas
            const paramsUnread = {
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

            const { data: dataUnread } = await ConsultarTickets(paramsUnread)

            // Combinar dados
            const badgeData = {
              tickets: dataAll.tickets || [],
              ticketsUnread: dataUnread.tickets || [],
              count: dataAll.count || 0
            }

            this.countTickets = badgeData.count
            this.$store.commit('UPDATE_NOTIFICATIONS', badgeData)
          } catch (err) {
            this.$notificarErro('Algum problema', err)
          }
        }
      })

      socket.on(`${usuario.tenantId}:whatsapp`, data => {
        if (data.action === 'delete') {
          this.$store.commit('DELETE_WHATSAPPS', data.whatsappId)
        }
      })

      socket.on(`${usuario.tenantId}:whatsappSession`, data => {
        console.log('🔍 Socket received whatsappSession:', data)
        console.log('📱 Session data:', data.session)
        console.log('🔑 QR Code in session:', data.session.qrcode ? 'QR CODE PRESENT' : 'NO QR CODE')
        console.log('📊 Session status:', data.session.status)
        console.log('🆔 Session ID:', data.session.id)

        if (data.action === 'update') {
          console.log('📱 Updating session in store:', data.session)
          this.$store.commit('UPDATE_SESSION', data.session)

          // Force Vue to re-render by emitting the event
          console.log('📡 Emitting UPDATE_SESSION event via $root')
          this.$root.$emit('UPDATE_SESSION', data.session)

          // Additional debug: check store state after update
          setTimeout(() => {
            const storeSession = this.$store.state.whatsapp.whatsApps.find(w => w.id === data.session.id)
            console.log('🔍 Store session after update:', storeSession)
            console.log('🔑 QR Code in store after update:', storeSession ? storeSession.qrcode : 'NOT FOUND')
          }, 100)
        }

        if (data.action === 'readySession') {
          console.log('✅ Ready session received:', data.session)
          this.$root.$emit('READY_SESSION', data.session)
          this.$q.notify({
            position: 'bottom-right',
            icon: 'mdi-wifi-arrow-up-down',
            message: `A conexão com o WhatsApp está pronta e o mesmo está habilitado para enviar e receber mensagens. Conexão: ${data.session.name}. Número: ${data.session.number}.`,
            type: 'positive',
            color: 'primary',
            html: true,
            progress: true,
            timeout: 7000,
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }],
            classes: 'text-body2 text-weight-medium'
          })
        }
      })

      socket.on(`${usuario.tenantId}:change_battery`, data => {
        this.$q.notify({
          message: `Bateria do celular do whatsapp ${data.batteryInfo.sessionName} está com bateria em ${data.batteryInfo.battery}%. Necessário iniciar carregamento.`,
          type: 'negative',
          progress: true,
          position: 'bottom-right',
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
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
            // Erro no socket
          }
          // Faz verificação para se certificar que notificação pertence a fila do usuário
          var pass_noti = false
          verify.data.tickets.forEach((element) => { pass_noti = (element.id == data.payload.id ? true : pass_noti) })
          // Notificação removida conforme solicitado
          /*
          // Exibe Notificação
          if (pass_noti) {
            // eslint-disable-next-line no-unused-vars
            const message = new self.Notification('Novo cliente pendente', {
              body: 'Cliente: ' + data.payload.contact.name,
              tag: 'simple-push-demo-notification'
            })
          }
          */
        }
      })
    }
  },
  mounted () {
    this.socketInitial()
  },
  destroyed () {
    socket && socket.disconnect()
  }
}
