<template>
  <q-dialog
    persistent
    :value="modalMensagemRapida"
    @hide="fecharModal"
    @show="abrirModal"
  >
    <q-card
      :style="$q.screen.width < 500 ? 'width: 95vw' : 'min-width: 700px; max-width: 700px'"
      class="q-pa-lg"
    >
      <div class="text-h6">{{ mensagemRapida.id ? 'Editar': 'Criar' }} Mensagem Rápida {{ mensagemRapida.id  ? `(ID: ${mensagemRapida.id})` : '' }}</div>
      <q-card-section class="q-pa-none">
        <div class="row q-my-md">
          <div class="col">
            <q-input
              style="width: 200px; margin-left: 62px"
              outlined
              rounded
              dense
              v-model="mensagemRapida.key"
              label="Chave"
            />
            <p style="margin-left: 62px; font-size: 10px; margin-top: 3px;">
              A chave é o atalho para pesquisa da mensagem pelos usuários.
            </p>
          </div>
        </div>
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
            <label class="text-caption">Mensagem:</label>
            <textarea
              ref="inputEnvioMensagem"
              style="min-height: 15vh; max-height: 15vh;"
              class="q-pa-sm bg-white full-width rounded-all"
              placeholder="Digite a mensagem"
              autogrow
              dense
              outlined
              @input="(v) => mensagemRapida.message = v.target.value"
              :value="mensagemRapida.message"
            />
          </div>
        </div>
      </q-card-section>
      <q-card-actions
        align="right"
        class="q-mt-md"
      >
        <q-btn
          rounded
          label="Cancelar"
          color="negative"
          v-close-popup
          class="q-mr-md"
        />
        <q-btn
          rounded
          label="Salvar"
          color="positive"
          @click="handleMensagemRapida"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { CriarMensagemRapida, AlterarMensagemRapida } from 'src/service/mensagensRapidas'
import 'emoji-picker-element'

export default {
  name: 'ModalMensagemRapida',
  props: {
    modalMensagemRapida: {
      type: Boolean,
      default: false
    },
    mensagemRapidaEmEdicao: {
      type: Object,
      default: () => {
        return { id: null, key: '', message: '' }
      }
    }
  },
  data () {
    return {
      mensagemRapida: {
        key: null,
        message: null
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
          position: 'top',
          timeout: 3000
        })
        return
      }
      const textarea = this.$refs.inputEnvioMensagem
      if (!textarea) return
      const startPos = textarea.selectionStart
      const endPos = textarea.selectionEnd
      const tmpStr = textarea.value || this.mensagemRapida.message
      const newValue = tmpStr.substring(0, startPos) + emoji + tmpStr.substring(endPos, tmpStr.length)
      this.mensagemRapida.message = newValue
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = startPos + emoji.length
        textarea.focus()
      }, 10)
    },
    fecharModal () {
      this.$emit('update:mensagemRapidaEmEdicao', { id: null })
      this.$emit('update:modalMensagemRapida', false)
    },
    abrirModal () {
      if (this.mensagemRapidaEmEdicao.id) {
        this.mensagemRapida = { ...this.mensagemRapidaEmEdicao }
      } else {
        this.mensagemRapida = {
          key: null,
          message: null
        }
      }
    },
    async handleMensagemRapida () {
      this.loading = true
      try {
        if (this.mensagemRapida.id) {
          const { data } = await AlterarMensagemRapida(this.mensagemRapida)
          this.$emit('mensagemRapida:editada', { ...this.mensagemRapida, ...data })
          this.$q.notify({
            type: 'info',
            progress: true,
            position: 'top',
            textColor: 'black',
            message: 'Mensagem Rápida editada!',
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
        } else {
          const { data } = await CriarMensagemRapida(this.mensagemRapida)
          this.$emit('mensagemRapida:criada', data)
          this.$q.notify({
            type: 'positive',
            progress: true,
            position: 'top',
            message: 'Mensagem rápida criada!',
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
