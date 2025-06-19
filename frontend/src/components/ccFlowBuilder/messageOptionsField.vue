<template>
  <div>
    <q-card
      flat
      class="q-pa-sm q-pb-md"
    >
      <q-card-section class="q-pa-none">
        <div class="flex flex-inline full-width items-center">
          <div
            class="flex flex-inline text-left"
            style="width: 40px"
          >
            <q-btn
              round
              flat
              dense
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
                <emoji-picker
                  style="width: 40vw"
                  @emoji-click="onInsertSelectEmoji"
                />
              </q-menu>
            </q-btn>
          </div>
          <textarea
            ref="inputEnvioMensagem"
            style="min-height: 10vh; max-height: 15vh; flex: auto"
            class="q-pa-sm bg-white"
            placeholder="Digite a mensagem"
            autogrow
            dense
            outlined
            @input="(v) => $attrs.element.data.message = v.target.value"
            :value="$attrs.element.data.message"
          />
        </div>
        <div class="row col q-py-sm q-mb-md">
          <q-select
            v-model="$attrs.element.data.values"
            use-input
            outlined
            use-chips
            multiple
            color="primary"
            hide-dropdown-icon
            input-debounce="0"
            new-value-mode="add-unique"
            class="full-width"
            label="Opções"
            filled
            dense
            hint="Opções serão tratados como Lista/Botões ou texto simples dependendo do suporte do canal de destino."
          />

        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script>
import 'emoji-picker-element'
import { insertEmojiInTextarea } from 'src/utils/emojiUtils'

export default {
  name: 'MessageField',
  components: { },
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
    onInsertSelectEmoji (event) {
      // O emoji está em event.detail.unicode ou event.detail.emoji
      const emoji = event.detail?.unicode || event.detail?.emoji || event.emoji || event.unicode || event.i || event.data
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
      const success = insertEmojiInTextarea(
        emoji,
        textarea,
        (newValue) => {
          this.$attrs.element.data.message = newValue
        },
        this.$attrs.element.data.message
      )

      if (!success) {
        this.$q.notify({
          type: 'warning',
          message: 'Erro ao inserir emoji. Tente novamente.',
          position: 'top',
          timeout: 3000
        })
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
</style>
