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
        <q-toolbar class="modern-search-toolbar">
          <div class="col modern-search-wrapper">
            <div class="search-input-container">
              <q-icon name="mdi-magnify" class="search-icon" />
              <input
                v-model="searchTickets"
                placeholder="Buscar atendimentos..."
                class="modern-search-input"
                type="text"
              />
              <q-btn
                v-if="searchTickets"
                flat
                round
                dense
                size="sm"
                icon="mdi-close"
                class="clear-search-btn"
                @click="searchTickets = ''"
              />
            </div>
          </div>
          <div class="toolbar-actions">
            <q-btn
              flat
              round
              dense
              class="modern-action-btn"
              icon="mdi-account-multiple"
              @click="$q.screen.lt.md ? modalNovoTicket = true : $router.push({ name: 'chat-contatos' })"
            >
              <q-tooltip content-class="modern-tooltip">
                Contatos
              </q-tooltip>
            </q-btn>
          </div>
        </q-toolbar>

        <!-- Filtros condicionais baseado no status -->
        <div class="modern-filters-section" v-if="(pesquisaTickets.status && pesquisaTickets.status.includes('pending')) || $route.query.status === 'pending'">
          <div class="filter-chip filter-chip--active">
            <q-icon name="mdi-clock-outline" size="14px" />
            <span>Tickets não atendidos</span>
          </div>
        </div>

        <!-- Filtros originais para outros status -->
        <div class="modern-filters-section" v-else>
          <div class="filters-container">
            <button
              :class="['filter-chip', { 'filter-chip--active': cFiltroSelecionado === 'meus' }]"
              @click="setFilterMode('meus')"
            >
              <q-icon name="mdi-account" size="14px" />
              <span>Meus atendimentos</span>
            </button>
            <button
              :class="['filter-chip', { 'filter-chip--active': cFiltroSelecionado === 'fila' }]"
              @click="setFilterMode('fila')"
            >
              <q-icon name="mdi-account-group" size="14px" />
              <span>Meus departamentos</span>
            </button>
            <button
              :class="['filter-chip', { 'filter-chip--active': cFiltroSelecionado === 'todos' }]"
              @click="setFilterMode('todos')"
            >
              <q-icon name="mdi-view-list" size="14px" />
              <span>Todos</span>
            </button>
          </div>
        </div>

        <q-scroll-area
          ref="scrollAreaTickets"
          :thumb-style="thumbStyle"
          :bar-style="barStyle"
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
          key="static-chat"
        ></router-view>
      </q-page-container>

      <q-drawer
        v-if="!cRouteContatos && ticketFocado.id"
        :value="true"
        show-if-above
        bordered
        side="right"
        content-class="bg-grey-1"
      >

        <q-separator />
        <q-scroll-area
          :thumb-style="thumbStyle"
          :bar-style="barStyle"
          style="height: calc(100vh - 60px)"
        >
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

            <!-- Botão Encerrar Ticket -->
            <div class="q-mt-md"></div>
            <q-card class="action-card" v-if="ticketFocado.status !== 'closed'">
              <q-card-section class="action-section">
                <q-btn
                  flat
                  color="positive"
                  label="Encerrar Ticket"
                  @click="resolverTicket"
                  class="full-width"
                />
              </q-card-section>
            </q-card>

            <!-- Botões de Ação -->
            <div class="q-mt-md"></div>
            <q-card class="action-card" v-if="ticketFocado.status !== 'closed'">
              <q-card-section class="action-section">
                <div class="row q-gutter-sm">
                  <div class="col">
                    <q-btn
                      flat
                      color="primary"
                      label="Transferir"
                      @click="abrirModalTransferirTicket"
                      class="full-width"
                    />
                  </div>
                  <div class="col">
                    <q-btn
                      flat
                      color="info"
                      label="Timeline"
                      @click="abrirModalTimeline"
                      class="full-width"
                    />
                  </div>
                </div>
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
              <q-scroll-area
                :thumb-style="thumbStyle"
                :bar-style="barStyle"
                style="height: 200px"
              >
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
              <q-scroll-area
                :thumb-style="thumbStyle"
                :bar-style="barStyle"
                style="height: 200px"
              >
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

      <ModalTimeline
        :modalTimeline.sync="modalTimeline"
        :contato="ticketFocado.contact || {}"
      />

      <q-dialog
        v-model="modalTransferirTicket"
        @hide="modalTransferirTicket = false"
        persistent
      >
        <q-card
          class="q-pa-md"
          style="width: 500px"
        >
          <q-card-section>
            <div class="text-h6">Transferir Ticket</div>
            <div class="text-subtitle2 text-grey-6">Selecione o destino para o ticket #{{ ticketFocado.id }}</div>
          </q-card-section>
          <q-card-section class="row q-gutter-sm">
            <div class="col-12">
              <q-select
                dense
                rounded
                outlined
                v-model="filaSelecionada"
                :options="opcoesFilas"
                emit-value
                map-options
                option-value="id"
                option-label="label"
                label="Fila de destino (opcional)"
                class="full-width"
                :loading="filas.length === 0"
                clearable
              />
            </div>
            <div class="col-12">
              <q-select
                rounded
                dense
                outlined
                v-model="usuarioSelecionado"
                :options="usuariosFiltrados"
                emit-value
                map-options
                option-value="id"
                option-label="name"
                label="Usuário destino"
                class="full-width"
                :loading="usuarios.length === 0"
              />
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              rounded
              label="Cancelar"
              color="negative"
              v-close-popup
              class="q-mr-md"
            />
            <q-btn
              rounded
              label="Transferir"
              color="positive"
              @click="confirmarTransferenciaTicket"
              :disable="!usuarioSelecionado"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

    </q-layout>
  </div>
</template>

<script>
import ContatoModal from 'src/pages/contatos/ContatoModal'
import ItemTicket from './ItemTicket'
import { ConsultarTickets, DeletarMensagem, AtualizarTicket } from 'src/service/tickets'
import { mapGetters } from 'vuex'
import mixinSockets from './mixinSockets'
import mixinAtualizarStatusTicket from './mixinAtualizarStatusTicket'
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

import ModalObservacao from './ModalObservacao.vue'
import { ListarObservacoes } from '../../service/observacoes'
import ModalListarObservacoes from './ModalListarObservacoes.vue'
import ModalListarMensagensAgendadas from './ModalListarMensagensAgendadas.vue'
import ModalTimeline from './ModalTimeline.vue'

import { tocarSomNotificacao, solicitarPermissaoAudio, inicializarServicoAudio, temPermissaoAudio } from 'src/helpers/helpersNotifications'

export default {
  name: 'IndexAtendimento',

  mixins: [mixinSockets, mixinAtualizarStatusTicket, socketInitial],
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
    ModalTimeline

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
      configuracoes: [],
      debounce,
      usuario,
      usuarios: [],
      username,
      modalUsuario: false,
      toolbarSearch: true,
      drawerTickets: true,
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
      modalObservacao: false,
      modalListarObservacoes: false,
      modalListarMensagensAgendadas: false,
      modalTimeline: false,
      modalTransferirTicket: false,
      usuarioSelecionado: null,
      filaSelecionada: null,
      usuariosFiltrados: [],

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
      'ticketFocado',
      'hasMore',
      'whatsapps'
    ]),
    // Filtrar tickets pelo status atual
    tickets () {
      const allTickets = this.$store.getters.tickets || []
      const currentStatus = this.pesquisaTickets.status

      if (!currentStatus || !Array.isArray(currentStatus)) {
        // console.log('[tickets computed] Sem status definido, retornando todos os tickets')
        return allTickets
      }

      const filteredTickets = allTickets.filter(ticket => currentStatus.includes(ticket.status))

      // console.log('[tickets computed] Status atual:', currentStatus)
      // console.log('[tickets computed] Total tickets no store:', allTickets.length)
      // console.log('[tickets computed] Tickets filtrados:', filteredTickets.length)
      // console.log('[tickets computed] Status dos tickets filtrados:', filteredTickets.map(t => ({ id: t.id, status: t.status })))

      return filteredTickets
    },
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
    },
    thumbStyle () {
      return {
        borderRadius: '5px',
        backgroundColor: '#1a202c',
        width: '5px',
        opacity: 0.75
      }
    },
    barStyle () {
      return {
        borderRadius: '0px',
        backgroundColor: 'transparent',
        width: '5px',
        opacity: 0.2
      }
    },
    opcoesFilas () {
      const opcoes = [
        { id: null, label: 'Sem fila específica' }
      ]

      if (this.filas && this.filas.length > 0) {
        this.filas.forEach(fila => {
          opcoes.push({
            id: fila.id,
            label: fila.queue || `Fila ${fila.id}`
          })
        })
      }

      return opcoes
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

    toggleStatus (status) {
      // Substitui o array atual por um novo array contendo apenas o status selecionado
      this.pesquisaTickets.status = [status]
      this.debounce(this.BuscarTicketFiltro(), 700)
    },

    setFilterMode (filterMode) {
      // console.log('[setFilterMode] Mudando filtro para:', filterMode, 'Status atual:', this.pesquisaTickets.status)

      // Resetar filtros
      this.pesquisaTickets.showAll = false
      this.pesquisaTickets.withUnreadMessages = false
      this.pesquisaTickets.isNotAssignedUser = false
      this.pesquisaTickets.queuesIds = []
      this.pesquisaTickets.pageNumber = 1 // Reset da paginação

      const currentStatus = this.pesquisaTickets.status

      // Para status que inclui 'pending' (tickets não atendidos)
      if (currentStatus && (currentStatus.includes('pending') || this.$route.query.status === 'pending')) {
        // console.log('[setFilterMode] Aplicando filtros para tickets pendentes')
        // Para tickets pendentes, mostrar todos os tickets pendentes
        this.pesquisaTickets.isNotAssignedUser = false
        this.pesquisaTickets.showAll = true // Permitir ver todos os tickets pendentes
        this.pesquisaTickets.withUnreadMessages = false
        this.pesquisaTickets.queuesIds = []
      } else {
        // Para outros status (incluindo 'open'), aplicar filtros baseado no modo selecionado
        // console.log('[setFilterMode] Aplicando filtros para status:', currentStatus, 'modo:', filterMode)

        if (filterMode === 'meus') {
          this.pesquisaTickets.showAll = false
          // Para 'open', meus atendimentos = atendimentos atribuídos a mim
        } else if (filterMode === 'fila') {
          this.pesquisaTickets.queuesIds = this.cUserQueues.map(q => q.id)
          // Para 'open', atendimentos da minha fila em andamento
        } else if (filterMode === 'todos') {
          // Para 'open', todos os atendimentos em andamento independente da fila
          this.pesquisaTickets.showAll = false
          this.pesquisaTickets.queuesIds = []
        }
      }

      // console.log('[setFilterMode] Filtros aplicados:', this.pesquisaTickets)
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
            position: 'bottom-right',
            timeout: 2000
          })
        })
        .catch((error) => {
          console.error('Erro ao copiar o conteúdo: ', error)
          this.$q.notify({
            type: 'negative',
            message: 'Erro ao copiar conteúdo',
            position: 'bottom-right',
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
          position: 'bottom-right'
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
          position: 'bottom-right'
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
          position: 'bottom-right'
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
          position: 'bottom-right'
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
          position: 'bottom-right'
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
          position: 'bottom-right'
        })
        return
      }
      // Emite evento global para abrir o modal do cabeçalho do chat
      this.$root.$emit('abrir:modalAgendamentoMensagem')
      // Remove a abertura do modal local para evitar dois modais abertos
      // this.modalAgendarMensagem = true
    },

    resolverTicket () {
      if (!this.ticketFocado?.id) {
        this.$q.notify({
          type: 'warning',
          message: 'Selecione um ticket para resolver',
          position: 'bottom-right'
        })
        return
      }
      this.atualizarStatusTicket('closed')
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
      this.loading = true
      localStorage.setItem('filtrosAtendimento', JSON.stringify(this.pesquisaTickets))
      this.pesquisaTickets = {
        ...this.pesquisaTickets,
        pageNumber: 1
      }

      // Apenas buscar e atualizar a lista, sem mexer no chat
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
    },
    abrirModalTransferirTicket () {
      if (!this.ticketFocado?.id) {
        this.$q.notify({
          type: 'warning',
          message: 'Selecione um ticket para transferir',
          position: 'bottom-right'
        })
        return
      }
      this.filterUsers()
      this.modalTransferirTicket = true
    },
    filterUsers () {
      const fila = this.filaSelecionada
      this.usuariosFiltrados = this.usuarios.filter(element => {
        if (fila == null || fila === '') {
          return true
        }
        if (!element.queues || !Array.isArray(element.queues)) {
          return true
        }
        const queues_valid = element.queues.filter(queue => queue.id == fila)
        return queues_valid.length > 0
      })
    },
    async confirmarTransferenciaTicket () {
      try {
        const userId = +localStorage.getItem('userId')

        if (!this.usuarioSelecionado) {
          this.$q.notify({
            type: 'warning',
            message: 'Selecione um usuário de destino',
            position: 'bottom-right'
          })
          return
        }

        // Verificar se o ticket já pertence ao usuário selecionado
        if (this.ticketFocado.userId === this.usuarioSelecionado && this.ticketFocado.userId != null) {
          this.$q.notify({
            type: 'info',
            message: 'Ticket já pertence ao usuário selecionado.',
            position: 'bottom-right'
          })
          return
        }

        // Verificar se o ticket já pertence ao usuário atual
        if (this.ticketFocado.userId === userId && userId === this.usuarioSelecionado) {
          this.$q.notify({
            type: 'info',
            message: 'Ticket já pertence ao seu usuário',
            position: 'bottom-right'
          })
          return
        }

        // Verificar se o ticket já está na mesma fila e usuário
        if (this.ticketFocado.queueId === this.filaSelecionada && this.ticketFocado.userId === this.usuarioSelecionado) {
          this.$q.notify({
            type: 'info',
            message: 'Ticket já pertence a esta fila e usuário',
            position: 'bottom-right'
          })
          return
        }

        // Preparar dados para transferência
        const dadosTransferencia = {
          userId: this.usuarioSelecionado,
          status: 'open',
          isTransference: 1
        }

        // Adicionar fila apenas se foi selecionada
        if (this.filaSelecionada) {
          dadosTransferencia.queueId = this.filaSelecionada
        }

        // Realizar a transferência
        await AtualizarTicket(this.ticketFocado.id, dadosTransferencia)

        this.$q.notify({
          type: 'positive',
          message: 'Ticket transferido com sucesso!',
          position: 'bottom-right'
        })

        // Limpar o modal e resetar os dados
        this.modalTransferirTicket = false
        this.usuarioSelecionado = null
        this.filaSelecionada = null

        // Limpar o ticket focado para forçar atualização
        this.$store.commit('TICKET_FOCADO', {})

        // Emitir evento para atualizar a lista de tickets
        this.consultarTickets()
      } catch (error) {
        console.error('Erro ao transferir ticket:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao transferir ticket. Tente novamente.',
          position: 'bottom-right'
        })
      }
    },
    abrirModalTimeline () {
      if (!this.ticketFocado?.id) {
        this.$q.notify({
          type: 'warning',
          message: 'Selecione um ticket para ver o timeline',
          position: 'bottom-right'
        })
        return
      }
      // Abrir modal de timeline
      this.modalTimeline = true
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
    this.$root.$on('ticket:transferido', this.consultarTickets)
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
    this.$root.$off('ticket:transferido', this.consultarTickets)
    // this.socketDisconnect()

    // Só limpar o ticket focado se estivermos realmente saindo da área de atendimento
    // e não apenas navegando entre diferentes status de atendimento
    const nextRoute = this.$router.currentRoute
    const isLeavingAttendanceArea = !nextRoute ||
                                    !nextRoute.path.includes('/atendimento') ||
                                    nextRoute.name === 'login' ||
                                    nextRoute.name === 'home-dashboard'

    if (isLeavingAttendanceArea) {
      this.$store.commit('TICKET_FOCADO', {})
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
      handler (newRoute, oldRoute) {
        // Evitar execução desnecessária
        if (oldRoute && newRoute.query.status === oldRoute.query.status) return

        const newStatus = newRoute.query.status

        // Atualizar status se estivermos em qualquer rota de atendimento (atendimento, chat-empty, chat)
        const atendimentoRoutes = ['atendimento', 'chat-empty', 'chat']
        if (atendimentoRoutes.includes(newRoute.name)) {
          // Se estamos na rota pai sem rota filha, navegar para chat-empty
          if (newRoute.name === 'atendimento' && !newRoute.params.ticketId && newRoute.path === '/atendimento') {
            this.$router.replace({
              name: 'chat-empty',
              query: newRoute.query // Preservar query parameters
            })
            return
          }

          let statusToSet
          if (newStatus) {
            statusToSet = [newStatus].filter(s => typeof s === 'string')
          } else {
            // Se estamos na rota de atendimento mas sem status, usar 'open' como padrão
            statusToSet = ['open']
          }

          // Só buscar se o status realmente mudou
          const currentStatus = this.pesquisaTickets.status
          const statusChanged = JSON.stringify(statusToSet) !== JSON.stringify(currentStatus)

          if (statusChanged) {
            this.pesquisaTickets.status = statusToSet

            // Aplicar filtros específicos baseado no status
            if (statusToSet.includes('pending')) {
              // Para tickets pendentes: mostrar todos os pendentes
              this.pesquisaTickets.showAll = true
              this.pesquisaTickets.isNotAssignedUser = false
              this.pesquisaTickets.withUnreadMessages = false
              this.pesquisaTickets.queuesIds = []
            } else if (statusToSet.includes('open')) {
              // Para tickets em andamento: filtro padrão (meus tickets)
              this.pesquisaTickets.showAll = false
              this.pesquisaTickets.isNotAssignedUser = false
              this.pesquisaTickets.withUnreadMessages = false
              this.pesquisaTickets.queuesIds = []
            } else if (statusToSet.includes('closed')) {
              // Para tickets fechados: mostrar todos
              this.pesquisaTickets.showAll = true
              this.pesquisaTickets.isNotAssignedUser = false
              this.pesquisaTickets.withUnreadMessages = false
              this.pesquisaTickets.queuesIds = []
            }

            // Buscar com os novos filtros
            this.BuscarTicketFiltro()
          }
        }
      },
      immediate: false // Mudado para false para evitar execução desnecessária no mount
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
    },
    filaSelecionada: {
      handler (newVal) {
        this.filterUsers()
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
    background: linear-gradient(180deg, #424242 0%, rgba(25, 118, 210, 0.8) 100%);
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

/* Estilos elegantes para seleção de etiquetas */

/* Modern Search Toolbar */
.modern-search-toolbar {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: none;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.modern-search-wrapper {
  display: flex;
  align-items: center;
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 24px;
  padding: 0 16px;
  border: 2px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 40px;
  width: 100%;
  max-width: 400px;

  &:hover {
    background: #eeeeee;
    border-color: rgba(25, 118, 210, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &:focus-within {
    background: #ffffff;
    border-color: #1976d2;
    box-shadow: 0 4px 16px rgba(25, 118, 210, 0.15);
  }
}

.search-icon {
  color: #757575;
  margin-right: 8px;
  transition: color 0.3s ease;
}

.search-input-container:focus-within .search-icon {
  color: #1976d2;
}

.modern-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  font-weight: 400;
  color: #2c3e50;
  padding: 8px 0;

  &::placeholder {
    color: #9e9e9e;
    font-weight: 400;
  }
}

.clear-search-btn {
  color: #9e9e9e;
  margin-left: 8px;
  transition: all 0.3s ease;

  &:hover {
    color: #f44336;
    background: rgba(244, 67, 54, 0.1);
  }
}

.toolbar-actions {
  margin-left: 16px;
}

.modern-action-btn {
  width: 40px;
  height: 40px;
  background: #f5f5f5;
  color: #1976d2;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;

  &:hover {
    background: #1976d2;
    color: white;
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
}

.modern-tooltip {
  background: linear-gradient(135deg, #2c3e50, #3498db);
  color: white;
  font-weight: 500;
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Modern Filters Section */
.modern-filters-section {
  background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: center;
  align-items: center;
}

.filters-container {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 2px solid #e0e0e0;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #5a6c7d;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  &:hover {
    border-color: #1976d2;
    color: #1976d2;
    background: #f3f8ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);

    &::before {
      left: 100%;
    }
  }

  &--active {
    background: linear-gradient(135deg, #1976d2, #42a5f5);
    border-color: #1976d2;
    color: white;
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);

    &:hover {
      background: linear-gradient(135deg, #1565c0, #1976d2);
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(25, 118, 210, 0.4);
    }
  }

  span {
    font-weight: 500;
  }
}

/* Dark Mode Styles */
.body--dark {
  .modern-search-toolbar {
    background: linear-gradient(135deg, var(--dark-secondary), var(--dark-tertiary));
    border-bottom-color: var(--dark-border);
  }

  .search-input-container {
    background: var(--dark-tertiary);

    &:hover {
      background: var(--dark-primary);
      border-color: rgba(144, 202, 249, 0.3);
    }

    &:focus-within {
      background: var(--dark-primary);
      border-color: var(--dark-accent);
      box-shadow: 0 4px 16px rgba(144, 202, 249, 0.15);
    }
  }

  .search-icon {
    color: var(--dark-text-primary);
  }

  .search-input-container:focus-within .search-icon {
    color: var(--dark-accent);
  }

  .modern-search-input {
    color: var(--dark-text-primary);

    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .clear-search-btn {
    color: var(--dark-text-primary);

    &:hover {
      color: #ff5252;
    }
  }

  .modern-action-btn {
    background: var(--dark-tertiary);
    color: var(--dark-accent);

    &:hover {
      background: var(--dark-accent);
      color: var(--dark-primary);
    }
  }

  .modern-filters-section {
    background: linear-gradient(135deg, var(--dark-secondary), var(--dark-primary));
    border-bottom-color: var(--dark-border);
  }

  .filter-chip {
    background: var(--dark-tertiary);
    border-color: var(--dark-border);
    color: var(--dark-text-primary);

    &:hover {
      border-color: var(--dark-accent);
      color: var(--dark-accent);
      background: rgba(144, 202, 249, 0.1);
    }

    &--active {
      background: linear-gradient(135deg, var(--dark-accent), #64b5f6);
      border-color: var(--dark-accent);
      color: var(--dark-primary);

      &:hover {
        background: linear-gradient(135deg, #64b5f6, var(--dark-accent));
      }
    }
  }
}

/* Responsive Adjustments */
@media (max-width: 768px) {
  .modern-search-toolbar {
    padding: 8px 12px;
  }

  .search-input-container {
    max-width: none;
    min-height: 36px;
    padding: 0 12px;
  }

  .modern-search-input {
    font-size: 13px;
  }

  .toolbar-actions {
    margin-left: 12px;
  }

  .modern-action-btn {
    width: 36px;
    height: 36px;
  }

  .modern-filters-section {
    padding: 8px 12px;
  }

  .filter-chip {
    padding: 6px 12px;
    font-size: 11px;
  }
}

/* Accessibility improvements */
.filter-chip:focus {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

.modern-action-btn:focus {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

.modern-search-input:focus {
  /* Focus is handled by the container */
}

/* Animation for filter changes */
@keyframes filter-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.filter-chip--active {
  animation: filter-pulse 0.3s ease-out;
}
</style>
