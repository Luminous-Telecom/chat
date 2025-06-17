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
      class="bg-grey-1"
    >
      <q-scroll-area class="fit">
        <q-list padding :key="userProfile">
          <q-item clickable v-ripple class="houverList" @click="miniState = !miniState">
            <q-item-section avatar>
              <q-icon name="menu" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Menu</q-item-label>
            </q-item-section>
          </q-item>
          <q-item clickable v-ripple class="houverList">
            <q-item-section avatar>
              <q-icon name="notifications" />
              <q-badge
                color="red"
                text-color="white"
                floating
                v-if="(parseInt(notifications.count) + parseInt(notifications_p.count)) > 0"
              >
                {{ parseInt(notifications.count) + parseInt(notifications_p.count) }}
              </q-badge>
            </q-item-section>
            <q-item-section>
              <q-item-label>Notificações</q-item-label>
            </q-item-section>
            <q-menu anchor="top right" self="top left">
              <q-list style="min-width: 300px">
                <q-item v-if="(parseInt(notifications.count) + parseInt(notifications_p.count)) == 0">
                  <q-item-section style="cursor: pointer;">
                    Nada de novo por aqui!
                  </q-item-section>
                </q-item>
                <q-item v-if="parseInt(notifications_p.count) > 0">
                  <q-item-section
                    avatar
                    @click="() => $router.push({ name: 'atendimento' })"
                    style="cursor: pointer;"
                  >
                    <q-avatar
                      style="width: 60px; height: 60px"
                      color="blue"
                      text-color="white"
                    >
                      {{ notifications_p.count }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section
                    @click="() => $router.push({ name: 'atendimento' })"
                    style="cursor: pointer;"
                  >
                    Clientes pendentes na fila
                  </q-item-section>
                </q-item>
                <q-item
                  v-for="ticket in notifications.tickets"
                  :key="ticket.id"
                  style="border-bottom: 1px solid #ddd; margin: 5px;"
                >
                  <q-item-section
                    avatar
                    @click="abrirAtendimentoExistente(ticket.name, ticket)"
                    style="cursor: pointer;"
                  >
                    <q-avatar style="width: 60px; height: 60px">
                      <img :src="ticket.profilePicUrl">
                    </q-avatar>
                  </q-item-section>
                  <q-item-section
                    @click="abrirAtendimentoExistente(ticket.name, ticket)"
                    style="cursor: pointer;"
                  >
                    <q-list>
                      <q-item style="text-align:center; font-size: 17px; font-weight: bold; min-height: 0">{{ ticket.name }}</q-item>
                      <q-item style="min-height: 0; padding-top: 0"><b>Mensagem: </b> {{ ticket.lastMessage }}</q-item>
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
          />
          <div v-if="userProfile === 'admin'">
            <q-separator spaced />
            <div class="q-mb-lg"></div>
            <template v-for="item in menuDataAdmin">
              <EssentialLink
                v-if="exibirMenuBeta(item)"
                :key="item.title"
                v-bind="item"
              />
            </template>
            <q-separator spaced />
          </div>
          <div class="q-mt-lg">
            <q-item clickable v-ripple class="houverList">
              <q-item-section avatar>
                <q-icon name="mdi-account-circle-outline" />
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
              <q-item-section avatar>
                <q-icon :name="$q.dark.isActive ? 'mdi-weather-night' : 'mdi-weather-sunny'" />
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
      <q-page class="q-pa-xs">
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
import { tocarSomNotificacao } from 'src/helpers/helpersNotifications'

const socket = socketIO()

const objMenu = [
  {
    title: 'Dashboard',
    caption: '',
    icon: 'mdi-view-dashboard-outline',
    routeName: 'home-dashboard'
  },
  {
    title: 'Atendimentos na Fila',
    caption: 'Tickets em espera',
    icon: 'mdi-clock-outline',
    routeName: 'atendimento',
    query: { status: 'pending' }
  },
  {
    title: 'Atendimentos em Andamento',
    caption: 'Lista de atendimentos',
    icon: 'mdi-message-text-outline',
    routeName: 'atendimento',
    query: { status: 'open' }
  },
  {
    title: 'Atendimentos Finalizados',
    caption: 'Histórico de atendimentos',
    icon: 'mdi-folder-outline',
    routeName: 'atendimento',
    query: { status: 'closed' }
  },
  {
    title: 'Contatos',
    caption: 'Lista de contatos',
    icon: 'mdi-account-group-outline',
    routeName: 'contatos'
  }
]

const objMenuAdmin = [
  {
    title: 'Canais',
    caption: 'Canais de Comunicação',
    icon: 'mdi-whatsapp',
    routeName: 'sessoes'
  },
  {
    title: 'Painel Atendimentos',
    caption: 'Visão geral dos atendimentos',
    icon: 'mdi-view-dashboard-variant',
    routeName: 'painel-atendimentos'
  },
  {
    title: 'Relatórios',
    caption: 'Relatórios gerais',
    icon: 'mdi-file-chart',
    routeName: 'relatorios'
  },
  {
    title: 'Usuarios',
    caption: 'Admin de usuários',
    icon: 'mdi-account-group',
    routeName: 'usuarios'
  },
  {
    title: 'Filas',
    caption: 'Cadastro de Filas',
    icon: 'mdi-arrow-decision-outline',
    routeName: 'filas'
  },
  {
    title: 'Mensagens Rápidas',
    caption: 'Mensagens pré-definidas',
    icon: 'mdi-lightning-bolt-outline',
    routeName: 'mensagens-rapidas'
  },
  {
    title: 'Chatbot',
    caption: 'Robô de atendimento',
    icon: 'mdi-robot-outline',
    routeName: 'chat-flow'
  },
  {
    title: 'Etiquetas',
    caption: 'Cadastro de etiquetas',
    icon: 'mdi-tag-multiple-outline',
    routeName: 'etiquetas'
  },
  {
    title: 'Horário de Atendimento',
    caption: 'Horário de funcionamento',
    icon: 'mdi-clock-time-four-outline',
    routeName: 'horarioAtendimento'
  },
  {
    title: 'Configurações',
    caption: 'Configurações gerais',
    icon: 'mdi-cog-outline',
    routeName: 'configuracoes'
  },
  {
    title: 'Campanha',
    caption: 'Campanhas de envio',
    icon: 'mdi-bullhorn-outline',
    routeName: 'campanhas'
  },
  {
    title: 'API',
    caption: 'Integração sistemas externos',
    icon: 'mdi-api',
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
    ...mapGetters(['notifications', 'notifications_p', 'whatsapps']),
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
        // Adicionar badge para atendimentos na fila (tickets pendentes)
        if (menu.routeName === 'atendimento' && menu.query?.status === 'pending') {
          // Calcular total de forma mais direta e segura
          let totalPending = 0
          // FORÇAR OBJETO PURO AQUI
          const counts = Object.assign({}, this.queueTicketCounts || {})

          // Usar Object.values para evitar problemas de reatividade
          const values = Object.values(counts)
          totalPending = values.reduce((sum, count) => {
            return sum + (parseInt(count) || 0)
          }, 0)

          return { ...menu, badge: totalPending > 0 ? totalPending : 0 }
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
      // Socket para atualizar contadores de tickets por fila
      socket.on(`${usuario.tenantId}:ticketList`, async data => {
        if (data.type === 'ticket:update' || data.type === 'notification:new') {
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
  },
  destroyed () {
    socket.disconnect()
  }
}
</script>
<style scoped>
.q-img__image {
  background-size: contain;
}
</style>
