import { AtualizarStatusTicket } from 'src/service/tickets'
const userId = +localStorage.getItem('userId')

export default {
  methods: {
    iniciarAtendimento (ticket) {
      this.loading = true
      AtualizarStatusTicket(ticket.id, 'open', userId)
        .then(res => {
          this.loading = false
          // Notificação removida conforme solicitado
          /*
          this.$q.notify({
            message: `Atendimento Iniciado || ${ticket.name} - Ticket: ${ticket.id}`,
            type: 'positive',
            progress: true,
            position: 'bottom-right',
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
          */

          // Atualizar o ticket com o novo status antes de abrir o chat
          const ticketAtualizado = {
            ...ticket,
            status: 'open',
            userId: userId
          }

          // Atualizar o ticket na lista primeiro
          this.$store.commit('UPDATE_TICKET', {
            ...ticketAtualizado,
            user: {
              id: userId,
              name: JSON.parse(localStorage.getItem('usuario'))?.name || localStorage.getItem('username') || 'Usuário'
            }
          })

          this.$store.commit('TICKET_FOCADO', {})
          this.$store.commit('SET_HAS_MORE', true)

          // Mudar para "meus atendimentos" após atender o ticket
          this.$eventBus.emit('trocar-para-meus-atendimentos')

          // Reduzir delay para melhorar responsividade
          setTimeout(() => {
            this.$store.dispatch('AbrirChatMensagens', ticketAtualizado)

            // Forçar atualização da interface
            this.$nextTick(() => {
              this.$forceUpdate()
            })
          }, 300) // Reduzido de 800ms para 300ms
        })
        .catch(err => {
          this.loading = false
          console.error('Erro ao iniciar atendimento:', err)
          this.$notificarErro('Erro ao iniciar atendimento', err)
        })
    },
    atualizarStatusTicket (status) {
      const contatoName = this.ticketFocado.contact.name || ''
      const ticketId = this.ticketFocado.id
      const title = {
        open: 'Atenidmento será iniciado, ok?',
        pending: 'Retornar à fila?',
        closed: 'Encerrar o atendimento?'
      }

      this.$q.dialog({
        title: title[status],
        message: `Cliente: ${contatoName} || Ticket: ${ticketId}`,
        cancel: {
          label: 'Não',
          color: 'negative',
          push: true
        },
        ok: {
          label: 'Sim',
          color: 'primary',
          push: true
        },
        persistent: true
      }).onOk(() => {
        this.loading = true
        AtualizarStatusTicket(ticketId, status, userId)
          .then(res => {
            this.loading = false
            // Notificação removida conforme solicitado
            /*
            const toast = {
              open: 'Atenidmento iniciado!',
              pending: 'Retornado à fila!',
              closed: 'Atendimento encerrado!'
            }
            this.$q.notify({
              message: `${toast[status]} || ${contatoName} (Ticket ${ticketId})`,
              type: 'positive',
              progress: true,
              actions: [{
                icon: 'close',
                round: true,
                color: 'white'
              }]
            })
            */
            this.$store.commit('TICKET_FOCADO', {})
            if (status !== 'open') {
              this.$router.push({ name: 'chat-empty' })
              if (typeof this.BuscarTicketFiltro === 'function') {
                this.BuscarTicketFiltro()
              } else if (this.$parent && typeof this.$parent.BuscarTicketFiltro === 'function') {
                this.$parent.BuscarTicketFiltro()
              }
            }
          })
          .catch(error => {
            this.loading = false
            console.error(error)
            this.$notificarErro('Não foi possível atuaizar o status', error)
          })
      })
    }
  }
}
