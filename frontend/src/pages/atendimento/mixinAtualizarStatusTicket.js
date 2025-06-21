import { AtualizarStatusTicket } from 'src/service/tickets'
const userId = +localStorage.getItem('userId')

export default {
  methods: {
    iniciarAtendimento (ticket) {
      this.loading = true
      AtualizarStatusTicket(ticket.id, 'open', userId)
        .then(res => {
          this.loading = false
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

          // Atualizar o ticket com o novo status antes de abrir o chat
          const ticketAtualizado = {
            ...ticket,
            status: 'open',
            userId: userId
          }

          console.log('[iniciarAtendimento] Atualizando ticket na lista:', ticketAtualizado)

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

          console.log('[iniciarAtendimento] Abrindo chat após delay...')

          // Pequeno delay para garantir que o backend processou a atualização
          setTimeout(() => {
            this.$store.dispatch('AbrirChatMensagens', ticketAtualizado)

            // Forçar atualização da interface
            this.$nextTick(() => {
              this.$forceUpdate()
              console.log('[iniciarAtendimento] Interface atualizada forçadamente')
            })
          }, 500)

          // Removido: não forçar mudança automática de filtros
          // this.$root.$emit('trocar-para-meus-atendimentos')
          // if (this.$parent && this.$parent.pesquisaTickets && this.$parent.setFilterMode) {
          //   this.$parent.pesquisaTickets.status = ['open']
          //   this.$parent.setFilterMode('meus')
          // }
        })
        .catch(error => {
          this.loading = false
          console.error(error)
          this.$notificarErro('Não foi possível atualizar o status', error)
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
      const toast = {
        open: 'Atenidmento iniciado!',
        pending: 'Retornado à fila!',
        closed: 'Atendimento encerrado!'
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
            this.$store.commit('TICKET_FOCADO', {})
            if (status !== 'open') this.$router.push({ name: 'chat-empty' })
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
