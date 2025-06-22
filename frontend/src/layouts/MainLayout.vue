<template>
  <q-layout view="hHh Lpr lFf">
    <q-btn
      flat
      dense
      round
      icon="menu"
      aria-label="Menu"
      @click="leftDrawerOpen = !leftDrawerOpen"
      class="q-ml-sm"
      v-show="!leftDrawerOpen"
    />
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      :mini="miniState"

      mini-to-overlay
      :width="220"
      :breakpoint="400"
      class="bg-sidebar-custom"
    >
      <q-scroll-area class="fit modern-scrollbar">
        <q-list padding :key="userProfile">
          <q-item clickable v-ripple class="houverList" @click="miniState = !miniState">
            <q-tooltip v-if="miniState" anchor="center right" self="center left" :offset="[10, 0]">
              Menu
            </q-tooltip>
            <q-item-section avatar>
              <q-icon name="menu" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Menu</q-item-label>
            </q-item-section>
          </q-item>
          <q-item clickable v-ripple class="houverList">
            <q-tooltip v-if="miniState" anchor="center right" self="center left" :offset="[10, 0]">
              Alertas
            </q-tooltip>
            <q-item-section avatar>
              <q-icon name="notifications_none" />
              <q-badge
                color="red"
                text-color="white"
                floating
                v-if="hasErrorNotifications"
              >
                {{ errorNotificationsCount }}
              </q-badge>
            </q-item-section>
            <q-item-section>
              <q-item-label>Alertas</q-item-label>
            </q-item-section>
            <q-menu anchor="top right" self="top left">
              <q-list style="min-width: 300px">
                <q-item v-if="!hasErrorNotifications">
                  <q-item-section style="cursor: pointer;">
                    Nenhum alerta ativo!
                  </q-item-section>
                </q-item>
                <q-item
                  v-for="errorNotification in errorNotifications"
                  :key="errorNotification.id"
                  style="border-bottom: 1px solid #ddd; margin: 5px;"
                >
                  <q-item-section
                    avatar
                    @click="abrirDetalhesErro(errorNotification)"
                    style="cursor: pointer;"
                  >
                    <q-avatar
                      style="width: 60px; height: 60px"
                      color="red"
                      text-color="white"
                    >
                      <q-icon name="warning" size="2rem" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section
                    @click="abrirDetalhesErro(errorNotification)"
                    style="cursor: pointer;"
                  >
                    <q-list>
                      <q-item style="text-align:center; font-size: 17px; font-weight: bold; min-height: 0; color: red;">
                        {{ errorNotification.title }}
                      </q-item>
                      <q-item style="min-height: 0; padding-top: 0">
                        <b>Erro: </b> {{ errorNotification.message }}
                      </q-item>
                      <q-item style="min-height: 0; padding-top: 0; font-size: 12px; color: grey;">
                        {{ errorNotification.timestamp }}
                      </q-item>
                    </q-list>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-item>
          <EssentialLink
            v-for="item in cMenuData"
            :key="item.title"
            v-bind="item"
            :miniState="miniState"
          />
          <div v-if="userProfile === 'admin'">
            <q-separator spaced />
            <div class="q-mb-lg"></div>
            <template v-for="item in menuDataAdmin">
              <EssentialLink
                v-if="exibirMenuBeta(item)"
                :key="item.title"
                v-bind="item"
                :miniState="miniState"
              />
            </template>
            <q-separator spaced />
          </div>
          <div class="q-mt-lg">
            <q-item clickable v-ripple class="houverList">
              <q-tooltip v-if="miniState" anchor="center right" self="center left" :offset="[10, 0]">
                Usuário
              </q-tooltip>
              <q-item-section avatar>
                <q-icon name="account_circle" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Usuário</q-item-label>
              </q-item-section>
              <q-menu anchor="top right" self="top left">
                <q-list style="min-width: 100px">
                  <q-item-label header> Olá! <b> {{ username }} </b> </q-item-label>
                  <q-item
                    clickable
                    v-close-popup
                    @click="abrirModalUsuario"
                  >
                    <q-item-section>Perfil</q-item-section>
                  </q-item>
                  <q-item
                    clickable
                    v-close-popup
                    @click="efetuarLogout"
                  >
                    <q-item-section>Sair</q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item>
                    <q-item-section>
                      <cSystemVersion />
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-item>
            <q-item clickable v-ripple class="houverList" @click="$setConfigsUsuario({ isDark: !$q.dark.isActive })">
              <q-tooltip v-if="miniState" anchor="center right" self="center left" :offset="[10, 0]">
                {{ $q.dark.isActive ? 'Modo Claro' : 'Modo Escuro' }}
              </q-tooltip>
              <q-item-section avatar>
                <q-icon :name="$q.dark.isActive ? 'light_mode' : 'dark_mode'" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $q.dark.isActive ? 'Modo Claro' : 'Modo Escuro' }}</q-item-label>
              </q-item-section>
            </q-item>
          </div>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-page>
        <router-view />
      </q-page>
    </q-page-container>
    <ModalUsuario
      :isProfile="true"
      :modalUsuario.sync="modalUsuario"
      :usuarioEdicao.sync="usuario"
    />
  </q-layout>
</template>

<script>
import cSystemVersion from '../components/cSystemVersion.vue'
import { ListarWhatsapps } from 'src/service/sessoesWhatsapp'
import EssentialLink from 'components/EssentialLink.vue'
import socketInitial from './socketInitial'
import { format } from 'date-fns'
const username = localStorage.getItem('username')
import ModalUsuario from 'src/pages/usuarios/ModalUsuario'
import { mapGetters } from 'vuex'
import { ListarConfiguracoes } from 'src/service/configuracoes'
import { RealizarLogout } from 'src/service/login'
import { socketIO } from 'src/utils/socket'
import { ConsultarTickets } from 'src/service/tickets'
import { ContarTicketsPendentesPorFila } from 'src/service/filas'
import { tocarSomNotificacao, atualizarTituloGuia } from 'src/helpers/helpersNotifications'
import errorNotificationService from 'src/services/errorNotificationService'

const socket = socketIO()

const objMenu = [
  {
    title: 'Dashboard',
    caption: '',
    icon: 'dashboard',
    routeName: 'home-dashboard'
  },
  {
    title: 'Atendimentos na Fila',
    caption: 'Tickets em espera',
    icon: 'schedule',
    routeName: 'atendimento',
    query: { status: 'pending' }
  },
  {
    title: 'Atendimentos em Andamento',
    caption: 'Lista de atendimentos',
    icon: 'chat_bubble_outline',
    routeName: 'atendimento',
    query: { status: 'open' }
  },
  {
    title: 'Atendimentos Finalizados',
    caption: 'Histórico de atendimentos',
    icon: 'task_alt',
    routeName: 'atendimento',
    query: { status: 'closed' }
  },
  {
    title: 'Contatos',
    caption: 'Lista de contatos',
    icon: 'contacts',
    routeName: 'contatos'
  }
]

const objMenuAdmin = [
  {
    title: 'Canais',
    caption: 'Canais de Comunicação',
    icon: 'phone_iphone',
    routeName: 'sessoes'
  },
  {
    title: 'Painel Atendimentos',
    caption: 'Visão geral dos atendimentos',
    icon: 'grid_view',
    routeName: 'painel-atendimentos'
  },
  {
    title: 'Relatórios',
    caption: 'Relatórios gerais',
    icon: 'analytics',
    routeName: 'relatorios'
  },
  {
    title: 'Usuarios',
    caption: 'Admin de usuários',
    icon: 'people_outline',
    routeName: 'usuarios'
  },
  {
    title: 'Filas',
    caption: 'Cadastro de Filas',
    icon: 'format_list_bulleted',
    routeName: 'filas'
  },
  {
    title: 'Mensagens Rápidas',
    caption: 'Mensagens pré-definidas',
    icon: 'flash_on',
    routeName: 'mensagens-rapidas'
  },
  {
    title: 'Chatbot',
    caption: 'Robô de atendimento',
    icon: 'smart_toy',
    routeName: 'chat-flow'
  },
  {
    title: 'Etiquetas',
    caption: 'Cadastro de etiquetas',
    icon: 'local_offer',
    routeName: 'etiquetas'
  },
  {
    title: 'Horário de Atendimento',
    caption: 'Horário de funcionamento',
    icon: 'access_time',
    routeName: 'horarioAtendimento'
  },
  {
    title: 'Configurações',
    caption: 'Configurações gerais',
    icon: 'settings',
    routeName: 'configuracoes'
  },
  {
    title: 'Campanha',
    caption: 'Campanhas de envio',
    icon: 'send',
    routeName: 'campanhas'
  },
  {
    title: 'API',
    caption: 'Integração sistemas externos',
    icon: 'api',
    routeName: 'api-service'
  }
]

export default {
  name: 'MainLayout',
  mixins: [socketInitial],
  components: { EssentialLink, ModalUsuario, cSystemVersion },
  data () {
    return {
      username,
      domainExperimentalsMenus: ['@'],
      miniState: true,
      userProfile: 'user',
      modalUsuario: false,
      usuario: {},
      leftDrawerOpen: true, // Alterado de false para true
      menuData: [
        ...objMenu.filter(item => item.routeName === 'dashboard'),
        ...objMenu.filter(item => item.routeName !== 'dashboard')
      ],
      menuDataAdmin: objMenuAdmin,
      ticketsList: [],
      queueTicketCounts: {}
    }
  },
  computed: {
    ...mapGetters(['notifications', 'notifications_p', 'whatsapps', 'errorNotifications', 'errorNotificationsCount', 'hasErrorNotifications']),
    cProblemaConexao () {
      const idx = this.whatsapps.findIndex(w =>
        ['PAIRING', 'TIMEOUT', 'DISCONNECTED'].includes(w.status)
      )
      return idx !== -1
    },
    cQrCode () {
      const idx = this.whatsapps.findIndex(
        w => w.status === 'qrcode' || w.status === 'DESTROYED'
      )
      return idx !== -1
    },
    cOpening () {
      const idx = this.whatsapps.findIndex(w => w.status === 'OPENING')
      return idx !== -1
    },
    cUsersApp () {
      return this.$store.state.usersApp
    },
    // Adicionar computed para menuData com badge
    cMenuData () {
      return this.menuData.map(menu => {
        // Badge para atendimentos na fila (tickets pendentes)
        if (menu.routeName === 'atendimento' && menu.query?.status === 'pending') {
          let totalPending = 0
          const counts = Object.assign({}, this.queueTicketCounts || {})
          const values = Object.values(counts)
          totalPending = values.reduce((sum, count) => {
            return sum + (parseInt(count) || 0)
          }, 0)
          return { ...menu, badge: totalPending > 0 ? totalPending : 0 }
        }
        // Badge para atendimentos em andamento com mensagens não lidas
        if (menu.routeName === 'atendimento' && menu.query?.status === 'open') {
          // notifications.tickets = tickets em andamento
          let totalUnread = 0
          if (this.notifications && Array.isArray(this.notifications.tickets)) {
            totalUnread = this.notifications.tickets.reduce((sum, ticket) => {
              if (ticket.status === 'open' && ticket.unreadMessages > 0) {
                return sum + 1
              }
              return sum
            }, 0)
          }
          return { ...menu, badge: totalUnread > 0 ? totalUnread : 0 }
        }
        return menu
      })
    }
  },
  methods: {
    requestNotificationPermissionOnInteraction () {
      const requestPermission = () => {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission()
        }
        // Remove the event listener after first interaction
        document.removeEventListener('click', requestPermission)
        document.removeEventListener('keydown', requestPermission)
        document.removeEventListener('touchstart', requestPermission)
      }

      // Add event listeners for user interactions
      document.addEventListener('click', requestPermission, { once: true })
      document.addEventListener('keydown', requestPermission, { once: true })
      document.addEventListener('touchstart', requestPermission, { once: true })
    },
    exibirMenuBeta (itemMenu) {
      if (!itemMenu?.isBeta) return true
      for (const domain of this.domainExperimentalsMenus) {
        if (this.usuario.email.indexOf(domain) !== -1) return true
      }
      return false
    },
    async listarWhatsapps () {
      const { data } = await ListarWhatsapps()
      this.$store.commit('LOAD_WHATSAPPS', data)
    },
    handlerNotifications (data) {
      const { message, contact, ticket } = data

      const options = {
        body: `${message.body} - ${format(new Date(), 'HH:mm')}`,
        icon: contact.profilePicUrl,
        tag: ticket.id,
        renotify: true
      }

      const notification = new Notification(
        `Mensagem de ${contact.name}`,
        options
      )

      notification.onclick = e => {
        e.preventDefault()
        window.focus()
        this.$store.dispatch('AbrirChatMensagens', ticket)
        this.$router.push({ name: 'atendimento' })
      }

      // Tocar som de notificação usando o serviço centralizado
      tocarSomNotificacao()
    },
    async abrirModalUsuario () {
      this.modalUsuario = true
    },
    async efetuarLogout () {
      try {
        await RealizarLogout(this.usuario)
        localStorage.removeItem('token')
        localStorage.removeItem('username')
        localStorage.removeItem('profile')
        localStorage.removeItem('userId')
        localStorage.removeItem('queues')
        localStorage.removeItem('usuario')
        localStorage.removeItem('filtrosAtendimento')

        this.$router.push({ name: 'login', replace: true })
      } catch (error) {
        this.$notificarErro('Não foi possível realizar logout', error)
      }
    },
    async listarConfiguracoes () {
      const { data } = await ListarConfiguracoes()
      localStorage.setItem('configuracoes', JSON.stringify(data))
    },
    conectarSocket (usuario) {
      socket.on(`${usuario.tenantId}:chat:updateOnlineBubbles`, data => {
        this.$store.commit('SET_USERS_APP', data)
      })
      // Socket para atualizar contadores de tickets por fila e notificações
      socket.on(`${usuario.tenantId}:ticketList`, async data => {
        if (
          data.type === 'ticket:update' ||
          data.type === 'notification:new' ||
          data.type === 'chat:messagesRead'
        ) {
          await this.consultarTickets()
          await this.buscarContadoresTicketsPorFila()
        }
      })
    },
    atualizarUsuario () {
      this.usuario = JSON.parse(localStorage.getItem('usuario'))
      if (this.usuario.status === 'offline') {
        socket.emit(`${this.usuario.tenantId}:setUserIdle`)
      }
      if (this.usuario.status === 'online') {
        socket.emit(`${this.usuario.tenantId}:setUserActive`)
      }
    },
    async buscarContadoresTicketsPorFila () {
      try {
        const { data } = await ContarTicketsPendentesPorFila()
        const counts = {}
        if (data.queues && Array.isArray(data.queues)) {
          data.queues.forEach(queue => {
            const queueKey = queue.queueId || 'sem-fila'
            counts[queueKey] = Number(queue.count) || 0
          })
        }
        // Garantir que não há reatividade indesejada
        this.queueTicketCounts = Object.assign({}, counts)
      } catch (error) {
        this.queueTicketCounts = {}
      }
    },
    async consultarTickets () {
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
        this.countTickets = data.count // count total de tickets no status
        this.$store.commit('UPDATE_NOTIFICATIONS', data)
      } catch (err) {
        this.$notificarErro('Algum problema', err)
        // Erro no processo
      }
      const params2 = {
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
        const { data } = await ConsultarTickets(params2)
        this.countTickets = data.count // count total de tickets no status
        this.$store.commit('UPDATE_NOTIFICATIONS_P', data)
      } catch (err) {
        this.$notificarErro('Algum problema', err)
        // Erro no processo
      }
    },
    abrirChatContato (ticket) {
      // caso esteja em um tamanho mobile, fechar a drawer dos contatos
      if (this.$q.screen.lt.md && ticket.status !== 'pending') {
        this.$root.$emit('infor-cabecalo-chat:acao-menu')
      }
      if (!(ticket.status !== 'pending' && (ticket.id !== this.$store.getters.ticketFocado.id || this.$route.name !== 'chat'))) return
      this.$store.commit('SET_HAS_MORE', true)
      this.$store.dispatch('AbrirChatMensagens', ticket)
    },
    abrirAtendimentoExistente (contato, ticket) {
      this.$q.dialog({
        title: 'Atenção!!',
        message: `${contato} possui um atendimento em curso (Atendimento: ${ticket.id}). Deseja abrir o atendimento?`,
        cancel: {
          label: 'Não',
          color: 'primary',
          push: true
        },
        ok: {
          label: 'Sim',
          color: 'negative',
          push: true
        },
        persistent: true
      }).onOk(async () => {
        try {
          this.abrirChatContato(ticket)
        } catch (error) {
          this.$notificarErro(
            'Não foi possível atualizar o token',
            error
          )
        }
      })
    },
    // Método para atualizar o título da guia
    atualizarTituloGuia () {
      atualizarTituloGuia(this.notifications, this.notifications_p)
    },
    async abrirDetalhesErro (errorNotification) {
      // Implemente a lógica para abrir detalhes do erro
      console.log('Abrir detalhes do erro:', errorNotification)
    },
    // Métodos para gerenciar notificações de erro
    adicionarNotificacaoErro (tipo, titulo, mensagem, detalhes = null) {
      const errorNotification = {
        id: Date.now() + Math.random(),
        tipo,
        title: titulo,
        message: mensagem,
        details: detalhes,
        timestamp: new Date().toLocaleString('pt-BR'),
        resolved: false
      }

      this.$store.commit('ADD_ERROR_NOTIFICATION', errorNotification)

      // Mostrar notificação visual
      this.$q.notify({
        type: 'negative',
        message: titulo,
        caption: mensagem,
        position: 'bottom-right',
        timeout: 8000,
        actions: [
          { label: 'Ver Detalhes', color: 'white', handler: () => this.abrirDetalhesErro(errorNotification) },
          { label: 'OK', color: 'white' }
        ]
      })
    },
    removerNotificacaoErro (errorId) {
      this.$store.commit('REMOVE_ERROR_NOTIFICATION', errorId)
    },
    limparNotificacoesErro () {
      this.$store.commit('CLEAR_ERROR_NOTIFICATIONS')
    },
    // Verificar problemas de conexão e adicionar notificações
    verificarProblemasConexao () {
      const errors = errorNotificationService.checkWhatsAppConnectionErrors(this.whatsapps)

      // Adicionar notificações para cada erro
      errors.forEach(error => {
        this.adicionarNotificacaoErro(
          error.tipo,
          error.title,
          error.message,
          error.details
        )
      })
    }
  },
  async mounted () {
    this.atualizarUsuario()
    await this.listarWhatsapps()
    await this.listarConfiguracoes()
    await this.consultarTickets()
    await this.buscarContadoresTicketsPorFila()
    this.usuario = JSON.parse(localStorage.getItem('usuario'))
    this.userProfile = localStorage.getItem('profile')
    await this.conectarSocket(this.usuario)
    // Request notification permission on first user interaction
    this.requestNotificationPermissionOnInteraction()

    // Listener global para novas mensagens (chat:create)
    socket.on(`${this.usuario.tenantId}:ticketList`, data => {
      if (data.type === 'chat:create') {
        if (data.payload.fromMe) return
        // Tocar som de notificação para mensagens recebidas de outros contatos
        this.$nextTick(() => {
          this.$q.notify({
            message: 'Nova mensagem recebida',
            color: 'info',
            position: 'bottom-right',
            timeout: 1000
          })
        })
        // Tocar áudio
        this.$nextTick(() => {
          import('src/helpers/helpersNotifications').then(mod => {
            mod.tocarSomNotificacao()
          })
        })
      }
    })

    // Atualizar título da guia inicialmente
    this.atualizarTituloGuia()

    // Iniciar monitoramento de erros
    errorNotificationService.startMonitoring()

    // Verificar problemas de conexão iniciais
    this.verificarProblemasConexao()
  },
  watch: {
    // Watcher para monitorar mudanças nas notificações e atualizar o título da guia
    notifications: {
      handler () {
        this.atualizarTituloGuia()
      },
      deep: true
    },
    notifications_p: {
      handler () {
        this.atualizarTituloGuia()
      },
      deep: true
    },
    // Watcher para monitorar mudanças nos WhatsApps e adicionar notificações de erro
    whatsapps: {
      handler (newWhatsapps, oldWhatsapps) {
        if (!oldWhatsapps) return

        // Verificar se houve mudança de status para problemas
        newWhatsapps.forEach((whatsapp, index) => {
          const oldWhatsapp = oldWhatsapps[index]
          if (oldWhatsapp && oldWhatsapp.status !== whatsapp.status) {
            // Se mudou para um status problemático, adicionar notificação
            if (['DISCONNECTED', 'TIMEOUT', 'PAIRING'].includes(whatsapp.status)) {
              let titulo = ''
              let mensagem = ''

              switch (whatsapp.status) {
                case 'DISCONNECTED':
                  titulo = 'Conexão Desconectada'
                  mensagem = `WhatsApp ${whatsapp.name} foi desconectado`
                  break
                case 'TIMEOUT':
                  titulo = 'Timeout de Conexão'
                  mensagem = `WhatsApp ${whatsapp.name} apresentou timeout`
                  break
                case 'PAIRING':
                  titulo = 'Problema de Emparelhamento'
                  mensagem = `WhatsApp ${whatsapp.name} com problema de emparelhamento`
                  break
              }

              this.adicionarNotificacaoErro(
                'conexao',
                titulo,
                mensagem,
                { whatsappId: whatsapp.id, whatsappName: whatsapp.name }
              )
            }
          }
        })
      },
      deep: true
    }
  },
  destroyed () {
    socket.disconnect()
    // Parar monitoramento de erros
    errorNotificationService.stopMonitoring()
  }
}
</script>
<style>
.q-img__image {
  background-size: contain;
}

/* Borda no menu lateral esquerdo */
.q-drawer {
  border-right: 2px solid rgba(0, 0, 0, 0.12) !important;

}

/* Borda no tema escuro */
.body--dark .q-drawer {
  border-right: 2px solid rgba(255, 255, 255, 0.12) !important;

}

/* Estilo específico para o drawer lateral */
.q-drawer--left {
  border-right: 2px solid rgba(0, 0, 0, 0.12) !important;

}

.body--dark .q-drawer--left {
  border-right: 2px solid rgba(255, 255, 255, 0.12) !important;

}

/* Cores dos ícones no tema escuro */
.body--dark .q-icon {
  color: rgba(255, 255, 255, 0.7) !important;
}

.body--dark .houverList .q-icon {
  color: rgba(255, 255, 255, 0.6) !important;
}

.body--dark .houverList:hover .q-icon {
  color: rgba(255, 255, 255, 0.9) !important;
}

/* Cores dos ícones no tema claro */
.q-drawer .q-icon {
  color: rgba(0, 0, 0, 0.7) !important;
}

.houverList .q-icon {
  color: rgba(0, 0, 0, 0.6) !important;
}

.houverList:hover .q-icon {
  color: rgba(0, 0, 0, 0.8) !important;
}

/* Cores dos ícones quando selecionados/ativos */
.q-item--active .q-icon {
  color: #1976d2 !important;
}

.body--dark .q-item--active .q-icon {
  color: #64b5f6 !important;
}

.router-link-active .q-icon {
  color: #1976d2 !important;
}

.body--dark .router-link-active .q-icon {
  color: #64b5f6 !important;
}

/* Estilo para item ativo/selecionado */
.q-item--active {
  background: rgba(25, 118, 210, 0.1) !important;
  border-left: 3px solid #1976d2 !important;
}

.body--dark .q-item--active {
  background: rgba(100, 181, 246, 0.15) !important;
  border-left: 3px solid #64b5f6 !important;
}

.router-link-active {
  background: rgba(25, 118, 210, 0.1) !important;
  border-left: 3px solid #1976d2 !important;
}

.body--dark .router-link-active {
  background: rgba(100, 181, 246, 0.15) !important;
  border-left: 3px solid #64b5f6 !important;
}

/* Estilos para tooltips */
.q-tooltip {
  background: rgba(55, 65, 81, 0.96) !important;
  color: rgba(255, 255, 255, 0.95) !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  padding: 4px 8px !important;
  border-radius: 6px !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  letter-spacing: 0.2px !important;
}

.body--dark .q-tooltip {
  background: rgba(71, 85, 105, 0.95) !important;
  color: rgba(255, 255, 255, 0.98) !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
}
</style>
