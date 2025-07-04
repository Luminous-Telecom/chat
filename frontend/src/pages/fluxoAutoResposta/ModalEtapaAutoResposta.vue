<template>
  <q-dialog
    persistent
    :value="modalEtapaAutoResposta"
    @hide="fecharModal"
    @show="abrirModal"
  >
    <q-card
      style="width: 600px"
      class="q-pa-lg"
    >
      <q-card-section>
        <div class="text-caption">
          Auto Resposta: {{ autoReply.name }}
        </div>
        <div class="text-h6">{{ etapaAutoRespostaEdicao.id ? 'Editar': 'Criar' }} Etapa {{ etapaAutoRespostaEdicao.id  ? `(ID: ${etapaAutoRespostaEdicao.id})` : '' }}</div>
      </q-card-section>
      <q-card-section class="q-pa-none">
        <div class="row items-center">
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
                ref="emojiPicker"
              >
                <emoji-picker @emoji-click="onEmojiSelect" style="width: 40vw" />
              </q-menu>
            </q-btn>

          </div>
          <div class="col-xs-8 col-sm-10 col-md-11 q-pl-sm">
            <label class="text-caption">Mensagem da Etapa:</label>
            <textarea
              ref="inputEnvioMensagem"
              style="min-height: 15vh; max-height: 15vh;"
              class="q-pa-sm bg-white full-width"
              placeholder="Digita sua mensagem"
              autogrow
              dense
              outlined
              @input="(v) => etapa.reply = v.target.value"
              :value="etapa.reply"
            />
          </div>
        </div>
        <div class="row col q-mt-md">
          <q-checkbox
            v-model="etapa.initialStep"
            label="Etapa inicial"
          />
        </div>
      </q-card-section>
      <q-card-actions
        align="right"
        class="q-mt-md"
      >
        <q-btn
          flat
          label="Cancelar"
          color="negative"
          v-close-popup
          class="q-mr-md"
        />
        <q-btn
          flat
          label="Salvar"
          color="primary"
          @click="handleEtapaAutoresposta"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { CriarEtapaResposta, EditarEtapaResposta } from 'src/service/autoResposta'
import 'emoji-picker-element'

export default {
  name: 'ModalEtapaAutoResposta',
  props: {
    modalEtapaAutoResposta: {
      type: Boolean,
      default: false
    },
    autoReply: {
      type: Object,
      default: () => {
        return { id: null, name: '' }
      }
    },
    etapaAutoRespostaEdicao: {
      type: Object,
      default: () => {
        return { id: null }
      }
    }
  },
  data () {
    return {
      etapa: {
        reply: null,
        idAutoReply: null,
        action: null,
        initialStep: false
      }
    }
  },
  methods: {
    // Método para fechar o modal de emojis quando clicar fora
    handleClickOutsideEmojiPicker (event) {
      // Verificar se o clique foi fora do modal de emojis
      const emojiPicker = this.$refs.emojiPicker

      // Verificar se o clique foi no botão que abre o emoji picker
      const isEmojiButton = event.target.closest('.q-btn') &&
                           event.target.closest('.q-btn').querySelector('.mdi-emoticon-happy-outline')

      // Verificar se o clique foi dentro do emoji picker
      const isInsideEmojiPicker = emojiPicker && emojiPicker.$el && emojiPicker.$el.contains(event.target)

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

      // Se clicou fora do emoji picker, não foi no botão e não foi em elementos do emoji picker, fechar o modal
      if (!isInsideEmojiPicker && !isEmojiButton && !isEmojiPickerElement) {
        // Fechar o modal de emoji (q-menu)
        if (emojiPicker && emojiPicker.hide) {
          emojiPicker.hide()
        }
      }
    },
    onEmojiSelect (event) {
      const emoji = event.detail.unicode || event.detail.emoji
      if (!emoji) {
        this.$q.notify({
          type: 'warning',
          message: 'Erro ao inserir emoji. Tente novamente.',
          position: 'bottom-right',
          timeout: 3000
        })
        return
      }
      const textarea = this.$refs.inputEnvioMensagem
      if (!textarea) return
      const startPos = textarea.selectionStart
      const endPos = textarea.selectionEnd
      const tmpStr = textarea.value || this.etapa.reply
      const newValue = tmpStr.substring(0, startPos) + emoji + tmpStr.substring(endPos, tmpStr.length)
      this.etapa.reply = newValue
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = startPos + emoji.length
        textarea.focus()
      }, 10)
    },
    fecharModal () {
      this.$emit('update:etapaAutoRespostaEdicao', { id: null })
      this.$emit('update:modalEtapaAutoResposta', false)
    },
    abrirModal () {
      if (this.etapaAutoRespostaEdicao.id) {
        this.etapa = { ...this.etapaAutoRespostaEdicao }
      } else {
        this.etapa = {
          reply: null,
          idAutoReply: null,
          initialStep: false
        }
        this.etapa.idAutoReply = this.autoReply.id
      }
    },
    verificarEtapaInicial (dataParams) {
      const isInitialExists = this.autoReply.stepsReply ? this.autoReply.stepsReply.find(s => s.initialStep && s.id !== dataParams.id) : {}
      if (isInitialExists && dataParams.initialStep) {
        this.$q.notify({
          type: 'negative',
          progress: true,
          timeout: 100000,
          position: 'bottom-right',
          closeBtn: true,
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }],
          message: `Cada Auto Resposta poderá ter apenas uma etapa inicial. A etapa de "ID: ${isInitialExists.id}" está indicada como a etapa inicial. Caso deseje alterar, precisa primerio editar a etapa ("ID: ${isInitialExists.id}") para que não seja a etapa inicial.`
        })
        throw new Error('Etapa Inicial na Auto Resposta já existente')
      }
    },
    async handleEtapaAutoresposta () {
      this.loading = true
      const dataParams = {
        ...this.etapa,
        idAutoReply: this.autoReply.id
      }
      this.verificarEtapaInicial(dataParams)
      try {
        if (this.etapa.id) {
          const { data } = await EditarEtapaResposta(dataParams)
          this.$emit('etapaAutoResposta:editada', { ...dataParams, ...data })
          this.$q.notify({
            type: 'info',
            progress: true,
            position: 'bottom-right',
            textColor: 'black',
            message: 'Etapa editada!',
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
        } else {
          const { data } = await CriarEtapaResposta(dataParams)
          this.$emit('etapaAutoResposta:criada', data)
          this.$q.notify({
            type: 'positive',
            progress: true,
            position: 'bottom-right',
            message: 'Etapa criada!',
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
        }
        this.fecharModal()
      } catch (error) {
        console.error(error)
      }
      this.loading = false
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
</style>
