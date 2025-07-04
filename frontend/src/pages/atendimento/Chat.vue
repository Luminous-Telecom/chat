/* Força remoção de bordas do Quasar */
:deep(.q-footer) {
  border: none !important;
  box-shadow: none !important;
}

:deep(.q-separator) {
  display: none !important;
}<template>
  <div
    class="chat-container no-scroll hide-scrollbar overflow-hidden"
    :style="style"
    :class="{
      'bg-white': !$q.dark.isActive,
      'bg-dark': $q.dark.isActive
    }"
  >
    <!-- Overlay de background igual WhatsApp Web -->
    <div class="wa-bg-overlay x10l6tqk x13vifvy x1o0tod xh8yej3 x5yr21d x182nak8 x1wwuglj x1vs56c6" data-asset-chat-background-dark="true"></div>
    <div v-if="$q.dark.isActive === false" class="wa-bg-color"></div>
    <q-scroll-area
      ref="scrollContainer"
      class="scroll-y"
      :style="cStyleScroll"
      @scroll="scrollArea"
    >
      <transition
        appear
        enter-active-class="animated fadeIn"
        leave-active-class="animated fadeOut"
      >
        <!-- Container único para conteúdo múltiplo -->
        <div>
          <!-- Botão para carregar mais mensagens -->
          <div 
            v-if="cMessages.length && hasMore && !loading" 
            class="text-center q-pa-md"
          >
            <q-btn
              @click="loadMoreMessages"
              color="primary"
              outline
              label="Carregar mais mensagens"
              icon="mdi-arrow-up"
              :loading="loading"
            />
          </div>
          <div 
            v-if="loading" 
            class="text-center q-pa-md"
          >
            <q-spinner-dots color="primary" size="2em" />
          </div>
        </div>
      </transition>
      <MensagemChat
        :replyingMessage.sync="replyingMessage"
        :mensagens="cMessages"
        :ticketFocado="ticketFocado"
        :isLineDate="true"
        v-if="cMessages.length && ticketFocado.id"
        @mensagem-chat:encaminhar-mensagem="abrirModalEncaminharMensagem"
        :ativarMultiEncaminhamento.sync="ativarMultiEncaminhamento"
        :mensagensParaEncaminhar.sync="mensagensParaEncaminhar"
        @update:replyingMessage="replyingMessage = $event"
      />
      <div id="fimListaMensagensChat" style="height: 1px;"></div>
    </q-scroll-area>

    <div
      class="empty-state-container"
      v-if="!ticketFocado.id"
    >
      <div class="empty-state-content">
        <q-icon
          size="6em"
          color="grey-6"
          name="mdi-emoticon-wink-outline"
          class="empty-icon"
        />
        <h1 class="text-grey-6 empty-title">
          Selecione um ticket!
        </h1>
      </div>
    </div>

    <div
      v-if="cMessages.length"
      class="relative-position"
    >
      <transition
        appear
        enter-active-class="animated fadeIn"
        leave-active-class="animated fadeOut"
      >
        <div v-if="scrollIcon" class="scroll-to-bottom-container">
          <q-btn
            class="vac-icon-scroll"
            color="white"
            text-color="black"
            icon="mdi-arrow-down"
            round
            push
            ripple
            dense
            @click="scrollToBottom"
          >
            <!-- Contador de mensagens não lidas -->
            <q-badge
              v-if="unreadMessagesCount > 0"
              color="green"
              :label="unreadMessagesCount > 99 ? '99+' : unreadMessagesCount"
              class="unread-count-badge"
              floating
            />
          </q-btn>
        </div>
      </transition>
    </div>

    <!-- Input area sem q-footer -->
    <div
      v-if="ticketFocado.id && ticketFocado.status === 'open'"
      class="input-area"
    >
      <!-- Mensagem de resposta -->
      <q-list
        v-if="replyingMessage"
        :style="`border-top: 1px solid transparent; max-height: 140px; width: 100%;`"
        style="max-height: 100px;"
        class="q-pa-none q-py-md text-black row items-center col justify-center full-width"
        :class="{
            'bg-grey-1': !$q.dark.isActive,
            'bg-grey-10': $q.dark.isActive
          }"
      >
        <q-item
          class="q-card--bordered q-pb-sm btn-rounded"
          :style="`
            width: 460px;
            min-width: 460px;
            max-width: 460px;
            max-height: 110px;
          `"
          :class="{
              'bg-blue-1': !replyingMessage.fromMe && !$q.dark.isActive,
              'bg-blue-2 text-black': !replyingMessage.fromMe && $q.dark.isActive,
              'bg-grey-2 text-black': replyingMessage.fromMe
            }"
        >
          <q-item-section>
            <q-item-label
              v-if="!replyingMessage.fromMe"
              :class="{ 'text-black': $q.dark.isActive }"
              caption
            >
              {{ replyingMessage.contact && replyingMessage.contact.name }}
            </q-item-label>
            <q-item-label
              lines="4"
              v-html="formatarMensagemWhatsapp(replyingMessage.body)"
            >
            </q-item-label>
          </q-item-section>
          <q-btn
            @click="replyingMessage = null"
            dense
            flat
            round
            icon="close"
            class="float-right absolute-top-right z-max"
            :disabled="loading || ticketFocado.status !== 'open'"
          />
        </q-item>
      </q-list>

      <!-- Banner de encaminhamento -->
      <q-banner
        class="text-grey-8"
        v-if="mensagensParaEncaminhar.length > 0"
      >
        <span class="text-bold text-h5"> {{ mensagensParaEncaminhar.length }} de 10 mensagens</span> selecionadas para
        serem encaminhadas.
        <q-separator class="bg-grey-4" />
        <q-select
          dense
          class="q-my-md"
          ref="selectAutoCompleteContato"
          autofocus
          outlined
          rounded
          hide-dropdown-icon
          :loading="loading"
          v-model="contatoSelecionado"
          :options="contatos"
          input-debounce="700"
          @filter="localizarContato"
          use-input
          hide-selected
          fill-input
          clearable
          option-label="name"
          option-value="id"
          label="Localize e selecione o contato"
          hint="Digite no mínimo duas letras para localizar o contato. É possível selecionar apenas 1 contato!"
        >
          <template v-slot:option="scope">
            <q-item
              v-bind="scope.itemProps"
              v-on="scope.itemEvents"
              v-if="scope.opt.name"
            >
              <q-item-section>
                <q-item-label> {{ scope.opt.name }}</q-item-label>
                <q-item-label caption>{{ scope.opt.number }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>
        <template v-slot:action>
          <q-btn
            class="bg-padrao q-px-sm"
            flat
            color="negative"
            label="Cancelar"
            @click="cancelarMultiEncaminhamento"
          />
          <q-btn
            class="bg-padrao q-px-sm"
            flat
            color="positive"
            label="Enviar"
            icon="mdi-send"
            @click="confirmarEncaminhamentoMensagem(mensagensParaEncaminhar)"
          />
        </template>
      </q-banner>

      <!-- Input de mensagem -->
      <InputMensagem
        v-if="!mensagensParaEncaminhar.length"
        :mensagensRapidas="mensagensRapidas"
        :replyingMessage.sync="replyingMessage"
      />
      <q-resize-observer @resize="onResizeInputMensagem" />
    </div>

    <!-- Modais -->
    <q-dialog
      v-model="modalAgendamentoMensagem"
      persistent
    >
      <q-card :style="$q.screen.width < 770 ? `min-width: 98vw; max-width: 98vw` : 'min-width: 50vw; max-width: 50vw'">
        <q-card-section>
          <div class="text-h6">
            Agendamento de Mensagem
            <q-btn
              flat
              class="bg-padrao btn-rounded float-right"
              color="negative"
              icon="close"
              v-close-popup
            />
          </div>
        </q-card-section>
        <q-card-section class="q-mb-lg">
          <InputMensagem
            isScheduleDate
            :mensagensRapidas="mensagensRapidas"
            :replyingMessage.sync="replyingMessage"
          />
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog
      v-model="modalEncaminhamentoMensagem"
      persistent
      @hide="mensagemEncaminhamento = {}"
    >
      <q-card :style="$q.screen.width < 770 ? `min-width: 98vw; max-width: 98vw` : 'min-width: 50vw; max-width: 50vw'">
        <q-card-section>
          <div class="text-h6">
            Encaminhando Mensagem
            <q-btn
              flat
              class="bg-padrao btn-rounded float-right"
              color="negative"
              icon="close"
              v-close-popup
            />
          </div>
        </q-card-section>
        <q-separator inset />
        <q-card-section>
          <MensagemChat
            :isShowOptions="false"
            :replyingMessage.sync="replyingMessage"
            :mensagens="[mensagemEncaminhamento]"
            :ticketFocado="ticketFocado"
            :isLineDate="false"
          />
        </q-card-section>
        <q-card-section>
          <q-select
            class="q-px-lg"
            ref="selectAutoCompleteContato"
            autofocus
            outlined
            rounded
            hide-dropdown-icon
            :loading="loading"
            v-model="contatoSelecionado"
            :options="contatos"
            input-debounce="700"
            @filter="localizarContato"
            use-input
            hide-selected
            fill-input
            clearable
            option-label="name"
            option-value="id"
            label="Localize e selecione o contato"
            hint="Digite no mínimo duas letras para localizar o contato. É possível selecionar apenas 1 contato!"
          >
            <template v-slot:option="scope">
              <q-item
                v-bind="scope.itemProps"
                v-on="scope.itemEvents"
                v-if="scope.opt.name"
              >
                <q-item-section>
                  <q-item-label> {{ scope.opt.name }}</q-item-label>
                  <q-item-label caption>{{ scope.opt.number }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>
        <q-card-actions
          align="right"
          class="q-pa-md"
        >
          <q-btn
            class="bg-padrao q-px-sm"
            flat
            color="positive"
            label="Enviar"
            icon="mdi-send"
            @click="confirmarEncaminhamentoMensagem([mensagemEncaminhamento])"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import mixinCommon from './mixinCommon'
import MensagemChat from './MensagemChat'
import InputMensagem from './InputMensagem'
import mixinAtualizarStatusTicket from './mixinAtualizarStatusTicket'
import mixinSockets from './mixinSockets'
// Removido InfiniteLoading - usando implementação nativa
import { ListarContatos } from 'src/service/contatos'
import { EncaminharMensagem } from 'src/service/tickets'
import { mapGetters } from 'vuex'
import eventBus from 'src/utils/eventBus'

export default {
  name: 'Chat',
  mixins: [mixinCommon, mixinAtualizarStatusTicket, mixinSockets],
  props: {
    mensagensRapidas: Array
  },
  components: {
    MensagemChat,
    InputMensagem
  },
  data () {
    return {
      scrollIcon: false,
      loading: false,
      exibirContato: false,
      heigthInputMensagem: 0,
      params: {
        ticketId: null,
        pageNumber: 1
      },
      agendamentoMensagem: {
        scheduleDate: ''
      },
      replyingMessage: null,
      modalAgendamentoMensagem: false,
      modalEncaminhamentoMensagem: false,
      mensagemEncaminhamento: {},
      mensagensParaEncaminhar: [],
      ativarMultiEncaminhamento: false,
      contatoSelecionado: {
        id: '',
        name: ''
      },
      contatos: [],
      scrollReadTimeout: null
    }
  },
  computed: {
    ...mapGetters(['mensagensTicket', 'ticketFocado', 'hasMore']),
    cMessages () {
      return this.mensagensTicket || []
    },
    style () {
      return {}
    },
    cStyleScroll () {
      const loading = 0
      // Se não há ticket ou ticket está fechado, usa altura total
      if (!this.ticketFocado.id || this.ticketFocado.status !== 'open') {
        return 'min-height: 100vh; height: 100vh; width: 100%; padding-bottom: 0px;'
      }
      // Se há ticket aberto, considera altura do input
      const add = this.heigthInputMensagem + loading
      return `min-height: calc(100vh - ${add}px); height: calc(100vh - ${add}px); width: 100%; padding-bottom: 0px;`
    },
    unreadMessagesCount () {
      // Retorna o número de mensagens não lidas do ticket atual
      if (!this.ticketFocado || !this.ticketFocado.unreadMessages) {
        return 0
      }
      return this.ticketFocado.unreadMessages
    }
  },
  watch: {
    mensagensTicket () {
      this.replyingMessage = null
    },
    replyingMessage (newVal, oldVal) {
      // Watcher para replyingMessage - pode ser usado para futuras funcionalidades
    }
  },
  methods: {
    async onResizeInputMensagem (size) {
      this.heigthInputMensagem = size.height
    },
    async loadMoreMessages () {
      if (this.loading) return

      if (!this.hasMore || !this.ticketFocado?.id) {
        return
      }

      try {
        this.loading = true
        this.params.ticketId = this.ticketFocado.id
        this.params.pageNumber += 1
        await this.$store.dispatch('LocalizarMensagensTicket', this.params)
      } catch (error) {
        console.error('Erro ao carregar mais mensagens:', error)
      } finally {
        this.loading = false
      }
    },
    scrollArea (e) {
      this.hideOptions = true
      setTimeout(() => {
        if (!e) return
        this.scrollIcon = (e.verticalSize - (e.verticalPosition + e.verticalContainerSize)) > 300

        // Verificar se o usuário rolou manualmente para o final da conversa
        const distanceFromBottom = e.verticalSize - (e.verticalPosition + e.verticalContainerSize)
        const isAtBottom = distanceFromBottom <= 50 // 50px de tolerância

        // Se chegou ao final e há mensagens não lidas, marcar como lidas
        if (isAtBottom && this.ticketFocado?.unreadMessages > 0) {
          // Debounce para evitar múltiplas chamadas
          if (this.scrollReadTimeout) {
            clearTimeout(this.scrollReadTimeout)
          }

          this.scrollReadTimeout = setTimeout(() => {
            this.markUnreadMessagesAsRead()
          }, 500)
        }
      }, 200)
    },
    scrollToBottom () {
      document.getElementById('fimListaMensagensChat').scrollIntoView()
      // Marcar mensagens como lidas quando o usuário clicar na seta para ir ao final
      this.markUnreadMessagesAsRead()
    },
    async markUnreadMessagesAsRead () {
      if (!this.ticketFocado || !this.ticketFocado.id) return
      if (this.loading) return

      // NÃO marcar mensagens como lidas se o ticket estiver com status 'pending'
      if (this.ticketFocado.status === 'pending') {
        return
      }

      // Verificar se realmente há mensagens não lidas
      if (!this.ticketFocado.unreadMessages || this.ticketFocado.unreadMessages === 0) {
        return
      }

      this.loading = true
      try {
        await this.$axios.post(`/api/tickets/${this.ticketFocado.id}/read`)

        // Atualizar o estado local
        this.$store.commit('UPDATE_TICKET_UNREAD_MESSAGES', {
          type: 'open',
          ticket: {
            ...this.ticketFocado,
            unreadMessages: 0
          }
        })
      } catch (err) {
        console.error('[Chat] Erro ao marcar mensagens como lidas:', err)
      } finally {
        this.loading = false
      }
    },
    abrirModalEncaminharMensagem (msg) {
      this.mensagemEncaminhamento = msg
      this.modalEncaminhamentoMensagem = true
    },
    async localizarContato (search, update, abort) {
      if (search.length < 2) {
        if (this.contatos.length) update(() => { this.contatos = [...this.contatos] })
        abort()
        return
      }
      this.loading = true
      const { data } = await ListarContatos({
        searchParam: search
      })

      update(() => {
        if (data.contacts.length) {
          this.contatos = data.contacts
        } else {
          this.contatos = [{}]
        }
      })
      this.loading = false
    },
    cancelarMultiEncaminhamento () {
      this.mensagensParaEncaminhar = []
      this.ativarMultiEncaminhamento = false
    },
    confirmarEncaminhamentoMensagem (data) {
      if (!this.contatoSelecionado.id) {
        this.$notificarErro('Selecione o contato de destino das mensagens.')
        return
      }
      EncaminharMensagem(data, this.contatoSelecionado)
        .then(r => {
          this.$notificarSucesso(`Mensagem encaminhada para ${this.contatoSelecionado.name} | Número: ${this.contatoSelecionado.number}`)
          this.mensagensParaEncaminhar = []
          this.ativarMultiEncaminhamento = false
        })
        .catch(e => {
          this.$notificarErro('Não foi possível encaminhar mensagem. Tente novamente em alguns minutos!', e)
        })
    }
  },
  created () {
    this.$eventBus.on('scrollToBottomMessageChat', this.scrollToBottom)
    this.socketTicket()
  },
  mounted () {
    this.socketMessagesList()
  },
  destroyed () {
    this.$eventBus.off('scrollToBottomMessageChat', this.scrollToBottom)
    // Limpar timeout se existir
    if (this.scrollReadTimeout) {
      clearTimeout(this.scrollReadTimeout)
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-container {
  height: 100vh;
  overflow: hidden !important;
  position: relative;
}

body.body--light .chat-container {
  background-color: #ede7dc !important;
}

.wa-bg-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image: url('../../../public/background.png');
  background-size: 710px;
  background-repeat: repeat;
  background-position: center;
  pointer-events: none;
}

body.body--light .wa-bg-overlay {
  opacity: 1 !important;
}

body.body--light .wa-bg-color {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: #ede7dc;
  opacity: 0.85;
  pointer-events: none;
  mix-blend-mode: lighten;
}

body.body--dark .wa-bg-overlay {
  opacity: 0.06 !important;
}

.input-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  border: none !important;
  box-shadow: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Adiciona padding bottom ao scroll area para compensar o input fixo */
:deep(.q-scrollarea__content) {
  padding-bottom: 0 !important;
}

/* Garante que o último elemento das mensagens tenha espaçamento correto */
:deep(.q-scrollarea__content > *:last-child) {
  margin-bottom: 0 !important;
  padding-bottom: 0 !important;
}

/* Garante que o q-scroll-area ocupe o espaço correto */
:deep(.q-scrollarea) {
  position: relative !important;
  z-index: 1 !important;
}

:deep(.q-scrollarea__container) {
  position: relative !important;
}

/* Estado vazio centralizado */
.empty-state-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.empty-state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.empty-icon {
  margin-bottom: 20px;
}

.empty-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 400;
}

/* Responsivo */
@media (max-width: 599px) {
  .empty-title {
    font-size: 1.25rem;
  }

  .empty-icon {
    font-size: 4em !important;
  }
}

/* Preserva todos os estilos originais */
audio {
  height: 40px;
  width: 264px;
}

.mostar-btn-opcoes-chat {
  display: none;
  transition: width 2s transform 2s;
}

.q-message-text:hover .mostar-btn-opcoes-chat {
  display: block;
  float: right;
  position: absolute;
  z-index: 999;
}

.hr-text {
  line-height: 1em;
  position: relative;
  outline: 0;
  border: 0;
  color: black;
  text-align: center;
  height: 1.5em;
  opacity: 0.8;

  &:before {
    content: "";
    background: linear-gradient(to right, transparent, #818078, transparent);
    position: absolute;
    left: 0;
    top: 50%;
    width: 100%;
    height: 1px;
  }

  &:after {
    content: attr(data-content);
    position: relative;
    display: inline-block;
    color: black;
    font-size: 16px;
    font-weight: 600;
    padding: 0 0.5em;
    line-height: 1.5em;
    background-color: #f5f5f5;
    border-radius: 15px;
  }
}

body.body--dark .hr-text:after {
  background-color: #2d2d2d;
  color: white;
}

.textContentItem {
  overflow-wrap: break-word;
}

.textContentItemDeleted {
  font-style: italic;
  color: rgba(0, 0, 0, 0.36);
  overflow-wrap: break-word;
}

body.body--dark .textContentItemDeleted {
  color: rgba(255, 255, 255, 0.4);
}

.replyginContactMsgSideColor {
  flex: none;
  width: 4px;
  background-color: #35cd96;
}

.replyginSelfMsgSideColor {
  flex: none;
  width: 4px;
  background-color: #6bcbef;
}

.replyginMsgBody {
  padding: 10px;
  height: auto;
  display: block;
  white-space: pre-wrap;
  overflow: hidden;
}

.messageContactName {
  display: flex;
  color: #6bcbef;
  font-weight: 500;
}

.scroll-to-bottom-container {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 99;
}

.vac-icon-scroll {
  box-shadow: 0 1px 1px -1px rgba(0, 0, 0, 0.2), 0 1px 1px 0 rgba(0, 0, 0, 0.14),
    0 1px 2px 0 rgba(0, 0, 0, 0.12);
  display: flex;
  cursor: pointer;
  position: relative;
}

.unread-count-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
