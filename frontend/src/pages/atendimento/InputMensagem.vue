<template>
  <div>
    <!-- Interface normal de chat para tickets não pending -->
    <template v-if="ticketFocado.status !== 'pending'">
      <div
        v-if="textChat.startsWith('/') || visualizarMensagensRapidas"
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
        class="row justify-start items-center text-grey-9 relative-position"
      >
        <div
          class="row col-12 q-pa-sm"
          v-if="isScheduleDate"
        >
          <q-input
            style="width: 300px"
            dense
            rounded
            hide-bottom-space
            outlined
            stack-label
            bottom-slots
            label="Data/Hora Agendamento"
            color="primary"
            v-model="scheduleDate"
            readonly
          >
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="scheduleDate" mask="YYYY-MM-DD HH:mm">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Fechar" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
              <q-icon name="access_time" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-time v-model="scheduleDate" mask="YYYY-MM-DD HH:mm" format24h>
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Fechar" color="primary" flat />
                    </div>
                  </q-time>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>

                <template v-if="!isRecordingAudio">
          <!-- Input moderno estilo WhatsApp -->
          <div
            class="modern-input-container col-grow q-mx-xs"
            :class="{ 'modern-input-container--no-top-border': replyingMessage }"
            v-show="!cMostrarEnvioArquivo"
          >
            <!-- Botões da esquerda -->
            <div class="input-actions-left">
              <q-btn
                flat
                icon="mdi-emoticon-happy-outline"
                :disable="cDisableActions"
                dense
                round
                size="sm"
                color="grey-7"
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
                    @hide="onEmojiPickerHide"
                  >
                  <EmojiPicker
                    :theme="pickerTheme"
                    :locale="'pt'"
                    native
                    style="width: 420px"
                    @select="onEmojiSelectMart"
                    @click.stop.prevent
                  />
                  <div class="q-pa-sm text-center">
                    <q-btn
                      flat
                      dense
                      size="sm"
                      label="Fechar"
                      @click="showEmojiPicker2 = false"
                    />
                  </div>
                </q-menu>
              </q-btn>
              <q-btn
                flat
                icon="mdi-paperclip"
                :disable="cDisableActions"
                dense
                round
                size="sm"
                color="grey-7"
                @click="abrirEnvioArquivo"
              >
                <q-tooltip content-class="text-bold">Enviar arquivo</q-tooltip>
              </q-btn>
              <q-btn
                dense
                flat
                round
                size="sm"
                icon="mdi-message-flash-outline"
                color="grey-7"
                @click="visualizarMensagensRapidas = !visualizarMensagensRapidas"
              >
                <q-tooltip content-class="text-bold">Mensagens Rápidas</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="mdi-message-video"
                :disable="cDisableActions"
                color="grey-7"
                @click="handlSendLinkVideo"
              >
                <q-tooltip content-class="text-bold">Enviar link para videoconferência</q-tooltip>
              </q-btn>
            </div>

            <!-- Input moderno com suporte a emojis -->
            <div class="input-field-wrapper">
              <div
                ref="inputEnvioMensagem"
                id="inputEnvioMensagem"
                contenteditable="true"
                :class="['modern-textarea', 'emoji-input']"
                :data-placeholder="cDisableActions ? '' : 'Mensagem'"
                :data-disabled="cDisableActions"
                :data-maxlength="4096"
                @keydown.enter.exact.prevent="handleEnterKey"
                @keydown.enter.shift.stop=""
                @input="handleContentEditableInput"
                @paste="handlePaste"
                @blur="handleContentEditableBlur"
                @focus="handleContentEditableFocus"
              ></div>

              <!-- Contador de caracteres -->
              <div
                v-if="textChat.length > 3500"
                class="char-counter"
                :class="{
                  'text-warning': textChat.length > 3500 && textChat.length <= 4000,
                  'text-negative': textChat.length > 4000
                }"
              >
                {{ textChat.length }}/4096
              </div>
            </div>

            <!-- Botões da direita -->
            <div class="input-actions-right">
              <q-btn
                v-if="textChat && textChat.trim()"
                ref="btnEnviarMensagem"
                @click="enviarMensagem"
                :disabled="ticketFocado.status !== 'open'"
                flat
                icon="mdi-send"
                round
                size="sm"
                class="send-button"
                color="primary"
              >
                <q-tooltip content-class="text-bold">Enviar Mensagem</q-tooltip>
              </q-btn>
              <q-btn
                v-else
                @click="handleSartRecordingAudio"
                :disabled="cDisableActions"
                flat
                icon="mdi-microphone"
                round
                size="sm"
                color="grey-7"
              >
                <q-tooltip content-class="text-bold">Gravar Áudio</q-tooltip>
              </q-btn>
            </div>
          </div>
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
      <br><small>TextChat: "{{ textChat }}" (length: {{ textChat ? textChat.length : 0 }})</small>
    </div>

  </div>
</template>

<script>
import { uid } from 'quasar'
import mixinCommon from './mixinCommon'
import { EnviarMensagemTexto } from 'src/service/tickets'
import { mapGetters } from 'vuex'
import RecordingTimer from './RecordingTimer'
import MicRecorder from 'mic-recorder-to-mp3'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import mixinAtualizarStatusTicket from './mixinAtualizarStatusTicket'
import { hasEmojis, extractEmojiChar } from 'src/utils/emojiUtils'
import { processAllEmojisWithAppleEmoji } from 'src/utils/emojiUtils'

const Mp3Recorder = new MicRecorder({
  bitRate: 128,
  sampleRate: 44100
})

// Função utilitária para obter o código unicode do emoji em hexadecimal
function emojiToHex(emoji) {
  return Array.from(emoji)
    .map(c => c.codePointAt(0).toString(16))
    .join('-')
}
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
    EmojiPicker
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
    },
    // Processar texto do input com emojis usando o mesmo CDN do chat
    processedTextChat () {
      if (!this.textChat) return ''
      return processAllEmojisWithAppleEmoji(this.textChat)
    }
  },
  watch: {
    // Observar mudanças no status do ticket
    'ticketFocado.status': {
      handler (newStatus, oldStatus) {
        // Adicionar verificações para evitar loops infinitos
        if (!this.ticketFocado?.id) return

        if (newStatus === 'pending') {
          // Se o ticket ficar pending, remover foco
          if (this.$refs.inputEnvioMensagem) {
            this.$refs.inputEnvioMensagem.blur()
          }
        } else if (newStatus === 'open' && oldStatus !== 'open' && oldStatus !== undefined) {
          // Quando o ticket for aberto (mudança de status para 'open'), focar o input
          // Só focar se oldStatus não for undefined (evitar execução na inicialização)
          this.$nextTick(() => {
            this.focusInputWithRetry()
          })
        }
      },
      immediate: false // Mudado para false para evitar execução na inicialização
    },
    // Observar mudanças no ticket inteiro (apenas ID para evitar deep watching desnecessário)
    'ticketFocado.id': {
      handler (newId, oldId) {
        // Só executar se realmente mudou o ID do ticket
        if (newId && newId !== oldId && oldId !== undefined) {
          // Quando um novo ticket é selecionado, focar o input automaticamente
          this.$nextTick(() => {
            if (this.ticketFocado?.status === 'open') {
              this.focusInputWithRetry()
            }
          })
        }
      },
      immediate: false
    },
    // Observar mudanças na mensagem de resposta
    replyingMessage: {
      handler (newMessage, oldMessage) {
        if (newMessage && newMessage !== oldMessage && newMessage.id !== oldMessage?.id) {
          // Quando uma mensagem é selecionada para resposta, focar o input
          this.focusOnReply()
        }
      },
      immediate: false
    }
  },
  methods: {
    // Método para focar o input com retry para garantir que funcione
    focusInputWithRetry (maxAttempts = 5) { // Reduzido de 8 para 5 tentativas
      // Verificar se já há uma tentativa em andamento para evitar múltiplas execuções
      if (this._focusAttempting) {
        return
      }

      // Verificar se o ticket está em um estado que permite foco
      if (!this.ticketFocado?.id || this.ticketFocado?.status === 'pending') {
        return
      }
      this._focusAttempting = true

      const attemptFocus = (attempt = 0) => {
        if (attempt >= maxAttempts) {
          console.warn('[InputMensagem] Não foi possível focar o input após', maxAttempts, 'tentativas')
          this._focusAttempting = false
          return
        }

        // Verificar se já está focado antes de tentar
        const inputElement = this.$refs.inputEnvioMensagem
        if (inputElement && document.activeElement === inputElement) {
          this._focusAttempting = false
          return // Já está focado
        }

        if (inputElement) {
          try {
            inputElement.focus()

            // Verificar se o foco foi aplicado corretamente
            if (document.activeElement === inputElement) {
              this._focusAttempting = false
              return
            }
          } catch (error) {
            console.warn('[InputMensagem] Erro ao focar input na tentativa', attempt + 1, error)
          }
        }

        // Tentar novamente após um delay progressivo (menor)
        const delay = Math.min(100 + (attempt * 50), 300) // Máximo de 300ms de delay
        setTimeout(() => attemptFocus(attempt + 1), delay)
      }

      // Iniciar as tentativas
      attemptFocus(0)
    },
    openFilePreview (event) {
      const data = event.clipboardData.files[0]
      const urlImg = window.URL.createObjectURL(data)
      return urlImg
    },
    handleInputPaste (e) {
      if (!this.ticketFocado?.id) return
      if (e.clipboardData.files[0]) {
        this.clearInput()
        this.arquivos = [e.clipboardData.files[0]]
        this.abrirModalPreviewImagem = true
        this.urlMediaPreview = {
          title: `Enviar imagem para ${this.ticketFocado?.contact?.name}`,
          src: this.openFilePreview(e)
        }
        this.$nextTick(() => {
          this.focusInputWithRetry()
        })
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
      // Função simplificada - foco será no final sempre
    },

    onEmojiPickerHide () {
      // Quando o emoji picker é fechado, restaurar foco no input
      this.$nextTick(() => {
        const inputElement = this.$refs.inputEnvioMensagem
        if (inputElement && this.ticketFocado?.status === 'open') {
          inputElement.focus()
          this.placeCursorAtEnd(inputElement)
        }
      })
    },

    getCaretPosition (element) {
      // Obter posição do cursor em caracteres dentro do contenteditable
      try {
        const selection = window.getSelection()
        if (selection.rangeCount === 0) return 0

        const range = selection.getRangeAt(0)
        const preCaretRange = range.cloneRange()
        preCaretRange.selectNodeContents(element)
        preCaretRange.setEnd(range.endContainer, range.endOffset)

        // Contar caracteres incluindo emojis
        let charCount = 0
        const walker = document.createTreeWalker(
          preCaretRange.extractContents(),
          NodeFilter.SHOW_TEXT + NodeFilter.SHOW_ELEMENT,
          null,
          false
        )

        let node
        while ((node = walker.nextNode())) {
          if (node.nodeType === Node.TEXT_NODE) {
            // Pular texto dentro de spans de emoji ocultos
            if (node.parentNode && node.parentNode.classList &&
                node.parentNode.classList.contains('whatsapp-emoji-char')) {
              continue
            }
            charCount += node.textContent.length
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Se é um span de emoji, contar como 1 caractere
            if (node.classList && node.classList.contains('whatsapp-emoji-span')) {
              charCount += 1
            } else if (node.tagName === 'IMG' && node.alt) {
              // Imagem de emoji direto
              charCount += node.alt.length
            } else if (node.tagName === 'BR') {
              // Quebra de linha
              charCount += 1
            }
          }
        }

        return charCount
      } catch (error) {
        console.warn('Erro ao calcular posição do cursor:', error)
        return 0
      }
    },
    mensagemRapidaSelecionada (mensagem) {
      this.textChat = mensagem
      this.$nextTick(() => {
        this.focusInputWithRetry()
      })
    },
    onEmojiSelectMart (emoji, event) {
      try {
        if (event) {
          event.stopPropagation()
          event.preventDefault()
        }
        const emojiChar = extractEmojiChar(emoji)
        if (emojiChar) {
          const inputElement = this.$refs.inputEnvioMensagem
          let currentText = ''
          if (inputElement) {
            currentText = this.extractPlainText(inputElement) || this.textChat
          } else {
            currentText = this.textChat
          }
          const newText = currentText + emojiChar
          this.textChat = newText
          if (inputElement) {
            // Processa o texto inteiro para Apple Emoji imediatamente
            inputElement.innerHTML = processAllEmojisWithAppleEmoji(newText)
            this.placeCursorAtEnd(inputElement)
            inputElement.focus()
          }
        } else {
          this.$q.notify({
            type: 'warning',
            message: 'Erro ao inserir emoji. Tente novamente.',
            position: 'bottom-right',
            timeout: 3000
          })
        }
      } catch (error) {
        const emojiChar = extractEmojiChar(emoji)
        if (emojiChar) {
          this.textChat += emojiChar
          const inputElement = this.$refs.inputEnvioMensagem
          if (inputElement) {
            inputElement.innerHTML = processAllEmojisWithAppleEmoji(this.textChat)
            this.placeCursorAtEnd(inputElement)
            inputElement.focus()
          }
        }
      }
    },
    abrirEnvioArquivo (event) {
      this.clearInput()
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
        this.clearInput()
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
      const mensagem = this.textChat.trim()
      const username = localStorage.getItem('username')
      const userId = localStorage.getItem('userId')
      const message = {
        read: 1,
        fromMe: true,
        mediaUrl: '',
        body: mensagem,
        scheduleDate: this.isScheduleDate ? this.scheduleDate : null,
        quotedMsg: this.replyingMessage,
        quotedMsgId: this.replyingMessage?.id || null,
        id: uid(),
        userId: userId ? parseInt(userId) : null,
        user: username ? { name: username } : null
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
        this.clearInput()
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

      // Focar o input após enviar mensagem com retry
      setTimeout(() => {
        this.focusInputWithRetry()
      }, 200)
    },
    async handlSendLinkVideo () {
      const link = `https://meet.jit.si/${uid()}/${uid()}`
      const mensagem = link
      const username = localStorage.getItem('username')
      const userId = localStorage.getItem('userId')
      const message = {
        read: 1,
        fromMe: true,
        mediaUrl: '',
        body: mensagem,
        scheduleDate: this.isScheduleDate ? this.scheduleDate : null,
        quotedMsg: this.replyingMessage,
        quotedMsgId: this.replyingMessage?.id || null,
        id: uid(),
        userId: userId ? parseInt(userId) : null,
        user: username ? { name: username } : null
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

    // Método para limpar cache de permissão do microfone (útil para logout)
    clearMicrophonePermissionCache () {
      localStorage.removeItem('microphonePermissionChecked')
      localStorage.removeItem('microphonePermissionGranted')
      this.hasMicrophonePermission = false
    },

    // Método para limpar o input de forma consistente
    clearInput () {
      this.textChat = ''
      const inputElement = this.$refs.inputEnvioMensagem
      if (inputElement) {
        inputElement.innerHTML = ''
      }
    },

    // Método para fazer scroll para o final da conversa
    scrollToBottom () {
                this.$eventBus.emit('scrollToBottomMessageChat')
    },

    // Método específico para focar o input quando uma mensagem é selecionada para resposta
    focusOnReply () {
      // Garantir que o componente esteja pronto
      this.$nextTick(() => {
        // Uma única tentativa - o método focusInputWithRetry já tem retry interno
        this.focusInputWithRetry()
      })
    },

    // Métodos para emojis SVG
    hasEmojis (text) {
      return hasEmojis(text)
    },

    // Métodos para o input moderno
    handleEnterKey () {
      if (this.textChat.trim().length) {
        this.enviarMensagem()
      }
    },



    handlePaste (event) {
      // Permitir colar texto normalmente
      setTimeout(() => {
        this.handleContentEditableInput(event)
      }, 0)
    },

    // Métodos para contenteditable com suporte a emojis
    handleContentEditableInput (event) {
      const element = event.target;
      // Extrair texto plano primeiro
      const plainText = this.extractPlainText(element);

      // Sempre atualizar o modelo de dados, mesmo se vazio
      this.textChat = plainText;

      // Se o campo está vazio, limpe o innerHTML e não processe emojis
      if (!plainText) {
        element.innerHTML = '';
        return;
      }

      // Processar emojis usando a mesma função do chat
      this.$nextTick(() => {
        const processedHTML = processAllEmojisWithAppleEmoji(plainText);
        if (element.innerHTML !== processedHTML) {
          element.innerHTML = processedHTML;
          this.placeCursorAtEnd(element);
        }
      });

      // Auto-resize do contenteditable
      this.autoResizeContentEditable(element);
    },

    handleContentEditableBlur (event) {
      const element = event.target
      const plainText = this.extractPlainText(element)
      this.textChat = plainText
    },

    handleContentEditableFocus (event) {
      const element = event.target
      // Garantir que o cursor esteja no final do texto
      this.placeCursorAtEnd(element)
    },

    extractPlainText (element) {
      if (!element) return '';

      let text = '';
      try {
        // Método mais robusto para extrair texto preservando emojis
        const processNode = (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            // Pular texto dentro de spans de emoji ocultos
            if (node.parentNode && node.parentNode.classList &&
                node.parentNode.classList.contains('whatsapp-emoji-char')) {
              return;
            }
            text += node.nodeValue;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Se é um span de emoji, extrair o emoji do atributo alt ou title
            if (node.classList && node.classList.contains('whatsapp-emoji-span')) {
              // Procurar img dentro do span
              const img = node.querySelector('img');
              if (img && img.alt) {
                text += img.alt;
              } else if (node.getAttribute('data-emoji')) {
                text += node.getAttribute('data-emoji');
              }
            } else if (node.tagName === 'IMG') {
              // Imagem de emoji direto - usar alt ou title
              if (node.alt) {
                text += node.alt;
              } else if (node.title) {
                text += node.title;
              } else {
                // Tentar extrair emoji do src da imagem (emoji-js)
                const src = node.src;
                if (src && src.includes('emoji-datasource')) {
                  // Tentar extrair emoji do nome do arquivo
                  const match = src.match(/([a-f0-9-]+)\.png/);
                  if (match) {
                    try {
                      // Converter código hex para emoji
                      const codes = match[1].split('-').map(hex => parseInt(hex, 16));
                      const emoji = String.fromCodePoint(...codes);
                      text += emoji;
                    } catch (e) {
                      console.warn('Erro ao converter emoji:', e);
                    }
                  }
                }
              }
            } else if (node.tagName === 'BR') {
              // Quebra de linha
              text += '\n';
            } else {
              // Processar nós filhos
              for (let child of node.childNodes) {
                processNode(child);
              }
            }
          }
        };

        // Processar todos os nós
        for (let child of element.childNodes) {
          processNode(child);
        }

        // Se não conseguiu extrair texto, usar fallback
        if (!text) {
          text = element.innerText || element.textContent || '';
        }

      } catch (error) {
        console.warn('Erro ao extrair texto:', error);
        // Fallback para método simples
        text = element.innerText || element.textContent || '';
      }

      // Limitar o tamanho do texto
      if (text.length > 4096) {
        text = text.substring(0, 4096);
      }

      return text;
    },

    autoResizeContentEditable (element) {
      // Auto-resize do contenteditable
      element.style.height = 'auto'
      const maxHeight = 120 // ~6 linhas
      const newHeight = Math.min(element.scrollHeight, maxHeight)
      element.style.height = newHeight + 'px'

      // Scroll para baixo se necessário
      if (element.scrollHeight > maxHeight) {
        element.scrollTop = element.scrollHeight
      }
    },

    placeCursorAtEnd (element) {
      // Colocar cursor no final do texto
      const range = document.createRange()
      const selection = window.getSelection()

      try {
        if (element.childNodes.length > 0) {
          // Encontrar o último nó de texto ou elemento
          let lastNode = element.lastChild

          // Se o último nó é um span de emoji, ir para depois dele
          if (lastNode.nodeType === Node.ELEMENT_NODE &&
              lastNode.classList.contains('whatsapp-emoji-span')) {
            range.setStartAfter(lastNode)
            range.setEndAfter(lastNode)
          } else if (lastNode.nodeType === Node.TEXT_NODE) {
            range.setStart(lastNode, lastNode.length)
            range.setEnd(lastNode, lastNode.length)
          } else {
            range.setStartAfter(lastNode)
            range.setEndAfter(lastNode)
          }
        } else {
          range.setStart(element, 0)
          range.setEnd(element, 0)
        }

        selection.removeAllRanges()
        selection.addRange(range)

        // Garantir que o elemento tenha foco
        element.focus()
      } catch (error) {
        console.warn('Erro ao posicionar cursor:', error)
        // Fallback simples
        element.focus()
      }
    },

    placeCursorAtPosition (element, position) {
      // Posicionar cursor em uma posição específica
      try {
        const range = document.createRange()
        const selection = window.getSelection()

        // Contar caracteres percorridos para encontrar a posição correta
        let charCount = 0
        let nodeStack = [element]
        let node, foundNode = null, foundOffset = 0

        // Percorrer os nós para encontrar a posição correta
        while (nodeStack.length > 0) {
          node = nodeStack.pop()

          if (node.nodeType === Node.TEXT_NODE) {
            const nextCharCount = charCount + node.textContent.length

            if (charCount <= position && position <= nextCharCount) {
              foundNode = node
              foundOffset = position - charCount
              break
            }
            charCount = nextCharCount
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Se é um span de emoji, contar como 1 caractere
            if (node.classList && node.classList.contains('whatsapp-emoji-span')) {
              const nextCharCount = charCount + 1

              if (charCount <= position && position <= nextCharCount) {
                foundNode = node
                foundOffset = position === charCount ? 0 : 1
                break
              }
              charCount = nextCharCount
            } else {
              // Adicionar nós filhos à pilha em ordem reversa
              for (let i = node.childNodes.length - 1; i >= 0; i--) {
                nodeStack.push(node.childNodes[i])
              }
            }
          }
        }

        // Posicionar cursor
        if (foundNode) {
          if (foundNode.nodeType === Node.TEXT_NODE) {
            range.setStart(foundNode, Math.min(foundOffset, foundNode.textContent.length))
            range.setEnd(foundNode, Math.min(foundOffset, foundNode.textContent.length))
          } else {
            // Para elementos (como spans de emoji)
            if (foundOffset === 0) {
              range.setStartBefore(foundNode)
              range.setEndBefore(foundNode)
            } else {
              range.setStartAfter(foundNode)
              range.setEndAfter(foundNode)
            }
          }
        } else {
          // Fallback: posicionar no final
          this.placeCursorAtEnd(element)
          return
        }

        selection.removeAllRanges()
        selection.addRange(range)

      } catch (error) {
        console.warn('Erro ao posicionar cursor na posição especificada:', error)
        // Fallback: posicionar no final
        this.placeCursorAtEnd(element)
      }
    },

    // Método para processar emojis como imagens do WhatsApp Web
    processEmojisAsImages (element) {
      if (!element) return;

      // Usar a mesma função que o chat usa para consistência
      const currentHTML = element.innerHTML;
      const processedHTML = processAllEmojisWithAppleEmoji(currentHTML);

      // Só atualizar se houve mudança
      if (currentHTML !== processedHTML) {
        // Salvar posição do cursor
        const selection = window.getSelection();
        let cursorPosition = 0;

        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          cursorPosition = range.startOffset;
        }

        // Atualizar HTML
        element.innerHTML = processedHTML;

        // Restaurar cursor no final
        this.$nextTick(() => {
          this.placeCursorAtEnd(element);
        });
      }
    },


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
    this.$eventBus.on('mensagem-chat:focar-input-mensagem', (mensagem) => {
      this.focusOnReply()
    })

    // Escutar evento de refoco quando o mesmo ticket for clicado novamente
    this.$eventBus.on('ticket:refocus-input', () => {
      this.$nextTick(() => {
        if (this.ticketFocado?.status === 'open') {
          this.focusInputWithRetry()
        }
      })
    })

    const self = this
    window.addEventListener('paste', self.handleInputPaste)

    // Adicionar event listener para fechar modal de emojis quando clicar fora
    document.addEventListener('click', this.handleClickOutsideEmojiPicker)

    // Autofocus inicial - se já há um ticket aberto quando o componente é montado
    this.$nextTick(() => {
      if (this.ticketFocado?.id && this.ticketFocado.status === 'open') {
        this.focusInputWithRetry()
      }
    })

    // Sistema de emoji SVG carregado
  },
  beforeDestroy () {
    const self = this
    window.removeEventListener('paste', self.handleInputPaste)

    // Remover event listener para fechar modal de emojis
    document.removeEventListener('click', this.handleClickOutsideEmojiPicker)

    // Limpar flag de tentativa de foco
    this._focusAttempting = false
  },
  destroyed () {
    this.$eventBus.off('mensagem-chat:focar-input-mensagem')
    this.$eventBus.off('ticket:refocus-input')
  }
}
</script>

<style lang="sass" scoped>


  .input-actions-left, .input-actions-right
    display: flex
    align-items: center
    gap: 4px

.input-field-wrapper
  flex: 1
  display: flex
  flex-direction: column
  justify-content: flex-end
  min-width: 0

.emoji-input
  min-height: 24px
  max-height: 120px
  padding: 10px 16px
  border-radius: 8px
  background: var(--q-bg, #fff)
  color: var(--q-text, #222d34)
  font-size: 15px
  line-height: 1.5
  border: none
  outline: none
  box-shadow: none
  resize: none
  overflow-y: auto
  word-break: break-word
  white-space: pre-wrap
  transition: background 0.2s, color 0.2s
  font-family: 'Segoe UI', 'Roboto', 'Apple Color Emoji', 'Noto Color Emoji', 'Android Emoji', 'EmojiSymbols', 'EmojiOne Mozilla', 'Twemoji Mozilla', 'Segoe UI', sans-serif

  &:empty:before
    content: attr(data-placeholder)
    color: var(--q-placeholder, #8696a0)
    pointer-events: none
    font-style: normal
    font-size: 15px

  &[data-disabled="true"]
    background: var(--q-bg-disabled, #f5f5f5)
    color: var(--q-text-disabled, #6b7b8a)
    cursor: not-allowed
    pointer-events: none

// Responsividade
@media (max-width: 600px)
  .modern-input-container
    min-height: 48px
    padding: 4px 4px
  .emoji-input
    font-size: 14px
    padding: 8px 8px

.char-counter
  align-self: flex-end
  font-size: 12px
  color: #8696a0
  margin-top: 2px

body.body--dark .bg-white
  background: transparent !important

body.body--light .modern-input-container
  background: #fff !important
  border: none !important
  box-shadow: 0 2px 8px rgba(0,0,0,0.08)
  border-radius: 24px
  margin: 0 12px 12px 12px
  min-height: 48px
  padding: 0 16px
  font-size: 16px
  display: flex
  align-items: center

body.body--light .emoji-input
  background: transparent !important
  box-shadow: none !important
  border: none !important
  color: #222d34 !important
  padding: 12px 0
  min-height: 48px
  font-size: 16px

body.body--dark .modern-input-container
  background: #2e3540 !important
  border: none !important
  border-radius: 24px !important
  margin: 0 12px 12px 12px !important
  min-height: 48px !important
  padding: 0 16px !important
  font-size: 16px !important
  display: flex !important
  align-items: center !important

body.body--dark .emoji-input
  background: transparent !important
  box-shadow: none !important
  border: none !important
  color: #e9edef !important
  padding: 12px 0 !important
  min-height: 48px !important
  font-size: 16px !important

// Classe para remover bordas superiores quando há mensagem citada
.modern-input-container--no-top-border
  border-top-left-radius: 0 !important
  border-top-right-radius: 0 !important

body.body--light .modern-input-container--no-top-border
  border-top-left-radius: 0 !important
  border-top-right-radius: 0 !important
  background: #fff !important

body.body--dark .modern-input-container--no-top-border
  border-top-left-radius: 0 !important
  border-top-right-radius: 0 !important
  background: #2e3540 !important

</style>
