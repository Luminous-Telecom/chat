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
  }
}
</script>

<style lang="scss" scoped>
</style>
