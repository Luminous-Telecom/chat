<template>
  <q-dialog
    persistent
    :value="modalCampanha"
    @hide="fecharModal"
    @show="abrirModal"
    transition-show="scale"
    transition-hide="scale"
    class="modal-modern"
  >
    <q-card
      class="modal-card"
      style="width: 900px; max-width: 90vw; max-height: 90vh;"
    >
      <q-card-section class="modal-header row items-center q-pb-none">
        <div class="col">
          <div class="text-h6">{{ campanhaEdicao.id ? 'Editar' : 'Criar' }} Campanha</div>
          <div class="text-caption text-grey-6">
            Configure quando as mensagens devem ser enviadas.
          </div>
        </div>
        <q-btn
          icon="close"
          flat
          round
          dense
          class="close-btn"
          v-close-popup
        />
      </q-card-section>

      <q-separator />

      <div class="modal-scroll-area">
        <q-card-section class="modal-content">
          <div class="row q-gutter-sm">
            <q-input
              outlined
              dense
              rounded
              style="width: 500px"
              v-model="campanha.name"
              label="Nome da Campanha"
              @blur="$v.campanha.name.$touch"
              :error="$v.campanha.name.$error"
              error-message="Obrigatório"
            />
            <q-datetime-picker
              style="width: 200px"
              dense
              rounded
              hide-bottom-space
              outlined
              stack-label
              bottom-slots
              label="Data/Hora início"
              mode="datetime"
              color="primary"
              format24h
              v-model="campanha.start"
              @blur="$v.campanha.start.$touch"
              :error="$v.campanha.start.$error"
              error-message="Não pode ser inferior ao dia atual"
            />
            <q-select
              rounded
              dense
              outlined
              emit-value
              map-options
              label="Enviar por"
              color="primary"
              v-model="campanha.sessionId"
              :options="cSessions"
              :input-debounce="700"
              option-value="id"
              option-label="name"
              input-style="width: 280px; max-width: 280px;"
              @blur="$v.campanha.sessionId.$touch"
              :error="$v.campanha.sessionId.$error"
              error-message="Obrigatório"
              style="width: 250px"
            />
            <q-input
              rounded
              outlined
              dense
              style="width: 160px"
              v-model="campanha.delay"
              input-class="text-right"
              suffix="segundos"
              label="Delay"
              error-message="Obrigatório"
            />
          </div>

          <div class="row q-mt-md">
            <q-checkbox
              v-model="campanha.businessHoursOnly"
              label="Enviar apenas em horário comercial e dias úteis"
              color="primary"
            >
              <q-tooltip>
                <div v-if="campanha.businessHoursOnly">
                  <strong>Ativado:</strong> As mensagens serão enviadas apenas nos horários comerciais configurados.<br/>
                  Mensagens fora do horário serão reagendadas para o próximo horário válido.
                </div>
                                 <div v-else>
                   <strong>Desativado:</strong> As mensagens serão enviadas exatamente conforme agendado,<br/>
                   sem qualquer restrição de horário (24h por dia, 7 dias por semana).
                 </div>
                </q-tooltip>
             </q-checkbox>
          </div>

          <div class="row q-mt-md">
              <q-file
              dense
              rounded
              v-if="!campanha.mediaUrl"
              :loading="loading"
              label="Mídia composição mensagem"
              ref="PickerFileMessage"
              v-model="arquivos"
              class="col-grow"
              bg-color="blue-grey-1"
              input-style="max-height: 30vh"
              outlined
              clearable
              autogrow
              append
              :max-files="1"
              counter
              :max-file-size="10485760"
              :max-total-size="30485760"
              accept=".jpg, .png, image/jpeg, .pdf, .doc, .docx, .mp4, .xls, .xlsx, .jpeg, .zip, .ppt, .pptx, image/*"
              @rejected="onRejectedFiles"
              style="width: 350px"
            />
            <q-input
              v-if="campanha.mediaUrl"
              readonly
              rounded
              label="Mídia composição mensagem"
              :value="cArquivoName"
              class=" col-grow "
              bg-color="blue-grey-1"
              input-style="max-height: 30vh"
              outlined
              autogrow
              append
              counter
              style="width: 350px"
            >
              <template v-slot:append>
                <q-btn
                  round
                  dense
                  flat
                  icon="close"
                  @click="campanha.mediaUrl = null; arquivos = []"
                />
              </template>
            </q-input>
          </div>
        </q-card-section>
        <q-card-section class="modal-content row q-gutter-sm justify-center">
        <div style="min-width: 400px;">
          <div class="row items-center q-pt-none">
            <label class="text-heading text-bold">1ª Mensagem</label>
            <div class="col-xs-3 col-sm-2 col-md-1">
              <q-btn
                round
                flat
                class="q-ml-sm"
              >
                <q-icon
                  size="2em"
                  name="mdi-emoticon-happy-outline"
                />
                <q-tooltip>
                  Emoji
                </q-tooltip>
                <q-menu
                  anchor="top right"
                  self="bottom middle"
                  :offset="[5, 40]"
                  ref="emojiPicker1"
                >
                  <emoji-picker
                    style="width: 40vw"
                    @emoji-click="(e) => onInsertSelectEmoji(e, 'message1')"
                  />
                </q-menu>
              </q-btn>
            </div>
            <div class="col-xs-8 col-sm-10 col-md-11 q-pl-sm">
              <textarea
                ref="message1"
                style="min-height: 12.5vh; max-height: 12.5vh;"
                class="q-pa-sm bg-white full-width rounded-all"
                :class="{
                  'bg-red-1': $v.campanha.message1.$error
                }"
                @blur="$v.campanha.message1.$touch"
                placeholder="Digite a mensagem"
                autogrow
                dense
                outlined
                @input="(v) => campanha.message1 = v.target.value"
                :value="campanha.message1"
              />
              <q-separator class="q-my-md" />
            </div>
          </div>
          <div class="row items-center q-pt-none">
            <label class="text-heading text-bold">2ª Mensagem <span class="text-caption text-grey-6">(Opcional)</span></label>
            <div class="col-xs-3 col-sm-2 col-md-1">
              <q-btn
                round
                flat
                class="q-ml-sm"
              >
                <q-icon
                  size="2em"
                  name="mdi-emoticon-happy-outline"
                />
                <q-tooltip>
                  Emoji
                </q-tooltip>
                <q-menu
                  anchor="top right"
                  self="bottom middle"
                  :offset="[5, 40]"
                  ref="emojiPicker2"
                >
                  <emoji-picker
                    style="width: 40vw"
                    @emoji-click="(e) => onInsertSelectEmoji(e, 'message2')"
                  />
                </q-menu>
              </q-btn>
            </div>
            <div class="col-xs-8 col-sm-10 col-md-11 q-pl-sm">
              <textarea
                ref="message2"
                style="min-height: 12.5vh; max-height: 12.5vh;"
                class="q-pa-sm bg-white full-width rounded-all"
                placeholder="Digite a 2ª mensagem (opcional)"
                autogrow
                dense
                outlined
                @input="(v) => campanha.message2 = v.target.value"
                :value="campanha.message2"
              />
              <q-separator class="q-my-md" />
            </div>
          </div>
          <div class="row items-center q-pt-none">
            <label class="text-heading text-bold">3ª Mensagem <span class="text-caption text-grey-6">(Opcional)</span></label>
            <div class="col-xs-3 col-sm-2 col-md-1">
              <q-btn
                round
                flat
                class="q-ml-sm"
              >
                <q-icon
                  size="2em"
                  name="mdi-emoticon-happy-outline"
                />
                <q-tooltip>
                  Emoji
                </q-tooltip>
                <q-menu
                  anchor="top right"
                  self="bottom middle"
                  :offset="[5, 40]"
                  ref="emojiPicker3"
                >
                  <emoji-picker
                    style="width: 40vw"
                    @emoji-click="(e) => onInsertSelectEmoji(e, 'message3')"
                  />
                </q-menu>
              </q-btn>
            </div>
            <div class="col-xs-8 col-sm-10 col-md-11 q-pl-sm">
              <textarea
                ref="message3"
                style="min-height: 12.5vh; max-height: 12.5vh;"
                class="q-pa-sm bg-white full-width rounded-all"
                placeholder="Digite a 3ª mensagem (opcional)"
                autogrow
                dense
                outlined
                @input="(v) => campanha.message3 = v.target.value"
                :value="campanha.message3"
              />
            </div>
          </div>
        </div>
        <div style="width: 500px;">
          <q-card
            bordered
            flat
            class="full-width"
          >
            <div class="text-body1 text-bold q-pa-sm full-width text-center bg-grey-3">
              Visualização
            </div>
            <q-card-section class="row justify-center">
              <q-option-group
                class="q-mb-sm"
                inline
                dense
                v-model="messagemPreview"
                :options="availableMessages"
                color="primary"
              />
              <cMolduraCelular
                class="row justify-center"
                :key="cKey"
              >
                <MensagemChat
                  :isLineDate="false"
                  size="8"
                  class="full-width rounded-all"
                  :mensagens="cMessages"
                  :ticketFocado="{ id: -1, channel: 'whatsapp', contact: { name: 'Preview' } }"
                  :isShowOptions="false"
                />
              </cMolduraCelular>
            </q-card-section>
          </q-card>
        </div>

      </q-card-section>
      </div>

      <q-separator />

      <q-card-actions align="right" class="modal-actions">
        <q-btn
          label="Cancelar"
          color="negative"
          v-close-popup
          class="q-mr-md"
          rounded
        />
        <q-btn
          rounded
          label="Salvar"
          color="primary"
          icon="save"
          @click="handleCampanha"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

</template>

<script>
import { required } from 'vuelidate/lib/validators'
import axios from 'axios'
import cMolduraCelular from 'src/components/cMolduraCelular'
import MensagemChat from 'src/pages/atendimento/MensagemChat'
import { mapGetters } from 'vuex'
import { CriarCampanha, AlterarCampanha } from 'src/service/campanhas'
import { parseISO, startOfDay } from 'date-fns'
import { insertEmojiInTextarea } from 'src/utils/emojiUtils'
import 'emoji-picker-element'

const isValidDate = (v) => {
  return startOfDay(new Date(parseISO(v))).getTime() >= startOfDay(new Date()).getTime()
}

const downloadImageCors = axios.create({
  baseURL: process.env.VUE_URL_API,
  timeout: 20000,
  headers: {
    responseType: 'blob'
  }
})

export default {
  name: 'ModalCampanha',
  components: { cMolduraCelular, MensagemChat },
  props: {
    modalCampanha: {
      type: Boolean,
      default: false
    },
    campanhaEdicao: {
      type: Object,
      default: () => {
        return { id: null }
      }
    }
  },
  data () {
    return {
      messagemPreview: 'message1',
      loading: false,
      abrirModalImagem: false,
      urlMedia: '',
      campanha: {
        name: null,
        start: null,
        mediaUrl: null,
        message1: null,
        message2: null,
        message3: null,
        sessionId: null,
        delay: 20,
        businessHoursOnly: false
      },
      messageTemplate: {
        mediaUrl: null,
        id: null,
        ack: 3,
        read: true,
        fromMe: true,
        body: null,
        mediaType: 'chat',
        isDeleted: false,
        createdAt: '2021-02-20T20:09:04.736Z',
        updatedAt: '2021-02-20T23:26:24.311Z',
        quotedMsgId: null,
        delay: 20,
        ticketId: 0,
        contactId: null,
        userId: null,
        contact: null,
        quotedMsg: null
      },
      arquivos: []
    }
  },
  validations: {
    campanha: {
      name: { required },
      start: { required, isValidDate },
      message1: { required },
      sessionId: { required }
    }
  },
  computed: {
    ...mapGetters(['whatsapps']),
    cSessions () {
      return this.whatsapps.filter(w => w.type === 'whatsapp' && !w.isDeleted)
    },
    cKey () {
      return this.campanha.message1 + this.campanha.message2 + this.campanha.message3
    },
    cArquivoName () {
      const split = this.campanha.mediaUrl.split('/')
      const name = split[split.length - 1]
      return name
    },
    availableMessages () {
      const options = [{ label: 'Msg.1', value: 'message1' }]

      if (this.campanha.message2 && this.campanha.message2.trim()) {
        options.push({ label: 'Msg.2', value: 'message2' })
      }

      if (this.campanha.message3 && this.campanha.message3.trim()) {
        options.push({ label: 'Msg.3', value: 'message3' })
      }

      return options
    },
    cMessages () {
      const messages = []
      const msgArray = ['message1', 'message2', 'message3']
      if (this.arquivos?.type) {
        const blob = new Blob([this.arquivos], { type: this.arquivos.type })
        messages.push({
          ...this.messageTemplate,
          id: 'mediaUrl',
          mediaUrl: window.URL.createObjectURL(blob),
          body: this.arquivos.name,
          mediaType: this.arquivos.type.substr(0, this.arquivos.type.indexOf('/'))
        })
      } else if (this.campanha.mediaUrl) {
        messages.push({
          ...this.messageTemplate,
          id: 'mediaUrl',
          mediaUrl: this.campanha.mediaUrl,
          body: '',
          mediaType: this.campanha.mediaType
        })
      }
      msgArray.forEach(el => {
        if (this.messagemPreview === el && this.campanha[el] && this.campanha[el].trim()) {
          const body = this.campanha[el]
          const msg = {
            ...this.messageTemplate,
            id: el,
            body
          }
          messages.push(msg)
        }
      })
      return messages
    }
  },
  watch: {
    availableMessages: {
      handler (newOptions) {
        // Se a mensagem atualmente selecionada não está mais disponível, volta para message1
        const isCurrentMessageAvailable = newOptions.some(opt => opt.value === this.messagemPreview)
        if (!isCurrentMessageAvailable) {
          this.messagemPreview = 'message1'
        }
      },
      immediate: true
    }
  },
  methods: {
    // Método para fechar o modal de emojis quando clicar fora
    handleClickOutsideEmojiPicker (event) {
      // Verificar se o clique foi fora do modal de emojis
      const emojiPicker1 = this.$refs.emojiPicker1
      const emojiPicker2 = this.$refs.emojiPicker2
      const emojiPicker3 = this.$refs.emojiPicker3

      // Verificar se o clique foi no botão que abre o emoji picker
      const isEmojiButton = event.target.closest('.q-btn') &&
                           event.target.closest('.q-btn').querySelector('.mdi-emoticon-happy-outline')

      // Verificar se o clique foi dentro de algum emoji picker
      const isInsideEmojiPicker = (emojiPicker1 && emojiPicker1.$el && emojiPicker1.$el.contains(event.target)) ||
                                 (emojiPicker2 && emojiPicker2.$el && emojiPicker2.$el.contains(event.target)) ||
                                 (emojiPicker3 && emojiPicker3.$el && emojiPicker3.$el.contains(event.target))

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
        // Fechar os modais de emoji (q-menu)
        if (emojiPicker1 && emojiPicker1.hide) emojiPicker1.hide()
        if (emojiPicker2 && emojiPicker2.hide) emojiPicker2.hide()
        if (emojiPicker3 && emojiPicker3.hide) emojiPicker3.hide()
      }
    },
    onInsertSelectEmoji (event, ref) {
      const emoji = event.detail?.unicode || event.detail?.emoji || event.emoji || event.unicode || event.i || event.data
      if (!emoji) {
        this.$q.notify({
          type: 'warning',
          message: 'Erro ao inserir emoji. Tente novamente.',
          position: 'bottom-right',
          timeout: 3000
        })
        return
      }
      const textarea = this.$refs[ref]
      const success = insertEmojiInTextarea(
        emoji,
        textarea,
        (newValue) => {
          this.campanha[ref] = newValue
        },
        this.campanha[ref]
      )
      if (!success) {
        this.$q.notify({
          type: 'warning',
          message: 'Erro ao inserir emoji. Tente novamente.',
          position: 'bottom-right',
          timeout: 3000
        })
      }
    },
    resetarCampanha () {
      this.campanha = {
        id: null,
        name: null,
        start: null,
        message1: null,
        message2: null,
        message3: null,
        message4: null,
        mediaUrl: null,
        userId: null,
        delay: 20,
        sessionId: null,
        businessHoursOnly: false
      }
      this.messagemPreview = 'message1'
    },
    fecharModal () {
      this.resetarCampanha()
      this.$emit('update:campanhaEdicao', { id: null })
      this.$emit('update:modalCampanha', false)
    },
    abrirModal () {
      if (this.campanhaEdicao.id) {
        this.campanha = {
          ...this.campanhaEdicao,
          businessHoursOnly: this.campanhaEdicao.businessHoursOnly || false
        }
      } else {
        this.resetarCampanha()
      }
    },
    onRejectedFiles (rejectedEntries) {
      this.$q.notify({
        html: true,
        message: `Ops... Ocorreu um erro! <br>
        <ul>
          <li>Arquivo deve ter no máximo 10MB.</li>
          <li>Priorize o envio de imagem ou vídeo.</li>
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
    async buscarImageCors (imageUrl) {
      this.loading = true
      try {
        const { data, headers } = await downloadImageCors.get(imageUrl, {
          responseType: 'blob'
        })
        const url = window.URL.createObjectURL(
          new Blob([data], { type: headers['content-type'] })
        )
        this.urlMedia = url
        this.abrirModalImagem = true
      } catch (error) {
        this.$notificarErro('Algum problema ao carregar a imagem', error)
      }
      this.loading = false
    },
    async handleCampanha () {
      this.$v.campanha.$touch()
      if (this.$v.campanha.$error) {
        const camposInvalidos = []

        if (this.$v.campanha.name.$error) {
          camposInvalidos.push('Nome da Campanha')
        }
        if (this.$v.campanha.start.$error) {
          camposInvalidos.push('Data/Hora de início')
        }
        if (this.$v.campanha.sessionId.$error) {
          camposInvalidos.push('Sessão WhatsApp (Enviar por)')
        }
        if (this.$v.campanha.message1.$error) {
          camposInvalidos.push('1ª Mensagem')
        }

        const mensagem = camposInvalidos.length > 0
          ? `Os seguintes campos são obrigatórios:<br><br>• ${camposInvalidos.join('<br>• ')}`
          : 'Verifique se todos os campos obrigatórios estão preenchidos.'

        this.$q.notify({
          type: 'negative',
          html: true,
          message: mensagem,
          timeout: 6000,
          position: 'top-right',
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
        return
      }
      try {
        this.loading = true
        const campanha = { ...this.campanha }

        const medias = new FormData()
        Object.keys(campanha).forEach((key) => {
          medias.append(key, campanha[key])
        })
        medias.append('medias', this.arquivos)
        if (this.campanha.id) {
          const { data } = await AlterarCampanha(medias, campanha.id)
          this.$emit('modal-campanha:editada', data)
          this.$q.notify({
            type: 'info',
            progress: true,
            position: 'bottom-right',
            textColor: 'black',
            message: 'Campanha editada!',
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
        } else {
          const { data } = await CriarCampanha(medias)
          this.$emit('modal-campanha:criada', data)
          this.$q.notify({
            type: 'positive',
            progress: true,
            position: 'bottom-right',
            message: 'Campanha criada!',
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
        }
        this.loading = false
        this.fecharModal()
      } catch (error) {
        // console.error(error)
        this.$notificarErro('Algum problema ao criar campanha', error)
      }
    }
  },
  mounted () {
    // Adicionar event listener para fechar modal de emojis quando clicar fora
    document.addEventListener('click', this.handleClickOutsideEmojiPicker)
  },
  beforeDestroy () {
    // Remover event listener para fechar modal de emojis
    document.removeEventListener('click', this.handleClickOutsideEmojiPicker)
  }
}
</script>

<style lang="scss" scoped>
.modal-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.modal-header {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 12px 16px;
  border-bottom: 1px solid #dee2e6;
  flex-shrink: 0;

  .text-h6 {
    font-weight: 600;
    font-size: 1.1rem;
  }

  .close-btn {
    transition: all 0.2s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.05);
      transform: scale(1.1);
    }
  }
}

.modal-scroll-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;

  /* Estilo personalizado da scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;

    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }
}

.modal-content {
  padding: 16px;
}

.modal-actions {
  padding: 16px;
  flex-shrink: 0;
  border-top: 1px solid #dee2e6;
}

.border-error {
  border: 3px solid red;
  background: red !important;
}

/* Dark mode styles */
.body--dark {
  .modal-header {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
    border-bottom-color: rgba(255, 255, 255, 0.1);

    .close-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  .modal-actions {
    border-top-color: rgba(255, 255, 255, 0.1);
  }

  .modal-scroll-area {
    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }
  }

  .bg-white {
    background: rgba(255, 255, 255, 0.05) !important;
    color: var(--q-color-on-surface) !important;
  }

  .bg-grey-3 {
    background: rgba(255, 255, 255, 0.1) !important;
    color: var(--q-color-on-surface) !important;
  }
}
</style>
