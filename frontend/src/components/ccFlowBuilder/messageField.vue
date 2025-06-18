<template>
  <div>
    <q-card flat class="q-pa-sm q-pb-md">
      <q-card-section class="q-pa-none">
        <div class="flex flex-inline full-width items-center">
          <div class="flex flex-inline text-left" style="width: 40px">
            <q-btn round flat dense>
              <q-icon size="2em" name="mdi-emoticon-happy-outline" />
              <q-tooltip>
                Emoji
              </q-tooltip>
              <q-menu anchor="top right" self="bottom middle" :offset="[5, 40]">
                <emoji-picker
                  style="width: 40vw"
                  @emoji-click="onInsertSelectEmoji"
                />
              </q-menu>
            </q-btn>
            <q-btn round flat dense>
              <q-icon size="2em" name="mdi-variable" />
              <q-tooltip>
                Variáveis
              </q-tooltip>
              <q-menu touch-position>
                <q-list dense style="min-width: 100px">
                  <q-item v-for="variavel in variaveis" :key="variavel.label" clickable
                    @click="onInsertSelectVariable(variavel.value)" v-close-popup>
                    <q-item-section>{{ variavel.label }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
          <textarea ref="inputEnvioMensagem" style="min-height: 10vh; max-height: 30vh; flex: auto"
            class="q-pa-sm bg-white rounded-all" placeholder="Digite a mensagem" autogrow dense outlined
            @input="(v) => $attrs.element.data.message = v.target.value" :value="$attrs.element.data.message">
          </textarea>
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
  data () {
    return {
      variaveis: [
        { label: 'Nome', value: '{{name}}' },
        { label: 'Saudação', value: '{{greeting}}' },
        { label: 'Protocolo', value: '{{protocol}}' }
      ]
    }
  },
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
    },
    onInsertSelectVariable (variable) {
      // onInsertSelectVariable
      const self = this
      var tArea = this.$refs.inputEnvioMensagem
      // get cursor's position:
      var startPos = tArea.selectionStart,
        endPos = tArea.selectionEnd,
        cursorPos = startPos,
        tmpStr = tArea.value
      // filter:
      if (!variable) {
        return
      }
      // insert:
      self.txtContent = this.$attrs.element.data.message
      self.txtContent = tmpStr.substring(0, startPos) + variable + tmpStr.substring(endPos, tmpStr.length)
      this.$attrs.element.data.message = self.txtContent
      // move cursor:
      setTimeout(() => {
        tArea.selectionStart = tArea.selectionEnd = cursorPos + 1
      }, 10)
    }
  }
}
</script>

<style lang="scss" scoped></style>
