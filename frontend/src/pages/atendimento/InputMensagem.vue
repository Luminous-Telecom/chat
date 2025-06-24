<template>
  <div>
    <!-- Interface normal de chat para tickets não pending -->
    <template v-if="ticketFocado.status !== 'pending'">
      <div
        class="row absolute-full fit col-12"
        ref="menuFast"
      >
        <q-menu
          :target="$refs.menuFast"
          :key="`menu-${cMensagensRapidas.length}`"
          square
          no-focus
          no-parent-event
          class="no-box-shadow no-shadow"
          fit
          :offset="[0, 5]"
          persistent
          max-height="400px"
          @hide="visualizarMensagensRapidas = false"
          :value="textChat.startsWith('/') || visualizarMensagensRapidas"
        >
          <q-list
            class="no-shadow no-box-shadow"
            style="min-width: 100px"
            separator
            v-if="!cMensagensRapidas.length"
          >
            <q-item>
              <q-item-section>
                <q-item-label class="text-negative text-bold">Ops... Nada por aqui!</q-item-label>
                <q-item-label caption>Cadastre suas mensagens na administração de sistema.</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <q-list
            class="no-shadow no-box-shadow"
            style="min-width: 100px"
            separator
            v-else
          >
            <q-item
              v-for="(resposta, index) in cMensagensRapidas"
              :key="`resposta-${index}-${resposta.id || resposta.key}`"
              clickable
              v-close-popup
              @click="mensagemRapidaSelecionada(resposta.message)"
            >
              <q-item-section>
                <q-item-label class="text-bold"> {{ resposta.key }} </q-item-label>
                <q-item-label
                  caption
                  lines="2"
                > {{ resposta.message }} </q-item-label>
              </q-item-section>
              <q-tooltip content-class="bg-padrao text-grey-9 text-bold">
                {{ resposta.message }}
              </q-tooltip>
            </q-item>
          </q-list>
        </q-menu>
      </div>

      <div
        style="padding-top: 10px; padding-bottom: 10px"
        class="row bg-white justify-start items-center text-grey-9 relative-position"
      >
        <div
          class="row col-12 q-pa-sm"
          v-if="isScheduleDate"
        >
          <q-datetime-picker
            style="width: 300px"
            dense
            rounded
            hide-bottom-space
            outlined
            stack-label
            bottom-slots
            label="Data/Hora Agendamento"
            mode="datetime"
            color="primary"
            v-model="scheduleDate"
            format24h
          />
        </div>

        <template v-if="!isRecordingAudio">

          <q-input
            hide-bottom-space
            :loading="loading"
            :disable="cDisableActions"
            ref="inputEnvioMensagem"
            id="inputEnvioMensagem"
            type="textarea"
            placeholder="Mensagem"
            input-style="background: rgba(255,255,255,0.12); border: none; border-radius: 18px; padding: 10px 16px; font-size: 15px; color: var(--text-color-primary); box-shadow: 0 1px 4px rgba(0,0,0,0.04); transition: box-shadow 0.2s, background 0.2s;"
            autogrow
            rounded
            dense
            outlined
            v-model="textChat"
            :value="textChat"
            @keydown.exact.enter.prevent="() => textChat.trim().length ? enviarMensagem() : ''"
            @keydown.shift.enter.stop=""
            v-show="!cMostrarEnvioArquivo"
            class="col-grow q-mx-xs text-grey-10 inputEnvioMensagem"
            bg-color="grey-2"
            :maxlength="4096"
            :color="textChat.length > 3500 ? 'warning' : textChat.length > 4000 ? 'negative' : 'grey-7'"
          >
            <template v-slot:prepend>
              <q-btn
                flat
                icon="mdi-emoticon-happy-outline"
                :disable="cDisableActions"
                dense
                round
                :color="$q.dark.isActive ? 'white' : ''"
                @click="saveCursorPosition"
              >
                <q-tooltip content-class="text-bold">Emoji</q-tooltip>
                <q-menu
                  v-model="showEmojiPicker2"
                  anchor="top right"
                  self="bottom middle"
                  :offset="[5, 40]"
                  :auto-close="false"
                  persistent
                  ref="emojiPicker2"
                >
                  <Picker
                    :theme="pickerTheme"
                    :key="pickerTheme"
                    :locale="'pt'"
                    :previewPosition="'none'"
                    :perLine="9"
                    :showPreview="false"
                    :showSkinTones="true"
                    :showCategoryButtons="true"
                    :showSearch="true"
                    style="width: 420px"
                    @select="onEmojiSelectMart"
                    @click.stop.prevent
                  />
                </q-menu>
              </q-btn>
              <q-btn
                flat
                icon="mdi-paperclip"
                :disable="cDisableActions"
                dense
                round
                :color="$q.dark.isActive ? 'white' : ''"
                @click="abrirEnvioArquivo"
              >
                <q-tooltip content-class="text-bold">Enviar arquivo</q-tooltip>
              </q-btn>
              <q-btn
                dense
                flat
                round
                icon="mdi-message-flash-outline"
                @click="visualizarMensagensRapidas = !visualizarMensagensRapidas"
              >
                <q-tooltip content-class="text-bold">Mensagens Rápidas</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="mdi-message-video"
                :disable="cDisableActions"
                :color="$q.dark.isActive ? 'white' : ''"
                @click="handlSendLinkVideo"
              >
                <q-tooltip content-class="text-bold">Enviar link para videoconferência</q-tooltip>
              </q-btn>
              <q-toggle
                keep-color
                v-model="sign"
                dense
                @input="handleSign"
                class="q-ml-md"
                :color="sign ? 'positive' : 'black'"
                type="toggle"
              >
                <q-tooltip>{{ sign ? 'Desativar' : 'Ativar' }} Assinatura</q-tooltip>
              </q-toggle>
            </template>
            <template v-slot:append>
              <q-btn
                v-if="textChat || cMostrarEnvioArquivo"
                ref="btnEnviarMensagem"
                @click="enviarMensagem"
                :disabled="ticketFocado.status !== 'open'"
                flat
                icon="mdi-send"
                class="bg-padrao btn-rounded q-mx-xs"
                :color="$q.dark.isActive ? 'white' : ''"
              >
                <q-tooltip content-class=" text-bold">Enviar Mensagem</q-tooltip>
              </q-btn>
              <q-btn
                v-if="!textChat && !cMostrarEnvioArquivo && !isRecordingAudio"
                @click="handleSartRecordingAudio"
                :disabled="cDisableActions"
                flat
                icon="mdi-microphone"
                class="bg-padrao btn-rounded q-mx-xs"
                :color="$q.dark.isActive ? 'white' : ''"
              >
                <q-tooltip content-class="text-bold">Gravar Áudio</q-tooltip>
              </q-btn>
            </template>
          </q-input>
          <!-- tamanho maximo por arquivo de 10mb -->
          <q-file
            :loading="loading"
            :disable="cDisableActions"
            ref="PickerFileMessage"
            id="PickerFileMessage"
            v-show="cMostrarEnvioArquivo"
            v-model="arquivos"
            class="col-grow q-mx-xs PickerFileMessage"
            bg-color="blue-grey-1"
            input-style="max-height: 30vh"
            outlined
            use-chips
            multiple
            autogrow
            dense
            rounded
            append
            :max-files="5"
            :max-file-size="15485760"
            :max-total-size="15485760"
            accept=".txt, .xml, .jpg, .png, image/jpeg, .pdf, .doc, .docx, .mp4, .xls, .xlsx, .jpeg, .zip, .ppt, .pptx, .mp3, .wav, .ogg, .m4a, audio/*, image/*"
            @rejected="onRejectedFiles"
          />

        </template>
        <template v-else>
          <div class="full-width items-center row justify-end ">
            <q-skeleton
              animation="pulse-y"
              class="col-grow q-mx-md"
              type="text"
            />
                                       <div
                style="width: 120px"
                class="flex flex-center items-center q-pa-xs recording-controls"
                :class="{ 'bg-grey-1': !$q.dark.isActive, 'bg-grey-8': $q.dark.isActive }"
                v-if="isRecordingAudio"
              >
               <q-btn
                 @click="handleStopRecordingAudio"
                 flat
                 dense
                 size="sm"
                 icon="mdi-stop"
                 class="btn-rounded q-mx-xs"
                 color="negative"
               >
                 <q-tooltip content-class="text-bold">
                   Parar
                 </q-tooltip>
               </q-btn>
               <q-btn
                 @click="handleCancelRecordingAudio"
                 flat
                 dense
                 size="sm"
                 icon="mdi-close"
                 class="btn-rounded q-mx-xs"
                 color="grey-7"
               >
                 <q-tooltip content-class="text-bold">
                   Cancelar
                 </q-tooltip>
               </q-btn>
                               <RecordingTimer
                  class="text-caption"
                  :class="{ 'text-grey-7': !$q.dark.isActive, 'text-grey-5': $q.dark.isActive }"
                />
             </div>
          </div>
        </template>

        <q-dialog
          v-model="abrirModalPreviewImagem"
          position="right"
          @hide="hideModalPreviewImagem"
          @show="showModalPreviewImagem"
        >
          <q-card
            style="height: 90vh; min-width: 60vw; max-width: 60vw"
            class="q-pa-md"
          >
            <q-card-section>
              <div class="text-h6">{{ urlMediaPreview.title }}
                <q-btn
                  class="float-right"
                  icon="close"
                  color="negative"
                  round
                  outline
                  @click="hideModalPreviewImagem"
                />
              </div>
            </q-card-section>
            <q-card-section>
              <q-img
                :src="urlMediaPreview.src"
                spinner-color="white"
                class="img-responsive mdi-image-auto-adjust q-uploader__file--img"
                style="height: 60vh; min-width: 55vw; max-width: 55vw"
              />
            </q-card-section>
            <q-card-actions align="center">
              <q-btn
                ref="qbtnPasteEnvioMensagem"
                label="Enviar"
                color="primary"
                v-close-popup
                @click="enviarMensagem"
                @keypress.enter.exact="enviarMensagem()"
              />
            </q-card-actions>
            <span class="row col text-caption text-blue-grey-10">* Confirmar envio: Enter</span>
            <span class="row col text-caption text-blue-grey-10">** Cancelar: ESC</span>
          </q-card>
        </q-dialog>
      </div>
    </template>

    <!-- Debug info -->
    <div v-if="$route.query.debug" class="q-pa-sm bg-orange-1">
      <small>Debug: Status = {{ ticketFocado.status }}, ID = {{ ticketFocado.id }}</small>
    </div>

  </div>
</template>

<script>
import { LocalStorage, uid } from 'quasar'
import mixinCommon from './mixinCommon'
import { EnviarMensagemTexto } from 'src/service/tickets'
import { mapGetters } from 'vuex'
import RecordingTimer from './RecordingTimer'
import MicRecorder from 'mic-recorder-to-mp3'
import { Picker } from 'emoji-mart-vue'
import 'emoji-mart-vue/css/emoji-mart.css'
import mixinAtualizarStatusTicket from './mixinAtualizarStatusTicket'
import { insertEmojiInTextarea } from 'src/utils/emojiUtils'

const Mp3Recorder = new MicRecorder({
  bitRate: 128,
  sampleRate: 44100
})

export default {
  name: 'InputMensagem',
  mixins: [mixinAtualizarStatusTicket, mixinCommon],
  props: {
    replyingMessage: {
      type: Object,
      default: null
    },
    isScheduleDate: {
      type: Boolean,
      default: false
    },
    mensagensRapidas: {
      type: Array,
      default: () => []
    }
  },
  components: {
    RecordingTimer,
    Picker
  },
  data () {
    return {
      loading: false,
      abrirFilePicker: false,
      abrirModalPreviewImagem: false,
      isRecordingAudio: false,
      hasMicrophonePermission: false,
      urlMediaPreview: {
        title: '',
        src: ''
      },
      visualizarMensagensRapidas: false,
      arquivos: [],
      textChat: '',
      sign: false,
      scheduleDate: null,
      showEmojiPicker1: false,
      showEmojiPicker2: false,
      savedCursorPosition: undefined
    }
  },
  computed: {
    ...mapGetters(['ticketFocado']),
    cMostrarEnvioArquivo () {
      return this.arquivos.length > 0
    },
    cDisableActions () {
      return (this.isRecordingAudio || this.ticketFocado.status !== 'open')
    },
    cMensagensRapidas () {
      let search = this.textChat?.toLowerCase()
      if (search && search.trim().startsWith('/')) {
        search = search.replace('/', '')
      }
      return !search ? this.mensagensRapidas : this.mensagensRapidas.filter(r => r.key.toLowerCase().indexOf(search) !== -1)
    },
    pickerTheme () {
      return this.$q.dark.isActive ? 'dark' : 'light'
    }
  },
  watch: {
    // Observar mudanças no status do ticket
    'ticketFocado.status': {
      handler (newStatus, oldStatus) {
        if (newStatus === 'pending') {
        } else if (newStatus === 'open' && oldStatus !== 'open') {
          // Quando o ticket for aberto (mudança de status para 'open'), focar o input
          this.$nextTick(() => {
            setTimeout(() => {
              if (this.$refs.inputEnvioMensagem) {
                this.$refs.inputEnvioMensagem.focus()
              }
            }, 300)
          })
        }
      },
      immediate: true
    },
    // Observar mudanças no ticket inteiro
    ticketFocado: {
      handler (newTicket, oldTicket) {
        if (newTicket.id !== oldTicket?.id) {
          // Quando um novo ticket é selecionado, focar o input automaticamente
          this.$nextTick(() => {
            setTimeout(() => {
              if (this.$refs.inputEnvioMensagem && newTicket.status === 'open') {
                this.$refs.inputEnvioMensagem.focus()
              }
            }, 300)
          })
        }
      },
      deep: true
    }
  },
  methods: {
    openFilePreview (event) {
      const data = event.clipboardData.files[0]
      const urlImg = window.URL.createObjectURL(data)
      return urlImg
    },
    handleInputPaste (e) {
      if (!this.ticketFocado?.id) return
      if (e.clipboardData.files[0]) {
        this.textChat = ''
        this.arquivos = [e.clipboardData.files[0]]
        this.abrirModalPreviewImagem = true
        this.urlMediaPreview = {
          title: `Enviar imagem para ${this.ticketFocado?.contact?.name}`,
          src: this.openFilePreview(e)
        }
        this.$refs.inputEnvioMensagem.focus()
      }
    },
    // Método para fechar o modal de emojis quando clicar fora
    handleClickOutsideEmojiPicker (event) {
      // Verificar se o clique foi fora do modal de emojis
      const emojiPicker1 = this.$refs.emojiPicker1
      const emojiPicker2 = this.$refs.emojiPicker2

      // Verificar se o clique foi no botão que abre o emoji picker
      const isEmojiButton = event.target.closest('.q-btn') &&
                           (event.target.closest('.q-btn').querySelector('.mdi-emoticon-happy-outline') ||
                            event.target.closest('.q-btn').querySelector('[data-testid="emoji-button"]'))

      // Verificar se o clique foi dentro do emoji picker
      const isInsideEmojiPicker = (emojiPicker1 && emojiPicker1.$el && emojiPicker1.$el.contains(event.target)) ||
                                 (emojiPicker2 && emojiPicker2.$el && emojiPicker2.$el.contains(event.target))

      // Verificar se o clique foi em elementos específicos do emoji picker
      const isEmojiPickerElement = event.target.closest('emoji-picker') ||
                                  event.target.closest('.emoji-mart') ||
                                  event.target.closest('.emoji-mart-emoji') ||
                                  event.target.closest('.emoji-mart-category') ||
                                  event.target.closest('.emoji-mart-search') ||
                                  event.target.closest('.emoji-mart-scroll') ||
                                  event.target.closest('.emoji-mart-category-label') ||
                                  event.target.closest('.emoji-mart-preview') ||
                                  event.target.closest('.emoji-mart-skin-swatches') ||
                                  event.target.closest('button[data-emoji]') ||
                                  event.target.closest('[data-emoji]') ||
                                  event.target.closest('.emoji') ||
                                  event.target.closest('.emoji-picker') ||
                                  event.target.closest('.emoji-picker-element')

      // Se clicou fora do emoji picker, não foi no botão e não foi em elementos do emoji picker, fechar os modais
      if (!isInsideEmojiPicker && !isEmojiButton && !isEmojiPickerElement) {
        this.showEmojiPicker1 = false
        this.showEmojiPicker2 = false
      }
    },
    saveCursorPosition () {
      // Salvar a posição atual do cursor antes de abrir o emoji picker
      const textarea = this.$refs.inputEnvioMensagem
      if (textarea && textarea.$el && textarea.$el.querySelector('textarea')) {
        const textareaElement = textarea.$el.querySelector('textarea')
        this.savedCursorPosition = textareaElement.selectionStart
      }
    },
    mensagemRapidaSelecionada (mensagem) {
      this.textChat = mensagem
      setTimeout(() => {
        this.$refs.inputEnvioMensagem.focus()
      }, 300)
    },
    onEmojiSelectMart (emoji, event) {
      try {
        // Prevent event propagation to avoid closing the modal
        if (event) {
          event.stopPropagation()
          event.preventDefault()
        }

        const textarea = this.$refs.inputEnvioMensagem

        // Garantir que o textarea tenha foco antes de inserir o emoji
        textarea.focus()

        // Restaurar posição do cursor salva ou definir para o final se não houver posição salva
        if (this.savedCursorPosition !== undefined) {
          textarea.selectionStart = textarea.selectionEnd = this.savedCursorPosition
        } else if (this.textChat.length > 0) {
          // Se não há posição salva e há texto, inserir no final
          textarea.selectionStart = textarea.selectionEnd = this.textChat.length
        }

        const success = insertEmojiInTextarea(
          emoji,
          textarea,
          (newValue) => {
            this.textChat = newValue
          },
          this.textChat
        )

        if (!success) {
          this.$q.notify({
            type: 'warning',
            message: 'Erro ao inserir emoji. Tente novamente.',
            position: 'bottom-right',
            timeout: 3000
          })
        }

        // Limpar posição salva após usar
        this.savedCursorPosition = undefined
      } catch (error) {
        console.error('Erro ao inserir emoji:', error)
      }
    },
    abrirEnvioArquivo (event) {
      this.textChat = ''
      this.abrirFilePicker = true
      this.$refs.PickerFileMessage.pickFiles(event)
    },
    async handleSartRecordingAudio () {
      if (!this.hasMicrophonePermission) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          this.hasMicrophonePermission = true
          // Parar o stream imediatamente após obter a permissão
          stream.getTracks().forEach(track => track.stop())
        } catch (error) {
          console.error('Erro ao acessar microfone:', error)
          this.$q.notify({
            type: 'negative',
            message: 'Não foi possível acessar o microfone. Verifique se o microfone está conectado e se as permissões foram concedidas.',
            position: 'bottom-right',
            timeout: 5000
          })
          return
        }
      }

      try {
        await Mp3Recorder.start()
        this.isRecordingAudio = true
        this.$q.notify({
          type: 'positive',
          message: 'Gravação iniciada',
          position: 'bottom-right',
          timeout: 1000
        })
      } catch (error) {
        console.error('Erro ao iniciar gravação:', error)
        this.isRecordingAudio = false
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao iniciar a gravação. Tente novamente.',
          position: 'bottom-right',
          timeout: 3000
        })
      }
    },
    async handleStopRecordingAudio () {
      this.loading = true
      try {
        const [, blob] = await Mp3Recorder.stop().getMp3()
        if (blob.size < 10000) {
          this.loading = false
          this.isRecordingAudio = false
          return
        }

        const formData = new FormData()
        // Usar formato consistente para nome do arquivo
        const timestamp = new Date().getTime()
        const filename = `audio_${timestamp}.mp3`
        formData.append('medias', blob, filename)
        formData.append('body', filename) // Usar o mesmo nome no body
        formData.append('fromMe', true)
        formData.append('id', uid())
        if (this.isScheduleDate) {
          formData.append('scheduleDate', this.scheduleDate)
        }
        const ticketId = this.ticketFocado.id
        await EnviarMensagemTexto(ticketId, formData)
        this.arquivos = []
        this.textChat = ''
        this.$emit('update:replyingMessage', null)
        this.abrirFilePicker = false
        this.abrirModalPreviewImagem = false
        this.isRecordingAudio = false
        this.loading = false
        setTimeout(() => {
          this.scrollToBottom()
        }, 300)
      } catch (error) {
        this.isRecordingAudio = false
        this.loading = false
        this.$notificarErro('Ocorreu um erro!', error)
      }
    },
    async handleCancelRecordingAudio () {
      try {
        await Mp3Recorder.stop().getMp3()
        this.isRecordingAudio = false
        this.loading = false
      } catch (error) {
        this.$notificarErro('Ocorreu um erro!', error)
      }
    },
    prepararUploadMedia () {
      if (!this.arquivos.length) {
        throw new Error('Não existem arquivos para envio')
      }
      const formData = new FormData()
      formData.append('fromMe', true)
      formData.append('id', uid())
      if (this.replyingMessage?.id) {
        formData.append('quotedMsgId', this.replyingMessage.id)
      }
      this.arquivos.forEach(media => {
        formData.append('medias', media)
        formData.append('body', media.name)
        if (this.isScheduleDate) {
          formData.append('scheduleDate', this.scheduleDate)
        }
      })
      return formData
    },
    prepararMensagemTexto () {
      if (this.textChat.trim() === '') {
        throw new Error('Mensagem Inexistente')
      }

      // Verificar se a mensagem é muito grande
      const maxLength = 4096 // Limite do WhatsApp
      if (this.textChat.trim().length > maxLength) {
        this.$q.notify({
          html: true,
          message: `Mensagem muito grande! <br>
          <ul>
            <li>Limite máximo: ${maxLength} caracteres</li>
            <li>Sua mensagem: ${this.textChat.trim().length} caracteres</li>
            <li>Excesso: ${this.textChat.trim().length - maxLength} caracteres</li>
          </ul>
          <strong>Dica:</strong> Divida sua mensagem em partes menores.`,
          type: 'warning',
          progress: true,
          position: 'bottom-right',
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
        throw new Error(`Mensagem muito grande. Máximo ${maxLength} caracteres permitidos.`)
      }

      if (this.textChat.trim() && this.textChat.trim().startsWith('/')) {
        let search = this.textChat.trim().toLowerCase()
        search = search.replace('/', '')
        const mensagemRapida = this.cMensagensRapidas.find(m => m.key.toLowerCase() === search)
        if (mensagemRapida?.message) {
          this.textChat = mensagemRapida.message
        } else {
          const error = this.cMensagensRapidas.length > 1
            ? 'Várias mensagens rápidas encontradas. Selecione uma ou digite uma chave única da mensagem.'
            : '/ indica que você deseja enviar uma mensagem rápida, mas nenhuma foi localizada. Cadastre ou apague a / e digite sua mensagem.'
          this.$notificarErro(error)
          this.loading = false
          throw new Error(error)
        }
      }
      let mensagem = this.textChat.trim()
      const username = localStorage.getItem('username')
      if (username && this.sign) {
        mensagem = `*${username}*:\n ${mensagem}`
      }
      const message = {
        read: 1,
        fromMe: true,
        mediaUrl: '',
        body: mensagem,
        scheduleDate: this.isScheduleDate ? this.scheduleDate : null,
        quotedMsg: this.replyingMessage,
        quotedMsgId: this.replyingMessage?.id || null,
        id: uid()
      }
      if (this.isScheduleDate) {
        message.scheduleDate = this.scheduleDate
      }
      return message
    },
    async enviarMensagem () {
      if (this.isScheduleDate && !this.scheduleDate) {
        this.$notificarErro('Para agendar uma mensagem, informe o campo Data/Hora Agendamento.')
        return
      }
      this.loading = true
      const ticketId = this.ticketFocado.id
      const message = !this.cMostrarEnvioArquivo
        ? this.prepararMensagemTexto()
        : this.prepararUploadMedia()
      try {
        if (!this.cMostrarEnvioArquivo && !this.textChat) return
        await EnviarMensagemTexto(ticketId, message)
        this.arquivos = []
        this.textChat = ''
        this.$emit('update:replyingMessage', null)
        this.abrirFilePicker = false
        this.abrirModalPreviewImagem = false
        setTimeout(() => {
          this.scrollToBottom()
        }, 300)
      } catch (error) {
        this.isRecordingAudio = false
        this.loading = false
        this.$notificarErro('Ocorreu um erro!', error)
      }
      this.isRecordingAudio = false
      this.loading = false
      setTimeout(() => {
        this.$refs.inputEnvioMensagem.focus()
      }, 300)
    },
    async handlSendLinkVideo () {
      const link = `https://meet.jit.si/${uid()}/${uid()}`
      let mensagem = link
      const username = localStorage.getItem('username')
      if (username && this.sign) {
        mensagem = `*${username}*:\n ${mensagem}`
      }
      const message = {
        read: 1,
        fromMe: true,
        mediaUrl: '',
        body: mensagem,
        scheduleDate: this.isScheduleDate ? this.scheduleDate : null,
        quotedMsg: this.replyingMessage,
        quotedMsgId: this.replyingMessage?.id || null,
        id: uid()
      }

      this.loading = true
      const ticketId = this.ticketFocado.id
      try {
        await EnviarMensagemTexto(ticketId, message)
        setTimeout(() => {
          this.scrollToBottom()
        }, 200)
        setTimeout(() => {
          window.open(link, '_blank')
        }, 800)
      } catch (error) {
        this.loading = false
        this.$notificarErro('Ocorreu um erro!', error)
      }
      this.loading = false
    },
    handlerInputMensagem (v) {
      this.textChat = v.target.value
    },
    showModalPreviewImagem () {
      this.$nextTick(() => {
        setTimeout(() => {
          this.$refs.qbtnPasteEnvioMensagem.$el.focus()
        }, 20)
      })
    },
    hideModalPreviewImagem () {
      this.arquivos = []
      this.urlMediaPreview = {}
      this.abrirModalPreviewImagem = false
    },
    onRejectedFiles (rejectedEntries) {
      this.$q.notify({
        html: true,
        message: `Ops... Ocorreu um erro! <br>
        <ul>
          <li>Cada arquivo deve ter no máximo 10MB.</li>
          <li>Em caso de múltiplos arquivos, o tamanho total (soma de todos) deve ser de até 30MB.</li>
        </ul>`,
        type: 'negative',
        progress: true,
        position: 'bottom-right',
        actions: [{
          icon: 'close',
          round: true,
          color: 'white'
        }]
      })
    },
    handleSign (state) {
      this.sign = state
      LocalStorage.set('sign', this.sign)
    },
    // Método para limpar cache de permissão do microfone (útil para logout)
    clearMicrophonePermissionCache () {
      localStorage.removeItem('microphonePermissionChecked')
      localStorage.removeItem('microphonePermissionGranted')
      this.hasMicrophonePermission = false
    }
  },
  async mounted () {
    // Verificar permissão do microfone apenas uma vez por sessão
    const microphonePermissionChecked = localStorage.getItem('microphonePermissionChecked')
    const microphonePermissionGranted = localStorage.getItem('microphonePermissionGranted')

    if (microphonePermissionChecked === 'true') {
      // Se já verificou nesta sessão, apenas restaurar o status
      this.hasMicrophonePermission = microphonePermissionGranted === 'true'
    } else {
      // Primeira verificação da sessão
      try {
        // Verificar se o navegador suporta mediaDevices
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          // Fallback para navegadores mais antigos
          navigator.mediaDevices = {}
          navigator.mediaDevices.getUserMedia = function (constraints) {
            const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia
            if (!getUserMedia) {
              return Promise.reject(new Error('getUserMedia não é suportado neste navegador'))
            }
            return new Promise((resolve, reject) => {
              getUserMedia.call(navigator, constraints, resolve, reject)
            })
          }
        }

        // Verificar se o navegador suporta enumerateDevices
        if (!navigator.mediaDevices.enumerateDevices) {
          navigator.mediaDevices.enumerateDevices = function () {
            return Promise.resolve([])
          }
        }

        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasAudioInput = devices.some(device => device.kind === 'audioinput')

        if (!hasAudioInput) {
          // Se não conseguir enumerar dispositivos, tenta solicitar permissão diretamente
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            this.hasMicrophonePermission = true
            localStorage.setItem('microphonePermissionGranted', 'true')
            stream.getTracks().forEach(track => track.stop())
          } catch (err) {
            this.hasMicrophonePermission = false
            localStorage.setItem('microphonePermissionGranted', 'false')
            this.$q.notify({
              type: 'warning',
              message: 'Nenhum microfone detectado ou permissão não concedida',
              position: 'bottom-right',
              timeout: 5000
            })
          }
        } else {
          // Se conseguiu enumerar dispositivos, solicita permissão
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            this.hasMicrophonePermission = true
            localStorage.setItem('microphonePermissionGranted', 'true')
            stream.getTracks().forEach(track => track.stop())
          } catch (err) {
            console.error('Erro ao solicitar permissão do microfone:', err)
            this.hasMicrophonePermission = false
            localStorage.setItem('microphonePermissionGranted', 'false')
            this.$q.notify({
              type: 'warning',
              message: 'Permissão do microfone não concedida. Por favor, verifique as configurações do seu navegador.',
              position: 'bottom-right',
              timeout: 5000
            })
          }
        }

        // Marcar que a verificação foi feita nesta sessão
        localStorage.setItem('microphonePermissionChecked', 'true')
      } catch (error) {
        console.error('Erro ao verificar microfone:', error)
        this.hasMicrophonePermission = false
        localStorage.setItem('microphonePermissionGranted', 'false')
        localStorage.setItem('microphonePermissionChecked', 'true')
        this.$q.notify({
          type: 'warning',
          message: 'Não foi possível acessar o microfone. Verifique se o navegador suporta esta funcionalidade.',
          position: 'bottom-right',
          timeout: 5000
        })
      }
    }

    // Restaurar o código original do mounted
    this.$root.$on('mensagem-chat:focar-input-mensagem', () => this.$refs.inputEnvioMensagem.focus())
    const self = this
    window.addEventListener('paste', self.handleInputPaste)

    // Adicionar event listener para fechar modal de emojis quando clicar fora
    document.addEventListener('click', this.handleClickOutsideEmojiPicker)

    if (![null, undefined].includes(LocalStorage.getItem('sign'))) {
      this.handleSign(LocalStorage.getItem('sign'))
    }

    // Autofocus inicial - se já há um ticket aberto quando o componente é montado
    this.$nextTick(() => {
      setTimeout(() => {
        if (this.ticketFocado?.id && this.ticketFocado.status === 'open' && this.$refs.inputEnvioMensagem) {
          this.$refs.inputEnvioMensagem.focus()
        }
      }, 500)
    })
  },
  beforeDestroy () {
    const self = this
    window.removeEventListener('paste', self.handleInputPaste)

    // Remover event listener para fechar modal de emojis
    document.removeEventListener('click', this.handleClickOutsideEmojiPicker)
  },
  destroyed () {
    this.$root.$off('mensagem-chat:focar-input-mensagem')
  }
}
</script>

<style lang="sass" scoped>
@media (max-width: 850px)
  .inputEnvioMensagem,
  .PickerFileMessage
    width: 150px

@media (min-width: 851px), (max-width: 1360px)
  .inputEnvioMensagem,
  .PickerFileMessage
    width: 200px !important

// Menu de gravação compacto e elegante
.recording-controls
  border-radius: 20px
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
  border: 1px solid rgba(0, 0, 0, 0.08)
  backdrop-filter: blur(10px)
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06)
  animation: slideInFade 0.3s ease-out

  &:hover
    transform: translateY(-1px)
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1)

// Modo escuro para o menu de gravação
.body--dark .recording-controls
  border-color: rgba(255, 255, 255, 0.08)
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3)

  &:hover
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4)

// Botões super compactos
.recording-controls .q-btn
  min-height: 24px !important
  min-width: 24px !important
  font-size: 12px !important
  margin: 0 2px !important

  .q-btn__wrapper
    padding: 2px !important

// Timer compacto
.recording-controls .text-caption
  margin-left: 6px
  font-size: 10px !important
  font-weight: 600
  letter-spacing: 0.5px

// Animação elegante de entrada
@keyframes slideInFade
  from
    opacity: 0
    transform: translateX(15px) scale(0.95)
  to
    opacity: 1
    transform: translateX(0) scale(1)
</style>
