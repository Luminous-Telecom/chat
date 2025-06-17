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
        content-class="full-width"
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
        <q-toolbar class="bg-white text-primary q-pl-md q-pr-md q-pt-sm q-pb-sm justify-center" v-if="(pesquisaTickets.status && pesquisaTickets.status.includes('pending')) || $route.query.status === 'pending'">
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
            v-for="ticket in tickets"
            :key="`ticket-${ticket.id}`"
            :ticket="ticket"
            :filas="filas"
            :buscaTicket="false"
            @debug="logTicketDebug"
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
          :key="`router-${ticketFocado.id || 'empty'}`"
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

        <q-separator />
        <q-scroll-area style="height: calc(100vh - 60px)">
          <div class="contact-data-container">
            <!-- Espaçamento antes das informações do contato -->
            <div class="q-mt-md"></div>
            <q-card class="contact-info-card">
              <q-card-section class="contact-profile-section">
                <div class="contact-profile-wrapper">
                  <div class="contact-avatar-container">
                    <q-avatar class="contact-profile-avatar">
                       <q-icon
                         name="mdi-account"
                         style="width: 50px; height: 50px"
                         size="2.5em"
                         color="grey-4"
                         v-if="!ticketFocado.contact.profilePicUrl"
                       />
                       <q-img
                         :src="ticketFocado.contact.profilePicUrl"
                         style="width: 50px; height: 50px"
                       >
                         <template v-slot:error>
                           <q-icon
                             name="mdi-account"
                             size="1.5em"
                             color="grey-4"
                           />
                         </template>
                       </q-img>
                     </q-avatar>
                  </div>
                  <div class="contact-info-details">
                    <div class="contact-name">
                      {{ ticketFocado.contact.name || '' }}
                    </div>
                    <div
                      class="contact-number"
                      id="number"
                      @click="copyContent(ticketFocado.contact.number || '')"
                    >
                      <q-icon name="mdi-whatsapp" size="16px" class="q-mr-xs" />
                      {{ ticketFocado.contact.number || '' }}
                      <q-tooltip content-class="modern-tooltip">Clique para copiar</q-tooltip>
                    </div>
                  </div>
                </div>
              </q-card-section>

              <q-card-section class="contact-details-section">
                <div class="contact-details-list">
                  <!-- Informações de atendimento -->
                  <div v-if="ticketFocado.createdAt" class="contact-detail-item">
                    <q-icon name="mdi-clock-outline" class="detail-icon" />
                    <span class="detail-text">
                      Atendimento aberto em {{ formatDate(ticketFocado.createdAt) }}
                    </span>
                  </div>

                  <div v-if="getTempoAtendimento()" class="contact-detail-item">
                    <q-icon name="mdi-timer-outline" class="detail-icon" />
                    <span class="detail-text">
                      Tempo total em atendimento: {{ getTempoAtendimento() }}
                    </span>
                  </div>

                  <div v-if="getTempoFila()" class="contact-detail-item">
                    <q-icon name="mdi-account-clock" class="detail-icon" />
                    <span class="detail-text">
                      Nesta fila há {{ getTempoFila() }}
                    </span>
                  </div>

                  <div v-if="ticketFocado.whatsapp" class="contact-detail-item">
                    <q-icon :name="getChannelIcon(ticketFocado.whatsapp)" class="detail-icon" />
                    <span class="detail-text">
                      {{ getChannelDisplayName(ticketFocado.whatsapp) }}
                    </span>
                  </div>

                  <div v-if="ticketFocado.protocol" class="contact-detail-item clickable-protocol" @click="copyContent(ticketFocado.protocol)">
                    <q-icon name="mdi-file-document-outline" class="detail-icon" />
                    <span class="detail-text">
                      Protocolo: {{ ticketFocado.protocol }}
                    </span>
                    <q-tooltip content-class="modern-tooltip">Clique para copiar</q-tooltip>
                  </div>

                  <!-- Informações de contato -->
                  <div v-if="ticketFocado.contact.email" class="contact-detail-item">
                    <q-icon name="mdi-email" class="detail-icon" />
                    <span class="detail-text">
                      {{ ticketFocado.contact.email }}
                    </span>
                  </div>

                  <div v-if="ticketFocado.contact.telegramId" class="contact-detail-item">
                    <q-icon name="mdi-telegram" class="detail-icon" />
                    <span class="detail-text">
                      {{ ticketFocado.contact.telegramId }}
                    </span>
                  </div>

                  <div v-if="ticketFocado.contact.messengerId" class="contact-detail-item">
                    <q-icon name="mdi-facebook-messenger" class="detail-icon" />
                    <span class="detail-text">
                      {{ ticketFocado.contact.messengerId }}
                    </span>
                  </div>

                  <div v-if="ticketFocado.contact.instagramPK" class="contact-detail-item">
                    <q-icon name="mdi-instagram" class="detail-icon" />
                    <span class="detail-text">
                      {{ ticketFocado.contact.pushname }}
                    </span>
                  </div>
                </div>
              </q-card-section>
            </q-card>

            <!-- Espaçamento antes do botão logs -->
            <div class="q-mt-md"></div>
            <q-card class="action-card">
              <q-card-section class="action-section">
                <q-btn
                  flat
                  class="logs-btn"
                  label="Logs"
                  @click="abrirModalLogs"
                />
              </q-card-section>
            </q-card>

            <!-- Espaçamento entre botões -->
            <div class="q-mt-md"></div>
            <!-- Tags selecionadas -->
            <div v-if="ticketFocado.contact.tags && ticketFocado.contact.tags.length > 0" class="selected-tags-container q-mb-sm">
              <q-chip
                v-for="tag in ticketFocado.contact.tags"
                :key="tag.uniqueKey || `tag-${tag.id || tag}`"
                dense
                removable
                :style="{ backgroundColor: getTagColor(tag), color: getContrastColor(getTagColor(tag)) }"
                class="q-ma-xs elegant-chip"
                @remove="removeTagById(tag.id || tag)"
              >
                {{ getTagName(tag) }}
              </q-chip>
            </div>

            <!-- Botão para adicionar tags -->
            <q-btn
              flat
              dense
              class="custom-tag-selector"
              style="width: 100%"
              :label="ticketFocado.contact.tags && ticketFocado.contact.tags.length > 0 ? 'Adicionar mais etiquetas' : 'Selecionar etiquetas'"
              icon="mdi-tag-plus"
              color="primary"
            >
              <q-menu
                fit
                class="tag-menu"
                max-height="300px"
              >
                <q-list style="min-width: 250px">
                  <q-item-label header class="text-primary text-weight-bold">
                  </q-item-label>
                  <q-separator />

                  <q-item
                    v-for="etiqueta in etiquetas"
                    :key="etiqueta.id"
                    clickable
                    v-close-popup
                    @click="toggleTag(etiqueta)"
                    class="tag-option-item"
                  >
                    <q-item-section>
                      <q-item-label class="text-weight-medium">
                        <q-chip
                          dense
                          :style="{ backgroundColor: etiqueta.color, color: getContrastColor(etiqueta.color) }"
                          class="q-mr-sm"
                          size="sm"
                        >
                          <q-icon name="mdi-tag" size="12px" />
                        </q-chip>
                        {{ etiqueta.tag }}
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-checkbox
                        :value="isTagSelected(etiqueta.id)"
                        :color="etiqueta.color"
                        @click.stop="toggleTag(etiqueta)"
                      />
                    </q-item-section>
                  </q-item>

                  <q-item v-if="etiquetas.length === 0" class="text-grey-6">
                    <q-item-section>
                      <q-item-label class="text-center">
                        <q-icon name="mdi-tag-off" size="24px" class="q-mb-sm" />
                        <div>Ops... Sem etiquetas criadas!</div>
                        <div class="text-caption">Cadastre novas etiquetas na administração de sistemas.</div>
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
            <!-- Espaçamento entre botões -->
            <div class="q-mt-md"></div>
            <!-- Carteiras selecionadas -->
            <div v-if="ticketFocado.contact.wallets && ticketFocado.contact.wallets.length > 0" class="selected-wallets-container q-mb-sm">
              <q-chip
                v-for="walletId in ticketFocado.contact.wallets"
                :key="walletId.uniqueKey || `wallet-${walletId.id}`"
                dense
                removable
                color="primary"
                text-color="white"
                class="q-ma-xs elegant-chip"
                @remove="removeWalletById(walletId.id)"
              >
                <q-icon
                  name="person"
                  size="14px"
                  class="q-mr-xs"
                  style="color: white"
                />
                {{ getWalletName(walletId.id) }}
              </q-chip>
            </div>

            <!-- Botão para adicionar carteiras -->
            <q-btn
              flat
              dense
              class="custom-wallet-selector"
              style="width: 100%"
              :label="ticketFocado.contact.wallets && ticketFocado.contact.wallets.length > 0 ? 'Alterar carteira' : 'Selecionar carteira'"
              icon="person"
              color="primary"
            >
              <q-menu
                fit
                class="wallet-menu"
                max-height="300px"
              >
                <q-list style="min-width: 250px">
                  <q-item-label header class="text-primary text-weight-bold">
                  </q-item-label>
                  <q-separator />

                  <q-item
                    v-for="wallet in usuarios"
                    :key="wallet.id"
                    clickable
                    v-close-popup
                    @click="toggleWallet(wallet.id)"
                    class="wallet-option-item"
                  >
                    <q-item-section>
                      <q-item-label class="text-weight-medium">{{ wallet.name }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-checkbox
                        :value="isWalletSelected(wallet.id)"
                        color="primary"
                        @click.stop="toggleWallet(wallet.id)"
                      />
                    </q-item-section>
                  </q-item>

                  <q-item v-if="usuarios.length === 0" class="text-grey-6">
                    <q-item-section>
                      <q-item-label class="text-center">
                        <q-icon name="person_off" size="24px" class="q-mb-sm" />
                        <div>Ops... Sem carteiras disponíveis!</div>
                        <div class="text-caption">Cadastre novas carteiras na administração de sistemas.</div>
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>

            </q-btn>
            <!-- Mensagens Agendadas -->
            <div class="scheduled-messages-container q-mb-md q-mt-md">
              <div class="row items-center q-mb-sm">
                <div class="text-body1">Mensagens Agendadas</div>
                <q-space />
                <q-btn
                  flat
                  dense
                  round
                  color="primary"
                  icon="mdi-eye"
                  @click="abrirModalListarMensagensAgendadas"
                  class="q-mr-sm"
                >
                  <q-tooltip>Ver todas</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  color="primary"
                  icon="mdi-plus"
                  @click="abrirModalAgendarMensagem"
                >
                  <q-tooltip>Nova Mensagem Agendada</q-tooltip>
                </q-btn>
              </div>
              <q-scroll-area style="height: 200px">
                <q-list>
                  <q-item v-for="(message, idx) in ticketFocado.scheduledMessages.slice(0, 3)" :key="message.uniqueKey || `scheduled-message-${message.id || idx}`" class="q-mb-sm">
                    <q-item-section>
                      <q-item-label caption>{{ $formatarData(message.scheduleDate, 'dd/MM/yyyy HH:mm') }}</q-item-label>
                      <q-item-label>{{ message.mediaName || message.body }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-btn
                        flat
                        round
                        dense
                        icon="mdi-trash-can-outline"
                        size="sm"
                        color="negative"
                        @click="deletarMensagem(message)"
                      >
                        <q-tooltip>Excluir</q-tooltip>
                      </q-btn>
                    </q-item-section>
                    <q-tooltip :delay="500">
                      <MensagemChat :mensagens="[message]" />
                    </q-tooltip>
                  </q-item>
                  <q-item v-if="ticketFocado.scheduledMessages.length > 3" class="text-center">
                    <q-item-section>
                      <q-btn
                        flat
                        dense
                        color="primary"
                        label="Ver mais..."
                        @click="abrirModalListarMensagensAgendadas"
                      />
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-scroll-area>
            </div>
            <!-- Observações -->
            <div class="observations-container q-mb-md">
              <div class="row items-center q-mb-sm">
                <div class="text-body1">Observações</div>
                <q-space />
                <q-btn
                  flat
                  dense
                  round
                  color="primary"
                  icon="mdi-eye"
                  @click="abrirModalListarObservacoes"
                  class="q-mr-sm"
                >
                  <q-tooltip>Ver todas</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  color="primary"
                  icon="mdi-plus"
                  @click="abrirModalObservacao"
                >
                  <q-tooltip>Nova Observação</q-tooltip>
                </q-btn>
              </div>
              <q-scroll-area style="height: 200px">
                <q-list>
                  <q-item v-for="obs in observacoes.slice(0, 3)" :key="obs.id" class="q-mb-sm">
                    <q-item-section>
                      <q-item-label caption>{{ $formatarData(obs.createdAt, 'dd/MM/yyyy HH:mm') }} - {{ obs.user?.name }}</q-item-label>
                      <q-item-label>{{ obs.texto }}</q-item-label>
                      <q-item-label v-if="obs.anexo" caption>
                        <q-btn
                          flat
                          dense
                          size="sm"
                          icon="mdi-paperclip"
                          :label="obs.anexo"
                          @click="abrirAnexo(obs.anexo)"
                        />
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item v-if="observacoes.length > 3" class="text-center">
                    <q-item-section>
                      <q-btn
                        flat
                        dense
                        color="primary"
                        label="Ver mais..."
                        @click="abrirModalListarObservacoes"
                      />
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-scroll-area>
            </div>
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
                <template>
                  <q-timeline-entry
                    v-for="(log, idx) in logsTicket"
                    :key="log.id ? `log-${log.id}` : `idx-${idx}`"
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

      <ModalObservacao
        :value.sync="modalObservacao"
        :ticket-id="ticketFocado.id || null"
        @observacao-salva="handleObservacaoSalva"
      />

      <ModalListarObservacoes
        :value.sync="modalListarObservacoes"
        :ticket-id="ticketFocado.id || null"
      />

      <ModalListarMensagensAgendadas
        :value.sync="modalListarMensagensAgendadas"
        :ticket-id="ticketFocado.id || null"
        :mensagens-agendadas="ticketFocado.scheduledMessages || []"
        @nova-mensagem-agendada="abrirModalAgendarMensagem"
      />

      <ModalAgendarMensagem
        :value.sync="modalAgendarMensagem"
        :ticket-id="ticketFocado.id || null"
        :mensagens-rapidas="mensagensRapidas"
        @mensagem-agendada="handleMensagemAgendada"
      />

    </q-layout>
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
import ModalObservacao from './ModalObservacao.vue'
import { ListarObservacoes } from '../../service/observacoes'
import ModalListarObservacoes from './ModalListarObservacoes.vue'
import ModalListarMensagensAgendadas from './ModalListarMensagensAgendadas.vue'
import ModalAgendarMensagem from './ModalAgendarMensagem.vue'
import { tocarSomNotificacao, solicitarPermissaoAudio, inicializarServicoAudio, temPermissaoAudio } from 'src/helpers/helpersNotifications'

export default {
  name: 'IndexAtendimento',

  mixins: [mixinSockets, socketInitial],
  components: {
    ItemTicket,
    ModalNovoTicket,
    StatusWhatsapp,
    ContatoModal,
    ModalUsuario,
    MensagemChat,
    ModalObservacao,
    ModalListarObservacoes,
    ModalListarMensagensAgendadas,
    ModalAgendarMensagem
  },
  data () {
    const query = this.$route.query
    // Para página de tickets não atendidos, usar apenas 'pending'
    let initialStatus
    if (query.status === 'pending') {
      initialStatus = ['pending']
    } else {
      initialStatus = query.status ? [query.status] : ['open']
    }

    // Garantir que seja sempre um array simples
    initialStatus = initialStatus.filter(s => typeof s === 'string')

    return {
      messagesLog,
      configuracoes: [],
      debounce,
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
      mensagensRapidas: [],
      modalEtiquestas: false,
      exibirModalLogs: false,
      logsTicket: [],
      modalObservacao: false,
      modalListarObservacoes: false,
      modalListarMensagensAgendadas: false,
      modalAgendarMensagem: false,
      observacoes: [],
      pesquisaTickets: {
        searchParam: '',
        pageNumber: 1,
        status: initialStatus,
        showAll: false,
        count: null,
        queuesIds: [],
        withUnreadMessages: false,
        isNotAssignedUser: false, // Sempre false inicialmente
        includeNotQueueDefined: true
      },
      filas: [],
      etiquetas: []
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

      // Para status 'pending' ou página de tickets não atendidos, sempre retorna que não há filtro selecionado (usa filtro fixo)
      if ((this.pesquisaTickets.status && this.pesquisaTickets.status.includes('pending')) || this.$route.query.status === 'pending') {
        return null
      }

      // Para outros status (incluindo 'open'), determina qual filtro está ativo
      if (showAll) return 'todos'
      if (queuesIds?.length) return 'fila'
      if (!showAll && !queuesIds?.length && !withUnreadMessages) return 'meus'

      return null
    }
  },
  methods: {
    // Método para solicitar permissão de áudio
    async requestAudioPermission () {
      return await solicitarPermissaoAudio()
    },

    // Método para tocar áudio de notificação
    async playNotificationSound () {
      await tocarSomNotificacao()
    },

    logTicketDebug (ticketData) {
    },
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

      // Para status que inclui 'pending' (tickets não atendidos), sempre aplicar filtro de tickets não atribuídos
      if (currentStatus && (currentStatus.includes('pending') || this.$route.query.status === 'pending')) {
        // Para tickets pendentes, mostrar todos os tickets pendentes (não apenas os não atribuídos)
        this.pesquisaTickets.isNotAssignedUser = false
        this.pesquisaTickets.showAll = true // Permitir ver todos os tickets pendentes
        this.pesquisaTickets.withUnreadMessages = false
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
      // Verificar se deve mostrar notificação do navegador
      // Verificar se data tem a estrutura esperada
      if (!data) {
        console.warn('Dados de notificação vazios:', data)
        return
      }

      // A estrutura real dos dados é diferente - data é a própria mensagem
      const message = data
      const ticket = data.ticket
      const contact = ticket?.contact

      // Verificar se temos os dados necessários
      if (!message || !ticket || !contact) {
        console.warn('Estrutura de dados incompleta para notificação:', { message, ticket, contact })
        return
      }

      // Só mostrar notificação e tocar som se não for do usuário atual e não estiver lida
      if (message.fromMe || message.read) {
        return
      }

      // Tocar áudio de notificação para cada mensagem recebida de outro usuário
      this.playNotificationSound()

      // Verificar se notificações são suportadas
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return
      }

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

      setTimeout(() => {
        notification.close()
      }, 10000)

      notification.onclick = e => {
        e.preventDefault()
        window.focus()
        this.$store.dispatch('AbrirChatMensagens', ticket)
        this.$router.push({ name: 'atendimento' })
        // history.push(`/tickets/${ticket.id}`);
      }
    },
    async listarConfiguracoes () {
      const { data } = await ListarConfiguracoes()
      localStorage.setItem('configuracoes', JSON.stringify(data))
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

        this.$router.push({ name: 'login', replace: true })
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
          this.$q.notify({
            type: 'positive',
            message: 'Conteúdo copiado para a área de transferência',
            position: 'top',
            timeout: 2000
          })
        })
        .catch((error) => {
          console.error('Erro ao copiar o conteúdo: ', error)
          this.$q.notify({
            type: 'negative',
            message: 'Erro ao copiar conteúdo',
            position: 'top',
            timeout: 2000
          })
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
    async removeTag (tagToRemove) {
      const currentTags = this.ticketFocado.contact.tags || []
      const updatedTags = currentTags.filter(tag => tag.id !== tagToRemove.id)
      const { data } = await EditarEtiquetasContato(this.ticketFocado.contact.id, updatedTags.map(tag => tag.id))
      this.contatoEditado(data)
    },
    async toggleTag (etiqueta) {
      const currentTags = this.ticketFocado.contact.tags || []
      const tagIndex = currentTags.findIndex(tag => tag.id === etiqueta.id)

      let newTagIds
      if (tagIndex > -1) {
        // Remove tag se já estiver selecionada
        newTagIds = currentTags.filter(tag => tag.id !== etiqueta.id).map(tag => tag.id)
      } else {
        // Adiciona tag se não estiver selecionada
        newTagIds = [...currentTags.map(tag => tag.id), etiqueta.id]
      }

      const { data } = await EditarEtiquetasContato(this.ticketFocado.contact.id, newTagIds)
      this.contatoEditado(data)
    },
    isTagSelected (tagId) {
      return this.ticketFocado.contact.tags && this.ticketFocado.contact.tags.some(tag => tag.id === tagId)
    },
    getTagColor (tag) {
      const tagId = typeof tag === 'object' ? tag.id : tag
      const etiqueta = this.etiquetas.find(e => e.id === tagId)
      return etiqueta ? etiqueta.color : 'primary'
    },
    getTagName (tag) {
      const tagId = typeof tag === 'object' ? tag.id : tag
      const etiqueta = this.etiquetas.find(e => e.id === tagId)
      return etiqueta ? etiqueta.tag : 'Tag não encontrada'
    },
    async removeTagById (tagId) {
      const currentTags = this.ticketFocado.contact.tags || []
      const newTagIds = currentTags.filter(tag => tag.id !== tagId).map(tag => tag.id)
      const { data } = await EditarEtiquetasContato(this.ticketFocado.contact.id, newTagIds)
      this.contatoEditado(data)
    },
    async carteiraDefinida (wallets) {
      const { data } = await EditarCarteiraContato(this.ticketFocado.contact.id, [...wallets])
      this.contatoEditado(data)
    },
    async toggleWallet (walletId) {
      const currentWallets = this.ticketFocado.contact.wallets || []
      let newWalletIds

      if (currentWallets.includes(walletId)) {
        // Remove carteira se já estiver selecionada
        newWalletIds = currentWallets.filter(id => id !== walletId)
      } else {
        // Como carteira tem max-values="1", substitui a carteira atual
        newWalletIds = [walletId]
      }

      const { data } = await EditarCarteiraContato(this.ticketFocado.contact.id, newWalletIds)
      this.contatoEditado(data)
    },
    isWalletSelected (walletId) {
      return this.ticketFocado.contact.wallets && this.ticketFocado.contact.wallets.includes(walletId)
    },
    getWalletName (walletId) {
      const wallet = this.usuarios.find(user => user.id === walletId)
      return wallet ? wallet.name : 'Carteira não encontrada'
    },
    async removeWalletById (walletId) {
      const currentWallets = this.ticketFocado.contact.wallets || []
      const newWalletIds = currentWallets.filter(id => id !== walletId)
      const { data } = await EditarCarteiraContato(this.ticketFocado.contact.id, newWalletIds)
      this.contatoEditado(data)
    },
    async carregarObservacoes () {
      if (!this.ticketFocado?.id) return

      try {
        this.observacoes = await ListarObservacoes(this.ticketFocado.id)
      } catch (error) {
        console.error('Erro ao carregar observações:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao carregar observações',
          position: 'top'
        })
      }
    },
    async handleObservacaoSalva (observacao) {
      try {
        await this.carregarObservacoes()
      } catch (error) {
        console.error('Erro ao atualizar observações:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao atualizar observações',
          position: 'top'
        })
      }
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
    },
    formatDate (dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
    },
    getTempoAtendimento () {
      if (!this.ticketFocado?.createdAt) return ''
      const inicio = new Date(this.ticketFocado.createdAt)
      const agora = new Date()
      const diffMs = agora - inicio
      const diffMinutes = Math.floor(diffMs / (1000 * 60))

      if (diffMinutes < 60) {
        return `${diffMinutes} minutos`
      } else {
        const hours = Math.floor(diffMinutes / 60)
        const minutes = diffMinutes % 60
        return `${hours}h ${minutes}min`
      }
    },
    getChannelIcon (whatsapp) {
      if (!whatsapp) return 'mdi-message'

      const type = whatsapp.type?.toLowerCase()
      const name = whatsapp.name?.toLowerCase()

      if (type === 'whatsapp' || name?.includes('whatsapp')) {
        return 'mdi-whatsapp'
      } else if (type === 'telegram' || name?.includes('telegram')) {
        return 'mdi-telegram'
      } else if (type === 'messenger' || name?.includes('messenger')) {
        return 'mdi-facebook-messenger'
      } else if (type === 'instagram' || name?.includes('instagram')) {
        return 'mdi-instagram'
      } else if (type === 'cloud' || name?.includes('cloud')) {
        return 'mdi-cloud'
      } else {
        return 'mdi-message'
      }
    },
    getChannelDisplayName (whatsapp) {
      if (!whatsapp) return 'Canal não identificado'

      const name = whatsapp.name || 'Canal'
      const type = whatsapp.type || ''

      // Se é do tipo Cloud, mostrar informações específicas
      if (type?.toLowerCase() === 'cloud' || name?.toLowerCase().includes('cloud')) {
        return `${name} (WhatsApp Cloud)`
      }

      // Se é WhatsApp Business API
      if (type?.toLowerCase() === 'whatsapp' || name?.toLowerCase().includes('whatsapp')) {
        if (name?.toLowerCase().includes('oficial')) {
          return `${name} (WhatsApp)`
        }
        return `${name} (WhatsApp Business)`
      }

      // Detectar outros tipos de canal pelo nome
      if (name?.toLowerCase().includes('telegram')) {
        return `${name} (Telegram)`
      }
      if (name?.toLowerCase().includes('instagram')) {
        return `${name} (Instagram)`
      }
      if (name?.toLowerCase().includes('messenger')) {
        return `${name} (Messenger)`
      }
      if (name?.toLowerCase().includes('facebook')) {
        return `${name} (Facebook)`
      }

      // Para outros tipos de canal com type definido
      if (type && type !== name) {
        return `${name} (${type})`
      }

      // Se não conseguir identificar o tipo, assumir WhatsApp como padrão
      return `${name} (WhatsApp)`
    },
    getTempoFila () {
      if (!this.ticketFocado?.updatedAt) return ''
      const ultimaAtualizacao = new Date(this.ticketFocado.updatedAt)
      const agora = new Date()
      const diffMs = agora - ultimaAtualizacao
      const diffMinutes = Math.floor(diffMs / (1000 * 60))

      if (diffMinutes < 60) {
        return `${diffMinutes} minutos`
      } else {
        const hours = Math.floor(diffMinutes / 60)
        const minutes = diffMinutes % 60
        return `${hours}h ${minutes}min`
      }
    },
    getContrastColor (hexcolor) {
      // Remove o # se existir
      hexcolor = hexcolor.replace('#', '')

      // Converte para RGB
      const r = parseInt(hexcolor.substr(0, 2), 16)
      const g = parseInt(hexcolor.substr(2, 2), 16)
      const b = parseInt(hexcolor.substr(4, 2), 16)

      // Calcula o brilho usando a fórmula YIQ
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000

      // Retorna branco para cores escuras e preto para cores claras
      return (yiq >= 128) ? '#000000' : '#ffffff'
    },
    abrirModalObservacao () {
      if (!this.ticketFocado?.id) {
        this.$q.notify({
          type: 'warning',
          message: 'Selecione um ticket para adicionar uma observação',
          position: 'top'
        })
        return
      }
      this.modalObservacao = true
    },
    abrirModalListarObservacoes () {
      if (!this.ticketFocado?.id) {
        this.$q.notify({
          type: 'warning',
          message: 'Selecione um ticket para ver as observações',
          position: 'top'
        })
        return
      }
      this.modalListarObservacoes = true
    },
    abrirModalListarMensagensAgendadas () {
      if (!this.ticketFocado?.id) {
        this.$q.notify({
          type: 'warning',
          message: 'Selecione um ticket para ver as mensagens agendadas',
          position: 'top'
        })
        return
      }
      this.modalListarMensagensAgendadas = true
    },
    abrirModalAgendarMensagem () {
      if (!this.ticketFocado?.id) {
        this.$q.notify({
          type: 'warning',
          message: 'Selecione um ticket para agendar uma mensagem',
          position: 'top'
        })
        return
      }
      this.modalAgendarMensagem = true
    },
    handleMensagemAgendada (dadosMensagem) {
      this.modalAgendarMensagem = false
      // Aqui você pode adicionar lógica para atualizar a lista de mensagens agendadas
      // Por exemplo, recarregar o ticket ou fazer uma nova consulta
    },
    abrirAnexo (anexo) {
      const url = `${process.env.VUE_URL_API}/public/sent/${anexo}`
      window.open(url, '_blank')
    },
    async consultarTickets (paramsInit = {}) {
      const params = {
        ...this.pesquisaTickets,
        ...paramsInit
      }

      // Garantir que status seja sempre um array simples
      if (params.status && Array.isArray(params.status)) {
        params.status = params.status.filter(s => typeof s === 'string')
      }

      try {
        const { data } = await ConsultarTickets(params)
        this.countTickets = data.count // count total de tickets no status
        this.$store.commit('LOAD_TICKETS', {
          tickets: data.tickets,
          filters: this.pesquisaTickets
        })
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
    // Método para carregar o áudio
    loadAudio () {
      if (this.$refs.audioNotificationPlay) {
        const audio = this.$refs.audioNotificationPlay
        audio.volume = 0.7 // Definir volume para 70%
        audio.preload = 'auto' // Carregar automaticamente
      }
    },
    markFirstLoadComplete () {
      // Add any additional logic you want to execute when first load is complete
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
    this.$root.$on('trocar-para-meus-atendimentos', () => {
      this.pesquisaTickets.status = ['open']
      this.setFilterMode('meus')
    })
    this.$root.$on('infor-cabecalo-chat:acao-menu', this.setValueMenu)
    this.$root.$on('update-ticket:info-contato', this.setValueMenuContact)
    this.socketTicketList()

    // Inicializar o serviço de áudio (sem tocar som)
    inicializarServicoAudio()

    // Marcar primeira carga como concluída após 3 segundos
    setTimeout(() => {
      this.markFirstLoadComplete()
    }, 3000)

    // Adicionar evento de clique para solicitar permissão de áudio apenas quando necessário
    document.addEventListener('click', async () => {
      // Só solicitar permissão se ainda não tiver
      if (!temPermissaoAudio()) {
        await this.requestAudioPermission()
      }
    }, { once: true })

    // Carregar filtros do localStorage
    const filtrosLocalStorage = JSON.parse(localStorage.getItem('filtrosAtendimento'))
    if (filtrosLocalStorage) {
      // Determinar o status correto
      let statusToUse
      if (this.$route.query.status === 'pending') {
        statusToUse = ['pending']
      } else if (this.$route.query.status) {
        statusToUse = [this.$route.query.status]
      } else {
        statusToUse = filtrosLocalStorage.status || ['open']
      }

      // Garantir que seja sempre um array simples
      statusToUse = statusToUse.filter(s => typeof s === 'string')

      this.pesquisaTickets = {
        ...filtrosLocalStorage,
        status: statusToUse
      }

      // Aplicar filtro de tickets não atendidos para status 'pending' ou quando vier da rota de tickets não atendidos
      const currentStatus = this.pesquisaTickets.status
      if ((currentStatus && currentStatus.includes('pending')) || this.$route.query.status === 'pending') {
        // Para tickets pendentes, mostrar todos os tickets pendentes (não apenas os não atribuídos)
        this.pesquisaTickets.isNotAssignedUser = false
        this.pesquisaTickets.showAll = true // Permitir ver todos os tickets pendentes
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
    // Notification permission will be requested when needed
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
            this.pesquisaTickets.status = [newStatus].filter(s => typeof s === 'string')
          } else {
            // Se estamos na rota de atendimento mas sem status, usar 'open' como padrão
            this.pesquisaTickets.status = ['open']
          }
          this.BuscarTicketFiltro()
        }
      },
      immediate: true
    },
    ticketFocado: {
      handler (newVal) {
        if (newVal?.id) {
          this.carregarObservacoes()
        } else {
          this.observacoes = []
        }
      },
      immediate: true
    }
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

/* Global scroll area styles */
.q-scroll-area {
  background: transparent;

  &::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.05);
    border-radius: 12px;
    margin: 2px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(25, 118, 210, 0.6) 0%, rgba(25, 118, 210, 0.8) 100%);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.2);
    transition: all 0.3s ease;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(25, 118, 210, 0.8) 0%, rgba(21, 101, 192, 1) 100%);
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
  }

  &::-webkit-scrollbar-corner {
    background: transparent;
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
    background: linear-gradient(145deg, $dark-primary 0%, $dark-secondary 100%);
  }

  .q-drawer {
    background: rgba(33, 33, 33, 0.95);
  }
}

/* Modo escuro para seção de dados do contato */
.body--dark {
  .contact-info-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .contact-profile-section {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
  }

  .contact-profile-avatar {
    border-color: rgba(255, 255, 255, 0.2);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  }

  .contact-name {
    color: var(--text-color-primary);
  }

  .contact-number {
    color: var(--primary-color);

    &:hover {
      background: rgba(74, 222, 128, 0.15);
    }
  }

  .contact-detail-item {
    background: rgba(255, 255, 255, 0.03);

    &:hover {
      background: rgba(255, 255, 255, 0.08);
    }
  }

  .detail-icon {
    color: var(--primary-color) !important;
  }

  .detail-text {
    color: var(--primary-color) !important;
  }

  .action-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tags-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tags-title {
    color: var(--text-color-primary);
  }

  .modern-tooltip {
    background: var(--background-color-paper) !important;
    color: var(--text-color-primary) !important;
  }

  .clickable-protocol {
      &:hover {
        background-color: rgba(144, 202, 249, 0.12) !important;

        .detail-icon {
          color: $dark-accent !important;
        }

        .detail-text {
          color: $dark-accent !important;
        }
      }

      &:active {
        background-color: rgba(144, 202, 249, 0.16) !important;
      }
    }
}

.contact-data-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  height: 50px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.contact-data-title {
  color: white;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.contact-data-container {
  padding: 12px;
}

.contact-info-card {
  background: var(--background-color-paper);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: none;
  overflow: hidden;
}

.contact-profile-section {
  padding: 12px;
  text-align: center;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.contact-profile-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.contact-avatar-container {
  position: relative;
}

.contact-profile-avatar {
  width: 50px;
  height: 50px;
  border: 2px solid var(--background-color-paper);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.contact-info-details {
  text-align: center;
}

.contact-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 2px;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contact-number {
  font-size: 12px;
  color: var(--primary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.3s ease;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    background: rgba(74, 222, 128, 0.15);
    transform: scale(1.02);
   }
 }

.contact-details-section {
  padding: 8px 12px;
}

.contact-details-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.contact-detail-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--background-color-default);
  border-radius: 4px;
  transition: all 0.3s ease;

  &:hover {
    background: var(--background-color-paper);
    transform: translateX(1px);
  }
}

.detail-icon {
  color: var(--text-color-secondary);
  margin-right: 8px;
  font-size: 14px;
}

.detail-text {
  font-size: 11px;
  color: var(--text-color-secondary);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.action-section {
  padding: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logs-btn {
  width: 80px;
  height: 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 4px;
  padding: 2px 8px;
  font-weight: 500;
  font-size: 10px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(102, 126, 234, 0.3);
  }
}

.tags-card {
  background: var(--background-color-paper);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  margin-top: 8px;
  border: none;
}

.tags-header {
  padding: 10px 12px 6px;
}

.tags-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-primary);
  display: flex;
  align-items: center;
}

.tags-content {
  padding: 0 12px 10px;
}

 .modern-tooltip {
  background: var(--background-color-paper) !important;
  color: var(--text-color-primary) !important;
  border-radius: 6px;
  padding: 8px 12px;
  font-weight: 500;
  font-size: 12px;
 }

.clickable-protocol {
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background-color: rgba(25, 118, 210, 0.08) !important;
      transform: translateX(2px);

      .detail-icon {
        color: #1976d2 !important;
      }

      .detail-text {
        color: #1976d2 !important;
      }
    }

    &:active {
      transform: translateX(1px);
      background-color: rgba(25, 118, 210, 0.12) !important;
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
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background-color: var(--background-color-paper);
  color: var(--text-color-primary);
  font-size: 16px;
  outline: none;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.custom-search-input:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.custom-search-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.custom-search-input::placeholder {
  color: var(--text-color-secondary);
  font-weight: 400;
}

.search-icon {
  position: absolute;
  right: 12px;
  color: var(--text-color-secondary);
  pointer-events: none;
}

/* Modo escuro */
.body--dark .custom-search-input {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.28);
  color: var(--text-color-primary);
}

/* Estilos elegantes para seleção de etiquetas */
.elegant-select {
  border-radius: 8px !important;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.elegant-select:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
}

.elegant-select .q-field__control {
  border-radius: 8px !important;
}

.elegant-option {
  transition: all 0.2s ease;
  border-radius: 4px;
  margin: 2px 4px;
}

.elegant-option:hover {
  background-color: rgba(25, 118, 210, 0.08) !important;
  transform: translateX(2px);
}

.elegant-chip {
  border-radius: 16px !important;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.elegant-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
}

.elegant-no-option {
  text-align: center;
  padding: 16px;
  border-radius: 4px;
  background-color: var(--background-color-default);
}

.custom-tag-selector {
  height: 32px !important;
  min-height: 32px !important;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--background-color-paper);
  color: var(--text-color-primary);
  justify-content: flex-start;
  text-transform: none;
  font-weight: normal;
  padding: 0 12px;
}

.custom-tag-selector:hover {
  background-color: var(--background-color-default);
  border-color: var(--primary-color);
}

.selected-tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 80px;
  overflow-y: auto;
}

.tag-menu {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tag-option-item {
  padding: 8px 16px;
  transition: background-color 0.2s;
}

.tag-option-item:hover {
  background-color: var(--background-color-default);
}

.elegant-chip {
  font-size: 12px;
  height: 24px;
}

.elegant-chip .q-icon {
  font-size: 14px;
}

/* Dark mode styles */
.body--dark .custom-tag-selector {
  border-color: $dark-border;
  background-color: $dark-secondary;
  color: var(--text-color-primary);
}

.body--dark .custom-tag-selector:hover {
  background-color: $dark-hover;
  border-color: $dark-accent;
}

.body--dark .tag-menu {
  background-color: $dark-secondary;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.body--dark .tag-option-item {
  color: var(--text-color-primary);
}

.body--dark .tag-option-item:hover {
  background-color: $dark-hover;
}

.body--dark .elegant-chip {
  background-color: $dark-tertiary;
  color: var(--text-color-primary);
}

.body--dark .elegant-chip .q-icon {
  color: var(--text-color-primary);
}

/* Wallet selector styles */
.custom-wallet-selector {
  height: 32px !important;
  min-height: 32px !important;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--background-color-paper);
  color: var(--text-color-primary);
  justify-content: flex-start;
  text-transform: none;
  font-weight: normal;
  padding: 0 12px;
}

.custom-wallet-selector:hover {
  background-color: var(--background-color-default);
  border-color: var(--primary-color);
}

.selected-wallets-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 80px;
  overflow-y: auto;
}

.wallet-menu {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.wallet-option-item {
  padding: 8px 16px;
  transition: background-color 0.2s;
}

.wallet-option-item:hover {
  background-color: #f5f5f5;
}

/* Wallet title styles */
.wallet-title {
  font-size: 14px;
  font-weight: 600;
  color: $dark-tertiary;
  display: flex;
  align-items: center;
}

/* Dark mode styles for wallet selector */
.body--dark .custom-wallet-selector {
  border-color: $dark-border;
  background-color: $dark-secondary;
  color: var(--text-color-primary);
}

.body--dark .custom-wallet-selector:hover {
  background-color: $dark-hover;
  border-color: $dark-accent;
}

.body--dark .wallet-title {
  color: var(--text-color-primary);
}

.body--dark .wallet-menu {
  background-color: $dark-secondary;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.body--dark .wallet-option-item {
  color: var(--text-color-primary);
}

.body--dark .wallet-option-item:hover {
  background-color: var(--background-color-default);
}

/* Enhanced scroll area customization */
.observations-container .q-scrollarea__thumb {
  background: linear-gradient(180deg, #2e7d32 0%, #388e3c 100%);
  border-radius: 12px;
  opacity: 0.8;
  border: 1px solid rgba(255,255,255,0.2);
  transition: all 0.3s ease;
  width: 5px;
}

.observations-container .q-scrollarea__thumb:hover {
  opacity: 1;
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(46, 125, 50, 0.4);
}

.observations-container .q-scrollarea__track {
  background: rgba(46, 125, 50, 0.1);
  border-radius: 12px;
  margin: 2px;
  width: 5px;
}

.scheduled-messages-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #1565c0 0%, #0d47a1 100%);
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.4);
}

.scheduled-messages-container::-webkit-scrollbar-corner {
  background: transparent;
}

/* Custom scrollbar for ticket list */
.q-drawer .q-scroll-area::-webkit-scrollbar {
  width: 4px;
}

.q-drawer .q-scroll-area::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.05);
  border-radius: 15px;
}

.q-drawer .q-scroll-area::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%);
  border-radius: 15px;
  transition: all 0.3s ease;
}

.q-drawer .q-scroll-area::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.7) 100%);
  transform: scale(1.2);
}

/* Chat area scrollbar */
.scroll-y::-webkit-scrollbar {
  width: 5px;
}

.scroll-y::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.05);
  border-radius: 12px;
  margin: 4px;
}

.scroll-y::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(96, 125, 139, 0.6) 0%, rgba(96, 125, 139, 0.8) 100%);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  transition: all 0.3s ease;
}

.scroll-y::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(96, 125, 139, 0.8) 0%, rgba(69, 90, 100, 1) 100%);
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(96, 125, 139, 0.3);
}

/* Hide scrollbar utility class enhancement */
.hide-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Smooth scrolling behavior */
* {
  scroll-behavior: smooth;
}

/* Custom overflow styles for containers */
.overflow-hidden {
  overflow: hidden;
}

.overflow-auto {
  overflow: auto;
}

.overflow-y-auto {
  overflow-y: auto;
  overflow-x: hidden;
}

.overflow-x-auto {
  overflow-x: auto;
  overflow-y: hidden;
}

/* Animation for new items */
@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.scheduled-message-item,
.observations-container .q-item {
  animation: slideInLeft 0.3s ease-out;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .scheduled-messages-container,
  .observations-container {
    border-radius: 8px;
    margin: 0 8px;
  }

  .scheduled-message-item,
  .observations-container .q-item {
    padding: 8px;
    margin-bottom: 6px;
  }
}

/* Scheduled messages styles */
.scheduled-messages-container {
  border: 1px solid #e3f2fd;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffffff 0%, #f3e5f5 100%);
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
}

.scheduled-messages-container:hover {
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}

.scheduled-messages-container .text-body1 {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color);
  display: flex;
  align-items: center;
}

.scheduled-messages-container .q-item-label {
  font-size: 12px;
}

.scheduled-messages-container .q-item-label[caption] {
  font-size: 10px;
}

.scheduled-messages-container .q-item {
  border-radius: 8px;
  margin-bottom: 8px;
  padding: 12px;
  background: var(--background-color-paper);
  border: 1px solid rgba(25, 118, 210, 0.2);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.scheduled-messages-container .q-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 4px;
  background: linear-gradient(180deg, #1976d2 0%, #42a5f5 100%);
  transition: width 0.3s ease;
}

.scheduled-messages-container .q-item:hover::before {
  width: 6px;
}

.scheduled-messages-container .q-item:hover {
  background: linear-gradient(135deg, rgba(243, 229, 245, 0.5) 0%, rgba(227, 242, 253, 0.5) 100%);
  border-color: var(--primary-color);
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);
}

.scheduled-messages-container .q-btn {
  transition: all 0.3s ease;
}

.scheduled-messages-container .q-btn:hover {
  transform: scale(1.1);
}

/* Observations styles */
.observations-container {
  border: 1px solid #e8f5e8;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffffff 0%, #f1f8e9 100%);
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
}

.observations-container:hover {
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}

.observations-container .text-body1 {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color);
  display: flex;
  align-items: center;
}

.observations-container .q-item-label {
  font-size: 12px;
}

.observations-container .q-item-label[caption] {
  font-size: 10px;
}

.observations-container .q-item {
  border-radius: 8px;
  margin-bottom: 8px;
  padding: 12px;
  background: var(--background-color-paper);
  border: 1px solid rgba(46, 125, 50, 0.2);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.observations-container .q-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 4px;
  background: linear-gradient(180deg, #2e7d32 0%, #66bb6a 100%);
  transition: width 0.3s ease;
}

.observations-container .q-item:hover::before {
  width: 6px;
}

.observations-container .q-item:hover {
  background: linear-gradient(135deg, rgba(241, 248, 233, 0.5) 0%, rgba(232, 245, 232, 0.5) 100%);
  border-color: var(--primary-color);
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.15);
}

.observations-container .q-btn {
  transition: all 0.3s ease;
}

.observations-container .q-btn:hover {
  transform: scale(1.1);
}

/* Dark mode styles for scheduled messages and observations */
.body--dark .scheduled-messages-container {
  border-color: $dark-border;
  background: linear-gradient(135deg, $dark-secondary 0%, $dark-primary 100%);
}

.body--dark .scheduled-messages-container .text-body1 {
  color: $dark-accent;
}

.body--dark .scheduled-messages-container .q-item {
  background: $dark-tertiary;
  border-color: $dark-border;
  color: var(--text-color-primary);
}

.body--dark .scheduled-messages-container .q-item::before {
  background: linear-gradient(180deg, $dark-accent 0%, #64b5f6 100%);
}

.body--dark .scheduled-messages-container .q-item:hover {
  background: linear-gradient(135deg, $dark-tertiary 0%, $dark-secondary 100%);
  border-color: $dark-accent;
}

.body--dark .observations-container {
  border-color: $dark-border;
  background: linear-gradient(135deg, $dark-secondary 0%, $dark-primary 100%);
}

.body--dark .observations-container .text-subtitle1 {
  color: $dark-success;
}

.body--dark .observations-container .q-item {
  background: $dark-tertiary;
  border-color: $dark-border;
  color: var(--text-color-primary);
}

.body--dark .observations-container .q-item::before {
  background: linear-gradient(180deg, $dark-success 0%, #81c784 100%);
}

.body--dark .observations-container .q-item:hover {
   background: linear-gradient(135deg, $dark-tertiary 0%, $dark-secondary 100%);
   border-color: $dark-success;
 }

 /* Dark mode scrollbar styles */
 .body--dark .q-scroll-area {
   &::-webkit-scrollbar-track {
     background: rgba(255,255,255,0.05);
   }

   &::-webkit-scrollbar-thumb {
     background: linear-gradient(180deg, rgba(144, 202, 249, 0.6) 0%, rgba(144, 202, 249, 0.8) 100%);
     border: 1px solid rgba(0,0,0,0.2);
   }

   &::-webkit-scrollbar-thumb:hover {
     background: linear-gradient(180deg, rgba(144, 202, 249, 0.8) 0%, rgba(100, 181, 246, 1) 100%);
     box-shadow: 0 2px 8px rgba(144, 202, 249, 0.4);
   }
 }

 .body--dark .observations-container .q-scrollarea__thumb {
   background: linear-gradient(180deg, #a5d6a7 0%, #81c784 100%);
   border: 1px solid rgba(0,0,0,0.2);
 }

 .body--dark .observations-container .q-scrollarea__thumb:hover {
   box-shadow: 0 2px 8px rgba(165, 214, 167, 0.4);
 }

 .body--dark .observations-container .q-scrollarea__track {
   background: rgba(165, 214, 167, 0.1);
 }

 .body--dark .scheduled-messages-container::-webkit-scrollbar-track {
   background: rgba(144, 202, 249, 0.1);
 }

 .body--dark .scheduled-messages-container::-webkit-scrollbar-thumb {
   background: linear-gradient(180deg, #90caf9 0%, #64b5f6 100%);
   border: 1px solid rgba(0,0,0,0.2);
 }

 .body--dark .scheduled-messages-container::-webkit-scrollbar-thumb:hover {
   background: linear-gradient(180deg, #64b5f6 0%, #42a5f5 100%);
   box-shadow: 0 2px 8px rgba(144, 202, 249, 0.4);
 }

 .body--dark .q-drawer .q-scroll-area::-webkit-scrollbar-track {
   background: rgba(255,255,255,0.05);
 }

 .body--dark .q-drawer .q-scroll-area::-webkit-scrollbar-thumb {
   background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.5) 100%);
 }

 .body--dark .q-drawer .q-scroll-area::-webkit-scrollbar-thumb:hover {
   background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.7) 100%);
 }

 .body--dark .scroll-y::-webkit-scrollbar-track {
   background: rgba(255,255,255,0.05);
 }

 .body--dark .scroll-y::-webkit-scrollbar-thumb {
   background: linear-gradient(180deg, rgba(176, 190, 197, 0.6) 0%, rgba(176, 190, 197, 0.8) 100%);
   border: 1px solid rgba(0,0,0,0.1);
 }

 .body--dark .scroll-y::-webkit-scrollbar-thumb:hover {
   background: linear-gradient(180deg, rgba(176, 190, 197, 0.8) 0%, rgba(144, 164, 174, 1) 100%);
   box-shadow: 0 2px 6px rgba(176, 190, 197, 0.4);
 }

.body--dark .extra-info-title {
  color: var(--text-color-primary);
}

.body--dark .extra-info-container {
  border-color: $dark-border;
  background-color: $dark-secondary;
}

.body--dark .extra-info-item {
  border-bottom-color: $dark-border;
  color: var(--text-color-primary);
}

.body--dark .extra-info-item:hover {
  background-color: $dark-hover;
}

.body--dark .custom-search-input:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.body--dark .custom-search-input:focus {
  border-color: $dark-accent;
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
  background-color: var(--background-color-default);
  color: var(--primary-color);
  border: 1px solid rgba(25, 118, 210, 0.2);
  transition: all 0.3s ease;
  width: 40px;
  height: 40px;
}

.contacts-btn:hover {
  background-color: var(--primary-color);
  color: var(--text-color-primary);
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(25, 118, 210, 0.3);
}

.contacts-btn:active {
  transform: scale(0.95);
}

/* Modo escuro para o botão de contatos */
.body--dark .contacts-btn {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--primary-color);
  border-color: rgba(144, 202, 249, 0.3);
}

.body--dark .contacts-btn:hover {
  background-color: var(--primary-color);
  color: var(--text-color-primary);
}
</style>
