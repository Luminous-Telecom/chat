<template>
  <div
    class="WAL position-relative bg-grey-3"
    :style="style"
  >
    <q-layout
      class="WAL__layout shadow-3"
      container
      view="lHr LpR lFr"
    >
      <q-drawer
        v-model="drawerTickets"
        @hide="drawerTickets = false"
        show-if-above
        :overlay="$q.screen.lt.md"
        persistent
        :breakpoint="769"
        bordered
        :width="$q.screen.lt.md ? $q.screen.width : 380"
        content-class="hide-scrollbar full-width"
      >
        <StatusWhatsapp
          v-if="false"
          class="q-mx-sm full-width"
        />
        <q-toolbar class="bg-white text-primary q-pl-md q-pr-md">
          <div class="col custom-search-wrapper">
            <input
              v-model="searchTickets"
              placeholder="Buscar..."
              class="custom-search-input"
              type="text"
            />
            <q-icon name="search" class="search-icon" />
          </div>
          <div class="q-ml-md">
            <q-btn
              flat
              round
              dense
              class="contacts-btn"
              icon="mdi-account-multiple"
              @click="$q.screen.lt.md ? modalNovoTicket = true : $router.push({ name: 'chat-contatos' })"
            >
              <q-tooltip content-class="bg-padrao text-grey-9 text-bold">
                Contatos
              </q-tooltip>
            </q-btn>
          </div>
          <q-separator class="absolute-bottom" />
        </q-toolbar>

        <!-- Filtros condicionais baseado no status -->
        <q-toolbar class="bg-white text-primary q-pl-md q-pr-md q-pt-sm q-pb-sm justify-center" v-if="pesquisaTickets.status && pesquisaTickets.status.includes('pending')">
          <q-btn
            color="positive"
            class="filter-btn"
            size="sm"
            dense
            label="Tickets não atendidos"
            disabled
          />
          <q-separator class="absolute-bottom" />
        </q-toolbar>

        <!-- Filtros originais para outros status -->
        <q-toolbar class="bg-white text-primary q-pl-md q-pr-md q-pt-sm q-pb-sm justify-center" v-else>
          <q-btn
            :color="cFiltroSelecionado === 'meus' ? 'positive' : 'primary'"
            class="filter-btn"
            size="sm"
            dense
            label="Meus atendimentos"
            @click="setFilterMode('meus')"
          />
          <q-btn
            :color="cFiltroSelecionado === 'fila' ? 'positive' : 'primary'"
            class="filter-btn"
            size="sm"
            dense
            label="Meus departamentos"
            @click="setFilterMode('fila')"
          />
          <q-btn
            :color="cFiltroSelecionado === 'todos' ? 'positive' : 'primary'"
            class="filter-btn"
            size="sm"
            dense
            label="Todos"
            @click="setFilterMode('todos')"
          />
          <q-separator class="absolute-bottom" />
        </q-toolbar>

        <q-scroll-area
          ref="scrollAreaTickets"
          style="height: calc(100% - 130px)"
          @scroll="onScroll"
        >
          <!-- <q-separator /> -->
          <ItemTicket
            v-for="(ticket, key) in tickets"
            :key="key"
            :ticket="ticket"
            :filas="filas"
          />
          <div v-if="loading">
            <div class="row justify-center q-my-md">
              <q-spinner
                color="white"
                size="3em"
                :thickness="3"
              />
            </div>
            <div class="row col justify-center q-my-sm text-white">
              Carregando...
            </div>
          </div>
        </q-scroll-area>
      </q-drawer>

      <q-page-container>
        <router-view
          :mensagensRapidas="mensagensRapidas"
          :key="ticketFocado.id"
        ></router-view>
      </q-page-container>

      <q-drawer
        v-if="!cRouteContatos && ticketFocado.id"
        v-model="drawerContact"
        show-if-above
        bordered
        side="right"
        content-class="bg-grey-1"
      >
        <div
          class="bg-white full-width no-border-radius q-pa-sm"
          style="height:60px;"
        >
          <span class="q-ml-md text-h6">
            Dados Contato
          </span>
        </div>
        <q-separator />
        <q-scroll-area style="height: calc(100vh - 70px)">
          <div class="q-pa-sm">
            <q-card
              class="bg-white btn-rounded"
              style="width: 100%"
              bordered
              flat
            >
              <q-card-section class="text-center">
                <q-avatar style="border: 1px solid #9e9e9ea1 !important; width: 100px; height: 100px">
                  <q-icon
                    name="mdi-account"
                    style="width: 100px; height: 100px"
                    size="6em"
                    color="grey-5"
                    v-if="!ticketFocado.contact.profilePicUrl"
                  />
                  <q-img
                    :src="ticketFocado.contact.profilePicUrl"
                    style="width: 100px; height: 100px"
                  >
                    <template v-slot:error>
                      <q-icon
                        name="mdi-account"
                        size="1.5em"
                        color="grey-5"
                      />
                    </template>
                  </q-img>
                </q-avatar>
                <div
                  class="text-caption q-mt-md"
                  style="font-size: 14px"
                >
                  {{ ticketFocado.contact.name || '' }}
                </div>
                <div
                  class="text-caption q-mt-sm"
                  style="font-size: 14px"
                  id="number"
                  @click="copyContent(ticketFocado.contact.number || '')"
                >
                  {{ ticketFocado.contact.number || '' }}
                </div>
                <div
                  class="text-caption q-mt-md"
                  style="font-size: 14px"
                  id="email"
                  @click="copyContent(ticketFocado.contact.email || '')"
                >
                  {{ ticketFocado.contact.email || '' }}
                </div>
                <q-btn
                  color="primary"
                  class="q-mt-sm bg-padrao btn-rounded"
                  flat
                  icon="edit"
                  label="Editar Contato"
                  @click="editContact(ticketFocado.contact.id)"
                />
              </q-card-section>
            </q-card>
            <q-card
              class="bg-white btn-rounded q-mt-sm"
              style="width: 100%"
              bordered
              flat
            >
              <q-card-section class="text-bold q-pa-sm ">
                <q-btn
                  flat
                  class="bg-padrao btn-rounded"
                  :color="!$q.dark.isActive ? 'grey-9' : 'white'"
                  label="Logs"
                  icon="mdi-timeline-text-outline"
                  @click="abrirModalLogs"
                />
              </q-card-section>
            </q-card>
            <q-card
              class="bg-white q-mt-sm btn-rounded"
              style="width: 100%"
              bordered
              flat
              :key="ticketFocado.id + $uuid()"
            >
              <q-card-section class="text-bold q-pb-none">
                Etiquetas
                <q-separator />
              </q-card-section>
              <q-card-section class="q-pa-none">
                <q-select
                  square
                  borderless
                  :value="ticketFocado.contact.tags"
                  multiple
                  :options="etiquetas"
                  use-chips
                  option-value="id"
                  option-label="tag"
                  emit-value
                  map-options
                  dropdown-icon="add"
                  @input="tagSelecionada"
                >
                  <template v-slot:option="{ itemProps, itemEvents, opt, selected, toggleOption }">
                    <q-item
                      v-bind="itemProps"
                      v-on="itemEvents"
                    >
                      <q-item-section>
                        <q-item-label v-html="opt.tag"></q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-checkbox
                          :value="selected"
                          @input="toggleOption(opt)"
                        />
                      </q-item-section>
                    </q-item>
                  </template>
                  <template v-slot:selected-item="{ opt }">
                    <q-chip
                      dense
                      square
                      color="white"
                      text-color="primary"
                      class="q-ma-xs row col-12 text-body1"
                    >
                      <q-icon
                        :style="`color: ${opt.color}`"
                        name="mdi-pound-box-outline"
                        size="28px"
                        class="q-mr-sm"
                      />
                      {{ opt.tag }}
                    </q-chip>
                  </template>
                  <template v-slot:no-option="{ itemProps, itemEvents }">
                    <q-item
                      v-bind="itemProps"
                      v-on="itemEvents"
                    >
                      <q-item-section>
                        <q-item-label class="text-negative text-bold">
                          Ops... Sem etiquetas criadas!
                        </q-item-label>
                        <q-item-label caption>
                          Cadastre novas etiquetas na administração de sistemas.
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>

                </q-select>
              </q-card-section>
            </q-card>
            <q-card
              class="bg-white q-mt-sm btn-rounded"
              style="width: 100%"
              bordered
              flat
              :key="ticketFocado.id + $uuid()"
            >
              <q-card-section class="text-bold q-pb-none">
                Carteira
                <q-separator />
              </q-card-section>
              <q-card-section class="q-pa-none">
                <q-select
                  square
                  borderless
                  :value="ticketFocado.contact.wallets"
                  multiple
                  :max-values="1"
                  :options="usuarios"
                  use-chips
                  option-value="id"
                  option-label="name"
                  emit-value
                  map-options
                  dropdown-icon="add"
                  @input="carteiraDefinida"
                >
                  <template v-slot:option="{ itemProps, itemEvents, opt, selected, toggleOption }">
                    <q-item
                      v-bind="itemProps"
                      v-on="itemEvents"
                    >
                      <q-item-section>
                        <q-item-label v-html="opt.name"></q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-checkbox
                          :value="selected"
                          @input="toggleOption(opt)"
                        />
                      </q-item-section>
                    </q-item>
                  </template>
                  <template v-slot:selected-item="{ opt }">
                    <q-chip
                      dense
                      square
                      color="white"
                      text-color="primary"
                      class="q-ma-xs row col-12 text-body1"
                    >
                      {{ opt.name }}
                    </q-chip>
                  </template>
                  <template v-slot:no-option="{ itemProps, itemEvents }">
                    <q-item
                      v-bind="itemProps"
                      v-on="itemEvents"
                    >
                      <q-item-section>
                        <q-item-label class="text-negative text-bold">
                          Ops... Sem carteiras disponíveis!!
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>

                </q-select>
              </q-card-section>
            </q-card>
            <q-card
              class="bg-white q-mt-sm btn-rounded"
              style="width: 100%"
              bordered
              flat
              :key="ticketFocado.id + $uuid()"
            >
              <q-card-section class="text-bold q-pb-none">
                Mensagens Agendadas
                <q-separator />
              </q-card-section>
              <q-card-section class="q-pa-none">
                <template v-if="ticketFocado.scheduledMessages">
                  <q-list>
                    <q-item
                      v-for="(message, idx) in ticketFocado.scheduledMessages"
                      :key="idx"
                      clickable
                    >
                      <q-item-section>
                        <q-item-label caption>
                          <b>Agendado para:</b> {{ $formatarData(message.scheduleDate, 'dd/MM/yyyy HH:mm') }}
                          <q-btn
                            flat
                            round
                            dense
                            icon="mdi-trash-can-outline"
                            class="absolute-top-right q-mr-sm"
                            size="sm"
                            @click="deletarMensagem(message)"
                          />
                        </q-item-label>
                        <q-item-label
                          caption
                          lines="2"
                        > <b>Msg:</b> {{ message.mediaName || message.body }}
                        </q-item-label>
                      </q-item-section>
                      <q-tooltip :delay="500">
                        <MensagemChat :mensagens="[message]" />
                      </q-tooltip>
                    </q-item>
                  </q-list>
                </template>
              </q-card-section>
            </q-card>
            <q-card
              class="bg-white q-mt-sm btn-rounded"
              style="width: 100%"
              bordered
              flat
              :key="ticketFocado.id + $uuid()"
            >
              <q-card-section class="text-bold q-pb-none">
                Outras Informações
              </q-card-section>
              <q-card-section class="q-pa-none">
                <template v-if="cIsExtraInfo">
                  <q-list>
                    <q-item
                      v-for="(info, idx) in ticketFocado.contact.extraInfo"
                      :key="idx"
                    >
                      <q-item-section>
                        <q-item-label>{{ info.value }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </template>

              </q-card-section>
            </q-card>
          </div>
        </q-scroll-area>
      </q-drawer>

      <ModalNovoTicket :modalNovoTicket.sync="modalNovoTicket" />
      <ContatoModal
        :contactId="selectedContactId"
        :modalContato.sync="modalContato"
        @contatoModal:contato-editado="contatoEditado"
      />

      <ModalUsuario
        :isProfile="true"
        :modalUsuario.sync="modalUsuario"
        :usuarioEdicao.sync="usuario"
      />

      <q-dialog
        v-model="exibirModalLogs"
        no-backdrop-dismiss
        full-height
        position="right"
        @hide="logsTicket = []"
      >
        <q-card style="width: 400px">
          <q-card-section :class="{ 'bg-grey-2': !$q.dark.isActive, 'bg-primary': $q.dark.isActive }">
            <div class="text-h6">Logs Ticket: {{ ticketFocado.id }}
              <q-btn
                icon="close"
                color="negative"
                flat
                class="bg-padrao float-right"
                round
                v-close-popup
              />
            </div>
          </q-card-section>
          <q-card-section class="">
            <q-scroll-area
              style="height: calc(100vh - 200px);"
              class="full-width"
            >
              <q-timeline
                color="black"
                style="width: 360px"
                class="q-pl-sm "
                :class="{ 'text-black': !$q.dark.isActive }"
              >
                <template v-for="(log, idx) in logsTicket">
                  <q-timeline-entry
                    :key="log && log.id || idx"
                    :subtitle="$formatarData(log.createdAt, 'dd/MM/yyyy HH:mm')"
                    :color="messagesLog[log.type] && messagesLog[log.type].color || ''"
                    :icon="messagesLog[log.type] && messagesLog[log.type].icon || ''"
                  >
                    <template v-slot:title>
                      <div
                        :class="{ 'text-white': $q.dark.isActive }"
                        style="width: calc(100% - 20px)"
                      >
                        <div class="row col text-bold text-body2"> {{ log.user && log.user.name || 'Bot' }}:</div>
                        <div class="row col"> {{ messagesLog[log.type] && messagesLog[log.type].message }}</div>
                      </div>
                    </template>
                  </q-timeline-entry>
                </template>
              </q-timeline>
            </q-scroll-area>
          </q-card-section>
        </q-card>
      </q-dialog>

    </q-layout>
    <audio ref="audioNotificationPlay">
      <source
        :src="alertSound"
        type="audio/mp3"
      >
    </audio>
  </div>
</template>

<script>
import ContatoModal from 'src/pages/contatos/ContatoModal'
import ItemTicket from './ItemTicket'
import { ConsultarLogsTicket, ConsultarTickets, DeletarMensagem } from 'src/service/tickets'
import { mapGetters } from 'vuex'
import mixinSockets from './mixinSockets'
import socketInitial from 'src/layouts/socketInitial'
import ModalNovoTicket from './ModalNovoTicket'
import { ListarFilas } from 'src/service/filas'
const UserQueues = JSON.parse(localStorage.getItem('queues'))
const profile = localStorage.getItem('profile')
const username = localStorage.getItem('username')
const usuario = JSON.parse(localStorage.getItem('usuario'))
import StatusWhatsapp from 'src/components/StatusWhatsapp'
import alertSound from 'src/assets/sound.mp3'
import { ListarWhatsapps } from 'src/service/sessoesWhatsapp'
import { debounce } from 'quasar'
import { format } from 'date-fns'
import ModalUsuario from 'src/pages/usuarios/ModalUsuario'
import { ListarConfiguracoes } from 'src/service/configuracoes'
import { ListarMensagensRapidas } from 'src/service/mensagensRapidas'
import { ListarEtiquetas } from 'src/service/etiquetas'
import { EditarEtiquetasContato, EditarCarteiraContato } from 'src/service/contatos'
import { RealizarLogout } from 'src/service/login'
import { ListarUsuarios } from 'src/service/user'
import MensagemChat from './MensagemChat.vue'
import { messagesLog } from '../../utils/constants'
export default {
  name: 'IndexAtendimento',

  mixins: [mixinSockets, socketInitial],
  components: {
    ItemTicket,
    ModalNovoTicket,
    StatusWhatsapp,
    ContatoModal,
    ModalUsuario,
    MensagemChat
  },
  data () {
    const query = this.$route.query
    const initialStatus = query.status ? [query.status] : ['open']
    return {
      messagesLog,
      configuracoes: [],
      debounce,
      alertSound,
      usuario,
      usuarios: [],
      username,
      modalUsuario: false,
      toolbarSearch: true,
      drawerTickets: true,
      drawerContact: true,
      loading: false,
      profile,
      modalNovoTicket: false,
      modalContato: false,
      selectedContactId: null,
      filterBusca: '',
      showDialog: false,
      atendimentos: [],
      countTickets: 0,
      searchTickets: '',
      pesquisaTickets: {
        searchParam: '',
        pageNumber: 1,
        status: initialStatus,
        showAll: false,
        count: null,
        queuesIds: [],
        withUnreadMessages: false,
        isNotAssignedUser: initialStatus.includes('pending'),
        includeNotQueueDefined: true
        // date: new Date(),
      },
      filas: [],
      etiquetas: [],
      mensagensRapidas: [],
      modalEtiquestas: false,
      exibirModalLogs: false,
      logsTicket: []
    }
  },
  watch: {
    searchTickets: {
      handler (val) {
        this.debounce(this.BuscarTicketFiltro(), 500)
      }
    },
    tickets: {
      handler (tickets) {
        this.scrollToBottom()
      },
      deep: true
    },
    $route: {
      handler (newRoute) {
        const newStatus = newRoute.query.status

        // Só atualiza o status se estivermos na rota de atendimento
        if (newRoute.name === 'atendimento') {
          if (newStatus) {
            this.pesquisaTickets.status = [newStatus]
          } else {
            // Se estamos na rota de atendimento mas sem status, usar 'open' como padrão
            this.pesquisaTickets.status = ['open']
          }
          this.BuscarTicketFiltro()
        }
      },
      immediate: true
    }
  },
  computed: {
    ...mapGetters([
      'tickets',
      'ticketFocado',
      'hasMore',
      'whatsapps'
    ]),
    cUserQueues () {
      // try {
      //   const filasUsuario = JSON.parse(UserQueues).map(q => {
      //     if (q.isActive) {
      //       return q.id
      //     }
      //   })
      //   return this.filas.filter(f => filasUsuario.includes(f.id)) || []
      // } catch (error) {
      //   return []
      // }
      return UserQueues
    },
    style () {
      return {
        height: this.$q.screen.height + 'px'
      }
    },
    cToolbarSearchHeigthAjust () {
      return this.toolbarSearch ? 58 : 0
    },
    cHeigVerticalTabs () {
      return `${50 + this.cToolbarSearchHeigthAjust}px`
    },
    cRouteContatos () {
      return this.$route.name === 'chat-contatos'
    },
    cFiltroSelecionado () {
      const { queuesIds, showAll, withUnreadMessages } = this.pesquisaTickets

      // Para status 'pending', sempre retorna que não há filtro selecionado (usa filtro fixo)
      if (this.pesquisaTickets.status && this.pesquisaTickets.status.includes('pending')) {
        return null
      }

      // Para outros status (incluindo 'open'), determina qual filtro está ativo
      if (showAll) return 'todos'
      if (queuesIds?.length) return 'fila'
      if (!showAll && !queuesIds?.length && !withUnreadMessages) return 'meus'

      return null
    },
    cIsExtraInfo () {
      return this.ticketFocado?.contact?.extraInfo?.length > 0
    }
  },
  methods: {

    toggleStatus (status) {
      // Substitui o array atual por um novo array contendo apenas o status selecionado
      this.pesquisaTickets.status = [status]
      this.debounce(this.BuscarTicketFiltro(), 700)
    },

    setFilterMode (filterMode) {
      // Resetar filtros
      this.pesquisaTickets.showAll = false
      this.pesquisaTickets.withUnreadMessages = false
      this.pesquisaTickets.isNotAssignedUser = false
      this.pesquisaTickets.queuesIds = []

      const currentStatus = this.pesquisaTickets.status

      // Para status 'pending', sempre aplicar filtro de tickets não atendidos
      if (currentStatus && currentStatus.includes('pending')) {
        this.pesquisaTickets.isNotAssignedUser = true
        this.pesquisaTickets.showAll = false
        this.pesquisaTickets.queuesIds = []
      } else {
        // Para outros status (incluindo 'open'), aplicar filtros baseado no modo selecionado
        if (filterMode === 'meus') {
          this.pesquisaTickets.showAll = false
          // Para 'open', meus atendimentos = atendimentos atribuídos a mim
        } else if (filterMode === 'fila') {
          this.pesquisaTickets.queuesIds = this.cUserQueues.map(q => q.id)
          // Para 'open', atendimentos da minha fila em andamento
        } else if (filterMode === 'todos') {
          // Para 'open', todos os atendimentos em andamento independente da fila
          // Não usar showAll para preservar o filtro de status
          this.pesquisaTickets.showAll = false
          this.pesquisaTickets.queuesIds = []
        }
      }

      this.debounce(this.BuscarTicketFiltro(), 700)
    },

    handlerNotifications (data) {
      const options = {
        body: `${data.body} - ${format(new Date(), 'HH:mm')}`,
        icon: data.ticket.contact.profilePicUrl,
        tag: data.ticket.id,
        renotify: true
      }

      const notification = new Notification(
        `Mensagem de ${data.ticket.contact.name}`,
        options
      )

      setTimeout(() => {
        notification.close()
      }, 10000)

      notification.onclick = e => {
        e.preventDefault()
        window.focus()
        this.$store.dispatch('AbrirChatMensagens', data.ticket)
        this.$router.push({ name: 'atendimento' })
        // history.push(`/tickets/${ticket.id}`);
      }

      this.$nextTick(() => {
        // utilizar refs do layout
        this.$refs.audioNotificationPlay.play()
      })
    },
    async listarConfiguracoes () {
      const { data } = await ListarConfiguracoes()
      localStorage.setItem('configuracoes', JSON.stringify(data))
    },
    onScroll (info) {
      if (info.verticalPercentage <= 0.85) return
      this.onLoadMore()
    },
    editContact (contactId) {
      this.selectedContactId = contactId
      this.modalContato = true
    },
    contatoEditado (contato) {
      this.$store.commit('UPDATE_TICKET_FOCADO_CONTACT', contato)
    },
    async consultarTickets (paramsInit = {}) {
      const params = {
        ...this.pesquisaTickets,
        ...paramsInit
      }
      try {
        const { data } = await ConsultarTickets(params)
        this.countTickets = data.count // count total de tickets no status
        this.$store.commit('LOAD_TICKETS', data.tickets)
        this.$store.commit('SET_HAS_MORE', data.hasMore)
      } catch (err) {
        this.$notificarErro('Algum problema', err)
        console.error(err)
      }
      // return () => clearTimeout(delayDebounceFn)
    },
    async BuscarTicketFiltro () {
      this.$store.commit('RESET_TICKETS')
      this.loading = true
      localStorage.setItem('filtrosAtendimento', JSON.stringify(this.pesquisaTickets))
      this.pesquisaTickets = {
        ...this.pesquisaTickets,
        pageNumber: 1
      }
      await this.consultarTickets(this.pesquisaTickets)
      this.loading = false
      this.$setConfigsUsuario({ isDark: this.$q.dark.isActive })
    },
    async onLoadMore () {
      if (this.tickets.length === 0 || !this.hasMore || this.loading) {
        return
      }
      try {
        this.loading = true
        this.pesquisaTickets.pageNumber++
        await this.consultarTickets()
        this.loading = false
      } catch (error) {
        this.loading = false
      }
    },
    async listarFilas () {
      const { data } = await ListarFilas()
      this.filas = data
      localStorage.setItem('filasCadastradas', JSON.stringify(data || []))
    },
    async listarWhatsapps () {
      const { data } = await ListarWhatsapps()
      this.$store.commit('LOAD_WHATSAPPS', data)
    },
    async listarEtiquetas () {
      const { data } = await ListarEtiquetas(true)
      this.etiquetas = data
    },
    async abrirModalUsuario () {
      // if (!usuario.id) {
      //   await this.dadosUsuario()
      // }
      // const { data } = await DadosUsuario(userId)
      // this.usuario = data
      this.modalUsuario = true
    },
    async efetuarLogout () {
      try {
        await RealizarLogout(usuario)
        localStorage.removeItem('token')
        localStorage.removeItem('username')
        localStorage.removeItem('profile')
        localStorage.removeItem('userId')
        localStorage.removeItem('queues')
        localStorage.removeItem('usuario')
        localStorage.removeItem('filtrosAtendimento')

        this.$router.go({ name: 'login', replace: true })
      } catch (error) {
        this.$notificarErro(
          'Não foi possível realizar logout',
          error
        )
      }
    },
    copyContent (content) {
      navigator.clipboard.writeText(content)
        .then(() => {
          // Copiado com sucesso
        })
        .catch((error) => {
          // Ocorreu um erro ao copiar
          console.error('Erro ao copiar o conteúdo: ', error)
        })
    },
    deletarMensagem (mensagem) {
      const data = { ...mensagem }
      this.$q.dialog({
        title: 'Atenção!! Deseja realmente deletar a mensagem? ',
        message: 'Mensagens antigas não serão apagadas no cliente.',
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
      }).onOk(() => {
        this.loading = true
        DeletarMensagem(data)
          .then(res => {
            this.loading = false
          })
          .catch(error => {
            this.loading = false
            console.error(error)
            this.$notificarErro('Não foi possível apagar a mensagem', error)
          })
      }).onCancel(() => {
      })
    },
    async tagSelecionada (tags) {
      const { data } = await EditarEtiquetasContato(this.ticketFocado.contact.id, [...tags])
      this.contatoEditado(data)
    },
    async carteiraDefinida (wallets) {
      const { data } = await EditarCarteiraContato(this.ticketFocado.contact.id, [...wallets])
      this.contatoEditado(data)
    },
    async listarUsuarios () {
      try {
        const { data } = await ListarUsuarios()
        this.usuarios = data.users
      } catch (error) {
        console.error(error)
        this.$notificarErro('Problema ao carregar usuários', error)
      }
    },
    setValueMenu () {
      this.drawerTickets = !this.drawerTickets
    },
    setValueMenuContact () {
      this.drawerContact = !this.drawerContact
    },
    async abrirModalLogs () {
      const { data } = await ConsultarLogsTicket({ ticketId: this.ticketFocado.id })
      this.logsTicket = data
      this.exibirModalLogs = true
    }
  },
  beforeMount () {
    this.listarFilas()
    this.listarEtiquetas()
    this.listarConfiguracoes()
    const filtros = JSON.parse(localStorage.getItem('filtrosAtendimento'))
    if (!filtros?.pageNumber) {
      localStorage.setItem('filtrosAtendimento', JSON.stringify(this.pesquisaTickets))
    }
  },
  async mounted () {
    this.$root.$on('infor-cabecalo-chat:acao-menu', this.setValueMenu)
    this.$root.$on('update-ticket:info-contato', this.setValueMenuContact)
    this.socketTicketList()

    // Carregar filtros do localStorage
    const filtrosLocalStorage = JSON.parse(localStorage.getItem('filtrosAtendimento'))
    if (filtrosLocalStorage) {
      this.pesquisaTickets = {
        ...filtrosLocalStorage,
        // Manter o status da query da rota se existir
        status: this.$route.query.status ? [this.$route.query.status] : filtrosLocalStorage.status
      }

      // Aplicar filtro de tickets não atendidos apenas para status 'pending'
      const currentStatus = this.pesquisaTickets.status
      if (currentStatus && currentStatus.includes('pending')) {
        this.pesquisaTickets.isNotAssignedUser = true
        this.pesquisaTickets.showAll = false
        this.pesquisaTickets.withUnreadMessages = false
        this.pesquisaTickets.queuesIds = []
      }
    }

    this.$root.$on('handlerNotifications', this.handlerNotifications)
    await this.listarWhatsapps()
    await this.consultarTickets()
    await this.listarUsuarios()
    const { data } = await ListarMensagensRapidas()
    this.mensagensRapidas = data
    if (!('Notification' in window)) {
    } else {
      Notification.requestPermission()
    }
    this.userProfile = localStorage.getItem('profile')
    // this.socketInitial()

    // se existir ticket na url, abrir o ticket.
    if (this.$route?.params?.ticketId) {
      const ticketId = this.$route?.params?.ticketId
      if (ticketId && this.tickets.length > 0) {
        const ticket = this.tickets.find(t => t.id === +ticketId)
        if (!ticket) return
        // caso esteja em um tamanho mobile, fechar a drawer dos contatos
        if (this.$q.screen.lt.md && ticket.status !== 'pending') {
          this.$root.$emit('infor-cabecalo-chat:acao-menu')
        }
        this.$store.commit('SET_HAS_MORE', true)
        this.$store.dispatch('AbrirChatMensagens', ticket)
      }
    } else if (this.$route.name !== 'chat-empty' && this.$route.name !== 'atendimento') {
      this.$router.push({ name: 'chat-empty', replace: true })
    }
  },
  destroyed () {
    this.$root.$off('handlerNotifications', this.handlerNotifications)
    this.$root.$off('infor-cabecalo-chat:acao-menu', this.setValueMenu)
    this.$root.$on('update-ticket:info-contato', this.setValueMenuContact)
    // this.socketDisconnect()
    this.$store.commit('TICKET_FOCADO', {})
  }
}
</script>

<style lang="scss" scoped>
.WAL {
  width: 100%;
  height: 100vh;
  background: linear-gradient(145deg, #f5f5f5 0%, #e0e0e0 100%);

  &__layout {
    width: 100%;
    height: 100%;
  }
}

.q-drawer {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 0 16px 16px 0;

  .q-toolbar {
    background: transparent;
  }

  .q-btn {
    border-radius: 8px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
  }
}

.q-scroll-area {
  background: transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.2);
    border-radius: 4px;
  }
}

.btn-rounded {
  border-radius: 50%;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dark-mode {
  .WAL {
    background: linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 100%);
  }

  .q-drawer {
    background: rgba(33, 33, 33, 0.95);
  }
}

.filter-btn {
  border-radius: 4px !important;
}

.custom-search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.custom-search-input {
  width: 100%;
  padding: 6px 10px;
  padding-right: 40px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  background-color: #ffffff;
  font-size: 16px;
  outline: none;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.custom-search-input:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.custom-search-input:focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.custom-search-input::placeholder {
  color: #6c757d;
  font-weight: 400;
}

.search-icon {
  position: absolute;
  right: 12px;
  color: #6c757d;
  pointer-events: none;
}

/* Modo escuro */
.body--dark .custom-search-input {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.28);
  color: #ffffff;
}

.body--dark .custom-search-input:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.body--dark .custom-search-input:focus {
  border-color: #90caf9;
  background-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 0 2px rgba(144, 202, 249, 0.3);
}

.body--dark .custom-search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.body--dark .search-icon {
  color: rgba(255, 255, 255, 0.6);
}

/* Botão de contatos */
.contacts-btn {
  background-color: #f5f5f5;
  color: #1976d2;
  border: 1px solid rgba(25, 118, 210, 0.2);
  transition: all 0.3s ease;
  width: 40px;
  height: 40px;
}

.contacts-btn:hover {
  background-color: #1976d2;
  color: white;
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(25, 118, 210, 0.3);
}

.contacts-btn:active {
  transform: scale(0.95);
}

/* Modo escuro para o botão de contatos */
.body--dark .contacts-btn {
  background-color: rgba(255, 255, 255, 0.1);
  color: #90caf9;
  border-color: rgba(144, 202, 249, 0.3);
}

.body--dark .contacts-btn:hover {
  background-color: #90caf9;
  color: #121212;
}
</style>
