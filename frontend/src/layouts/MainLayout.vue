<template>
  <q-layout view="lHh Lpr lFf">
    <q-drawer
      :model-value="true"
      persistent
      :width="70"
      :breakpoint="1024"
      :mini="false"
      mini-to-overlay
      class="bg-sidebar-custom icon-only-sidebar"
    >
            <div class="sidebar-content">
        <q-list class="compact-list" :key="userProfile">
          <!-- Botão Menu do Sistema -->
          <q-item clickable v-ripple class="houverList icon-only-item" @click="topMenuOpen = !topMenuOpen">
            <q-tooltip anchor="center right" self="center left" :offset="[10, 0]">
              Menu do Sistema
            </q-tooltip>
            <q-item-section avatar class="icon-centered">
              <q-icon name="menu" />
            </q-item-section>
          </q-item>

          <!-- Separador -->
          <q-separator spaced />

          <q-item clickable v-ripple class="houverList icon-only-item">
            <q-tooltip anchor="center right" self="center left" :offset="[10, 0]">
              Alertas
            </q-tooltip>
            <q-item-section avatar class="icon-centered">
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
          />
          <div v-if="userProfile === 'admin'">
            <q-separator spaced />
            <template v-for="item in menuDataAdmin">
              <EssentialLink
                v-if="exibirMenuBeta(item)"
                :key="item.title"
                v-bind="item"
              />
            </template>
            <q-separator spaced />
          </div>
          <div class="q-mt-sm">
            <q-item clickable v-ripple class="houverList icon-only-item">
              <q-tooltip anchor="center right" self="center left" :offset="[10, 0]">
                Usuário
              </q-tooltip>
              <q-item-section avatar class="icon-centered">
                <q-icon name="account_circle" />
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
            <q-item clickable v-ripple class="houverList icon-only-item" @click="$setConfigsUsuario({ isDark: !$q.dark.isActive })">
              <q-tooltip anchor="center right" self="center left" :offset="[10, 0]">
                {{ $q.dark.isActive ? 'Modo Claro' : 'Modo Escuro' }}
              </q-tooltip>
              <q-item-section avatar class="icon-centered">
                <q-icon :name="$q.dark.isActive ? 'light_mode' : 'dark_mode'" />
              </q-item-section>
            </q-item>
          </div>
        </q-list>
      </div>
    </q-drawer>

    <!-- Menu lateral do topo -->
    <q-drawer
      v-model="topMenuOpen"
      side="left"
      overlay
      :width="300"
      class="top-menu-drawer"
    >
      <div class="top-menu-header">
        <div class="top-menu-brand">
          <q-avatar size="60px" class="brand-avatar">
            <q-icon name="chat" size="32px" />
          </q-avatar>
          <div class="brand-info">
            <div class="brand-title">NOC Chat System</div>
            <div class="brand-subtitle">
              <q-icon name="circle" size="8px" color="positive" />
              Online
            </div>
          </div>
        </div>
        <q-btn
          flat
          dense
          round
          icon="arrow_back"
          @click="topMenuOpen = false"
          class="close-menu-btn"
        />
      </div>

      <q-scroll-area class="top-menu-content">
        <q-list class="top-menu-list">
          <!-- Seção Principal -->
          <q-item-label header class="menu-section-header">
            NAVEGAÇÃO PRINCIPAL
          </q-item-label>

          <q-item
            clickable
            v-ripple
            class="top-menu-item"
            @click="navigateAndClose('chat-empty')"
          >
            <q-item-section avatar>
              <q-icon name="chat" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Abrir novo atendimento</q-item-label>
            </q-item-section>
          </q-item>

          <q-item
            clickable
            v-ripple
            class="top-menu-item"
            @click="navigateAndClose('campanhas')"
          >
            <q-item-section avatar>
              <q-icon name="send" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Envio em massa</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator class="menu-separator" />

          <!-- Seção Administrativa -->
          <q-item-label header class="menu-section-header">
            ADMINISTRAÇÃO
          </q-item-label>

          <q-item
            clickable
            v-ripple
            class="top-menu-item"
            @click="navigateAndClose('usuarios')"
            v-if="userProfile === 'admin'"
          >
            <q-item-section avatar>
              <q-icon name="people_outline" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Usuários</q-item-label>
            </q-item-section>
          </q-item>

          <q-item
            clickable
            v-ripple
            class="top-menu-item"
            @click="navigateAndClose('contatos')"
          >
            <q-item-section avatar>
              <q-icon name="contacts" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Leads/Contatos</q-item-label>
            </q-item-section>
          </q-item>

          <q-item
            clickable
            v-ripple
            class="top-menu-item"
            @click="navigateAndClose('sessoes')"
            v-if="userProfile === 'admin'"
          >
            <q-item-section avatar>
              <q-icon name="phone_iphone" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Canais de comunicação</q-item-label>
            </q-item-section>
          </q-item>

          <q-item
            clickable
            v-ripple
            class="top-menu-item"
            @click="navigateAndClose('api-service')"
            v-if="userProfile === 'admin'"
          >
            <q-item-section avatar>
              <q-icon name="api" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Integrações</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator class="menu-separator" />

          <!-- Seção Sistema -->
          <q-item-label header class="menu-section-header">
            SISTEMA
          </q-item-label>

          <q-item
            clickable
            v-ripple
            class="top-menu-item"
            @click="navigateAndClose('chat-flow')"
            v-if="userProfile === 'admin'"
          >
            <q-item-section avatar>
              <q-icon name="smart_toy" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Fluxo de comunicação</q-item-label>
            </q-item-section>
          </q-item>

          <q-item
            clickable
            v-ripple
            class="top-menu-item"
            @click="navigateAndClose('configuracoes')"
            v-if="userProfile === 'admin'"
          >
            <q-item-section avatar>
              <q-icon name="settings" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Configurações</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator class="menu-separator" />

          <!-- Seção Usuário -->
          <q-item
            clickable
            v-ripple
            class="top-menu-item logout-item"
            @click="efetuarLogout"
          >
            <q-item-section avatar>
              <q-icon name="logout" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Sair</q-item-label>
            </q-item-section>
          </q-item>
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
      v-model:modalUsuario="modalUsuario"
      v-model:usuarioEdicao="usuario"
    />
  </q-layout>
</template>

<script>
import cSystemVersion from '../components/cSystemVersion.vue'
import { ListarWhatsapps } from 'src/service/sessoesWhatsapp'
import EssentialLink from 'components/EssentialLink.vue'
import socketInitial from './socketInitial'
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
import { VAPID_PUBLIC_KEY } from 'src/pwa-push-config'
import request from 'src/service/request'

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
  }
]

const objMenuAdmin = [
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
      userProfile: 'user',
      modalUsuario: false,
      usuario: {},
      topMenuOpen: false, // Menu lateral do topo
      menuData: [
        ...objMenu.filter(item => item.routeName === 'dashboard'),
        ...objMenu.filter(item => item.routeName !== 'dashboard')
      ],
      menuDataAdmin: objMenuAdmin,
      ticketsList: [],
      queueTicketCounts: {},
      consultarTicketsTimeout: null, // Para debounce da consulta
      mostrarPopupPermissaoAudio: false
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

          // Sempre mostrar badge: azul para 0, vermelho para > 0
          const badgeColor = totalPending > 0 ? 'red' : 'blue'
          return { ...menu, badge: totalPending, badgeColor }
        }
        // Badge para atendimentos em andamento
        if (menu.routeName === 'atendimento' && menu.query?.status === 'open') {
          let totalOpen = 0
          let ticketsWithUnread = 0

          if (this.notifications) {
            // Usar os dados combinados
            if (Array.isArray(this.notifications.tickets)) {
              totalOpen = this.notifications.tickets.length
            }

            if (Array.isArray(this.notifications.ticketsUnread)) {
              // Contar apenas a quantidade de tickets com mensagens não lidas
              ticketsWithUnread = this.notifications.ticketsUnread.length
            } else if (Array.isArray(this.notifications.tickets)) {
              // Fallback: contar tickets que têm mensagens não lidas
              ticketsWithUnread = this.notifications.tickets.filter(ticket =>
                ticket.unreadMessages && ticket.unreadMessages > 0
              ).length
            }
          }

          // Determinar cor e contagem do badge
          let badgeColor = 'blue'
          let badgeCount = totalOpen

          // Se há tickets com mensagens não lidas, mostrar badge vermelho com contagem de tickets
          if (ticketsWithUnread > 0) {
            badgeColor = 'red'
            badgeCount = ticketsWithUnread
          }

          // Sempre mostrar o badge azul, mesmo se badgeCount for 0
          return { ...menu, badge: badgeCount, badgeColor }
        }
        return menu
      })
    }
  },
  methods: {

    requestNotificationPermissionOnInteraction () {
      const requestPermission = async () => {
        // Solicitar permissão de notificação
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission()
        }

        // Solicitar permissão de áudio
        try {
          const { solicitarPermissaoAudio } = await import('src/helpers/helpersNotifications')
          await solicitarPermissaoAudio()
        } catch (error) {
          console.warn('Erro ao solicitar permissão de áudio:', error)
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
      // Enviar notificação push via backend
      // Aqui, você pode customizar o payload conforme necessário
      fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          title: `Mensagem de ${data.contact?.name || 'Contato'}`,
          body: data.message?.body || 'Nova mensagem recebida',
          icon: data.contact?.profilePicUrl || '/icons/icon-128x128.png',
          data: { url: '/atendimento' }
        })
      })
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
          data.type === 'chat:messagesRead' ||
          data.type === 'chat:create'
        ) {
          // Para mensagens novas, fazer notificação antes de atualizar contadores
          if (data.type === 'chat:create' && data.payload && !data.payload.fromMe) {
            // Notificação removida conforme solicitado
            /*
            // Tocar som de notificação para mensagens recebidas de outros contatos
            this.$nextTick(() => {
              this.$q.notify({
                message: 'Nova mensagem recebida',
                color: 'info',
                position: 'bottom-right',
                timeout: 1000
              })
            })
            */
            // Tocar áudio
            this.$nextTick(() => {
              import('src/helpers/helpersNotifications').then(mod => {
                mod.tocarSomNotificacao()
              })
            })
          }

          await this.consultarTicketsComDebounce()
          await this.buscarContadoresTicketsPorFila()
        }
      })

      // Listener específico para atualizações de mensagens lidas
      socket.on(`${usuario.tenantId}:chat:messagesRead`, async data => {
        await this.consultarTicketsComDebounce()
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
      try {
        // Buscar todos os tickets em andamento (sem filtro de mensagens não lidas)
        const paramsAllOpen = {
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

        const { data: dataAllOpen } = await ConsultarTickets(paramsAllOpen)

        // Buscar apenas tickets com mensagens não lidas
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

        // Combinar os dados para o badge
        const badgeData = {
          tickets: dataAllOpen.tickets || [],
          ticketsUnread: dataUnread.tickets || [],
          count: dataAllOpen.count || 0
        }

        this.$store.commit('UPDATE_NOTIFICATIONS', badgeData)
      } catch (err) {
        this.$notificarErro('Erro ao consultar tickets', err)
      }

      // Buscar tickets pendentes
      try {
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

        const { data } = await ConsultarTickets(params2)
        this.$store.commit('UPDATE_NOTIFICATIONS_P', data)
      } catch (err) {
        this.$notificarErro('Erro ao consultar tickets pendentes', err)
      }
    },
    // Método com debounce para evitar múltiplas chamadas seguidas
    async consultarTicketsComDebounce () {
      // Cancelar timeout anterior se existir
      if (this.consultarTicketsTimeout) {
        clearTimeout(this.consultarTicketsTimeout)
      }

      // Criar novo timeout com debounce de 100ms
      return new Promise(resolve => {
        this.consultarTicketsTimeout = setTimeout(async () => {
          await this.consultarTickets()
          resolve()
        }, 100)
      })
    },
    abrirChatContato (ticket) {
      // caso esteja em um tamanho mobile, fechar a drawer dos contatos
      if (this.$q.screen.lt.md && ticket.status !== 'pending') {
        this.$eventBus.emit('infor-cabecalo-chat:acao-menu')
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
    navigateAndClose (routeName) {
      this.topMenuOpen = false

      // Limpar ticket focado se navegando para páginas que não são de atendimento
      const atendimentoRoutes = ['atendimento', 'chat-empty', 'chat', 'chat-contatos']
      if (!atendimentoRoutes.includes(routeName)) {
        this.$store.commit('TICKET_FOCADO', {})
      }

      this.$router.push({ name: routeName }).catch(err => {
        if (err.name !== 'NavigationDuplicated') throw err
      })
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
    },
    async liberarPermissaoAudio () {
      try {
        const { solicitarPermissaoAudio } = await import('src/helpers/helpersNotifications')
        await solicitarPermissaoAudio()
        this.mostrarPopupPermissaoAudio = false
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: 'Não foi possível liberar o áudio. Tente novamente.',
          position: 'bottom-right'
        })
      }
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

    // Listeners de socket já configurados em conectarSocket()

    // Atualizar título da guia inicialmente
    this.atualizarTituloGuia()

    // Iniciar monitoramento de erros
    errorNotificationService.startMonitoring()

    // Verificar problemas de conexão iniciais
    this.verificarProblemasConexao()

    // Inicializar o áudio no primeiro clique do usuário, sem popup
    const { inicializarServicoAudio } = await import('src/helpers/helpersNotifications')
    if (localStorage.getItem('audioPermissionGiven') === 'true') {
      inicializarServicoAudio()
    } else {
      const liberarAudio = () => {
        inicializarServicoAudio()
        localStorage.setItem('audioPermissionGiven', 'true')
        document.removeEventListener('click', liberarAudio)
      }
      document.addEventListener('click', liberarAudio, { once: true })
    }

    // Função global para testar o som manualmente pelo console
    window.testarSom = async () => {
      const { tocarSomNotificacao } = await import('src/helpers/helpersNotifications')
      tocarSomNotificacao()
    }

    // Conectar socket global para notificações de mensagem
    const usuario = JSON.parse(localStorage.getItem('usuario'))
    if (usuario && usuario.tenantId) {
      const eventName = `tenant:${usuario.tenantId}:appMessage`
      socket.on(eventName, (data) => {
        try {
          const payload = Array.isArray(data) ? data[0] : data
          if (payload && payload.action === 'create' && payload.message && !payload.message.fromMe) {
            tocarSomNotificacao()
          }
        } catch (e) {
          console.error('[appMessage] Erro ao processar notificação:', e)
        }
      })
    }

    // Solicitar permissão de notificação e inscrever no Push API
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          const permission = await Notification.requestPermission()
          console.log('Permissão de notificação:', permission)
        } catch (e) {
          console.error('Erro ao solicitar permissão de notificação:', e)
        }
      }

      // Só tentar registrar push se a permissão foi concedida
      if (Notification.permission === 'granted') {
        subscribeUserToPush()
      } else {
        console.warn('Push notifications não serão configuradas - permissão não concedida')
      }
    } else {
      console.warn('Notifications API não suportada neste navegador')
    }
  },
  watch: {
    // Watcher para monitorar mudanças nas notificações e atualizar o título da guia
    notifications: {
      handler (newNotifications) {
        this.atualizarTituloGuia()
        // Removido $forceUpdate() que causava dupla execução
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
        // Remover qualquer notificação de erro relacionada ao canal que ficou CONNECTED
        newWhatsapps.forEach(whatsapp => {
          if (whatsapp.status === 'CONNECTED') {
            (this.errorNotifications || [])
              .filter(n =>
                (n.details?.whatsappId === whatsapp.id) ||
                (n.message && n.message.includes(whatsapp.name)) ||
                (n.title && n.title.includes(whatsapp.name))
              )
              .forEach(n => this.removerNotificacaoErro(n.id))
          }
        })

        // Lógica existente para adicionar notificações de erro
        if (!oldWhatsapps) return
        newWhatsapps.forEach((whatsapp, index) => {
          const oldWhatsapp = oldWhatsapps[index]
          if (oldWhatsapp && oldWhatsapp.status !== whatsapp.status) {
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
    },
    $route: {
      handler (newRoute, oldRoute) {
        // Limpar ticket focado se navegando para páginas que não são de atendimento
        const atendimentoRoutes = ['atendimento', 'chat-empty', 'chat', 'chat-contatos']
        const isAtendimentoRoute = atendimentoRoutes.includes(newRoute.name)
        const wasAtendimentoRoute = oldRoute ? atendimentoRoutes.includes(oldRoute.name) : false

        // Se estava em atendimento e agora não está, limpar ticket focado
        if (wasAtendimentoRoute && !isAtendimentoRoute) {
          this.$store.commit('TICKET_FOCADO', {})
        }
      },
      immediate: false
    }
  },
  destroyed () {
    socket.disconnect()
    // Parar monitoramento de erros
    errorNotificationService.stopMonitoring()
    // Limpar timeout de debounce
    if (this.consultarTicketsTimeout) {
      clearTimeout(this.consultarTicketsTimeout)
    }
  }
}

async function subscribeUserToPush () {
  try {
    // Verificar suporte do navegador
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker não suportado neste navegador')
      return
    }

    if (!('PushManager' in window)) {
      console.warn('Push Manager não suportado neste navegador')
      return
    }

    // Verificar permissão de notificação
    if (Notification.permission !== 'granted') {
      console.warn('Permissão de notificação não concedida. Status:', Notification.permission)
      return
    }

    // Aguardar service worker estar pronto
    const registration = await navigator.serviceWorker.ready

    // Verificar se já existe uma subscription
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      // Criar nova subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }

    // Sempre envie a subscription para o backend
    await request({
      url: '/api/push/subscribe',
      method: 'POST',
      data: subscription,
      silentError: true
    })
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      console.warn('Usuário negou permissão para notificações push')
    } else if (error.name === 'NotSupportedError') {
      console.warn('Push notifications não suportadas neste navegador')
    }
  }
}

function urlBase64ToUint8Array (base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
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

.body--dark .houverList .q-icon {
  color: rgba(255, 255, 255, 0.6) !important;
}

.body--dark .houverList:hover .q-icon {
  color: rgba(255, 255, 255, 0.9) !important;
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

  /* Estilos para o novo menu lateral do topo */
  .top-menu-drawer {
    background: #ffffff !important;
    box-shadow: 2px 0 30px rgba(0, 0, 0, 0.1) !important;
  }

  .body--dark .top-menu-drawer {
    background: #1e293b !important;
    box-shadow: 2px 0 30px rgba(0, 0, 0, 0.4) !important;
  }

  .top-menu-header {
    padding: 24px 20px;
    background: #3b82f6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }

  .top-menu-header::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="40" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="40" cy="80" r="1.5" fill="rgba(255,255,255,0.1)"/></svg>');
    opacity: 0.3;
  }

  .top-menu-brand {
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
    z-index: 1;
  }

  .brand-avatar {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .brand-info {
    flex: 1;
  }

  .brand-title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 4px;
  }

  .brand-subtitle {
    font-size: 12px;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .close-menu-btn {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    transition: all 0.3s ease;
    position: relative;
    z-index: 1;
  }

  .close-menu-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }

  .top-menu-content {
    flex: 1;
    height: calc(100vh - 120px);
  }

  .top-menu-list {
    padding: 16px 0;
  }

  .menu-section-header {
    color: #64748b;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding: 12px 24px 8px 24px;
    margin: 0;
  }

  .body--dark .menu-section-header {
    color: #94a3b8;
  }

  .top-menu-item {
    margin: 2px 16px;
    border-radius: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    min-height: 48px;
  }

  .top-menu-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(59, 130, 246, 0.1);
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 0;
  }

  .top-menu-item:hover {
    background: rgba(59, 130, 246, 0.05);
    transform: translateX(6px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  }

  .top-menu-item:hover::before {
    opacity: 1;
  }

  .body--dark .top-menu-item:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  .top-menu-item .q-item__section--avatar {
    min-width: 50px;
    position: relative;
    z-index: 1;
  }

  .top-menu-item .q-icon {
    font-size: 20px;
    color: #64748b;
    transition: all 0.3s ease;
  }

  .body--dark .top-menu-item .q-icon {
    color: #94a3b8;
  }

  .top-menu-item:hover .q-icon {
    color: #3b82f6;
    transform: scale(1.1);
  }

  .top-menu-item .q-item__label {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    position: relative;
    z-index: 1;
  }

  .body--dark .top-menu-item .q-item__label {
    color: #e5e7eb;
  }

  .top-menu-item:hover .q-item__label {
    color: #1e293b;
  }

  .body--dark .top-menu-item:hover .q-item__label {
    color: #f8fafc;
  }

  .logout-item {
    margin-top: 16px;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .logout-item:hover {
    background: rgba(239, 68, 68, 0.05) !important;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .logout-item:hover .q-icon {
    color: #ef4444 !important;
  }

  .logout-item:hover .q-item__label {
    color: #ef4444 !important;
  }

  .menu-separator {
    margin: 16px 24px;
    opacity: 0.2;
  }

  .body--dark .menu-separator {
    opacity: 0.3;
  }

  /* Animação de entrada do menu */
  .q-drawer--left.q-drawer--overlay.top-menu-drawer {
    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  }

  /* Garantir que o conteúdo seja empurrado pelo menu */
  .q-layout__section--marginal.fixed-left {
    z-index: 2000;
  }

  .q-page-container {
    padding-left: 70px;
  }

  @media (max-width: 1023px) {
    .q-page-container {
      padding-left: 0;
    }
  }

  .q-page {
    padding-left: 0 !important;
    margin-left: 0 !important;
  }

  /* Estilo para o botão do menu do topo */
  .top-menu-btn {
    position: fixed;
    top: 16px;
    left: 240px;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(10px);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    color: #374151 !important;
  }

  .body--dark .top-menu-btn {
    background: rgba(30, 41, 59, 0.95) !important;
    color: #e5e7eb !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .top-menu-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.15);
    background: rgba(59, 130, 246, 0.1) !important;
    color: #3b82f6 !important;
  }

  .body--dark .top-menu-btn:hover {
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
    background: rgba(59, 130, 246, 0.2) !important;
    color: #60a5fa !important;
  }

  @media (max-width: 1023px) {
    .top-menu-btn {
      left: 76px;
    }
  }

  /* Estilos para menu apenas com ícones */
  .icon-only-sidebar {
    min-width: 70px !important;
    max-width: 70px !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .icon-only-sidebar .q-drawer__content {
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }

  .icon-only-item {
    justify-content: center !important;
    padding: 6px 4px !important;
    min-height: 42px;
  }

  .icon-centered {
    min-width: auto !important;
    padding-right: 0 !important;
    justify-content: center !important;
    align-items: center !important;
    width: 100%;
  }

  .icon-centered .q-icon {
    font-size: 20px !important;
    margin: 0 !important;
  }

  /* Ajustar separadores para menu apenas com ícones */
  .icon-only-sidebar .q-separator {
    margin: 8px 8px !important;
  }

  /* Ajuste dos badges para menu apenas com ícones */
  .icon-centered .q-badge {
    top: -4px !important;
    right: -4px !important;
  }

  /* Ajustes dos tooltips para o menu apenas com ícones */
  .icon-only-sidebar .q-tooltip {
    font-size: 12px !important;
    padding: 6px 10px !important;
    max-width: 200px;
    text-align: center;
  }

  /* Espaçamento da lista no menu apenas com ícones */
  .icon-only-sidebar .q-list {
    padding: 8px 0 !important;
  }

  /* Lista compacta para economizar espaço */
  .compact-list {
    padding: 4px 0 !important;
  }

  .icon-only-sidebar .compact-list {
    padding: 6px 0 !important;
    flex-shrink: 0 !important;
    overflow: visible !important;
  }

  /* Container do conteúdo do sidebar */
  .sidebar-content {
    flex: 1;
    overflow: visible;
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 8px 0;
  }

  /* Menu apenas com ícones - sem scroll */
  .icon-only-sidebar .sidebar-content {
    overflow: visible;
    height: 100vh;
    flex: 1;
    padding: 8px 0;
  }

  /* Ajustar itens ativos no menu apenas com ícones */
  .icon-only-sidebar .q-item--active,
  .icon-only-sidebar .router-link-active {
    border-left: 3px solid #1976d2 !important;
    border-radius: 0 !important;
    background: rgba(25, 118, 210, 0.1) !important;
  }

  .body--dark .icon-only-sidebar .q-item--active,
  .body--dark .icon-only-sidebar .router-link-active {
    border-left: 3px solid #64b5f6 !important;
    background: rgba(100, 181, 246, 0.15) !important;
  }

  </style>
