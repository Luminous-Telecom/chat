<template>
  <q-dialog
    :value="modalAcaoEtapa"
    @hide="fecharModal"
    @show="abrirModal"
    persistent
    position="top"
  >
    <q-card
      style="width: 600px"
      class="q-pa-lg"
    >
      <q-card-section>
        <div class="text-h6">{{ acaoEtapaEdicao.id ? 'Editar': 'Criar' }} Ação Etapa</div>
      </q-card-section>
      <q-card-section>
        <div class="row">
          <div class="col">
            <q-input
              dense
              square
              outlined
              v-model="acaoEtapa.words"
              label="Chave"
            />
          </div>
        </div>
        <div class="row q-mt-md">
          <div class="col">
            <q-option-group
              inline
              v-model="acaoEtapa.action"
              :options="optionsAcao"
              color="primary"
            />
          </div>
        </div>
        <div class="row q-mt-md">
          <div class="col">
            <q-select
              v-if="acaoEtapa.action === 0"
              dense
              outlined
              class="full-width"
              v-model="acaoEtapa.nextStepId"
              :options="autoReply.stepsReply"
              option-label="id"
              option-value="id"
              label="Etapa"
              map-options
              emit-value
              clearable
              @input="acaoEtapa.queueId = null; acaoEtapa.userIdDestination = null"
            />
            <q-select
              v-if="acaoEtapa.action === 1"
              dense
              outlined
              class="full-width"
              v-model="acaoEtapa.queueId"
              :options="filas"
              option-label="queue"
              option-value="id"
              label="Fila"
              map-options
              emit-value
              clearable
              @input="acaoEtapa.nextStepId = null; acaoEtapa.userIdDestination = null"
            />
            <q-select
              v-if="acaoEtapa.action === 2"
              dense
              outlined
              class="full-width"
              v-model="acaoEtapa.userIdDestination"
              :options="usuarios"
              option-label="name"
              option-value="id"
              label="Usuário"
              map-options
              emit-value
              clearable
              @input="acaoEtapa.nextStepId = null; acaoEtapa.queueId = null"
            />
          </div>
        </div>
        <div class="row items-center q-mt-md">
          <div class="col-xs-3 col-sm-2 col-md-1">
            <q-btn
              round
              flat
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
                <EmojiPicker
                  :theme="$q.dark.isActive ? 'dark' : 'light'"
                  :locale="'pt'"
                  native
                  style="width: 420px"
                  @select="onEmojiSelectMart"
                />
              </q-menu>
            </q-btn>
          </div>
          <div class="col-xs-8 col-sm-10 col-md-11 q-pl-sm">
            <label class="text-caption">Mensagem retorno:</label>
            <textarea
              ref="inputEnvioMensagem"
              style="min-height: 10vh; max-height: 10vh;"
              class="q-pa-sm bg-white full-width"
              placeholder="Digita a mensagem"
              autogrow
              dense
              outlined
              @input="(v) => acaoEtapa.replyDefinition = v.target.value"
              :value="acaoEtapa.replyDefinition"
            />
          </div>
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
          @click="handleAcaoEtapa"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

</template>

<script>
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
const userId = +localStorage.getItem('userId')
import { CriarAcaoEtapa, EditarAcaoEtapa } from 'src/service/autoResposta'

export default {
  name: 'ModalAcaoEtapa',
  components: {
    EmojiPicker
  },
  props: {
    modalAcaoEtapa: {
      type: Boolean,
      default: false
    },
    acaoEtapaEdicao: {
      type: Object,
      default: () => {
        return { id: null }
      }
    },
    etapaAutoResposta: {
      type: Object,
      default: () => {
        return { id: null }
      }
    },
    filas: {
      type: Array,
      default: () => []
    },
    usuarios: {
      type: Array,
      default: () => []
    },
    autoReply: {
      type: Object,
      default: () => { }
    }
  },
  data () {
    return {
      acaoEtapa: {
        stepReplyId: null,
        words: null,
        action: null,
        userId,
        queueId: null,
        userIdDestination: null,
        nextStepId: null,
        replyDefinition: null
      },
      optionsAcao: [
        { value: 0, label: 'Proxima Etapa' },
        { value: 1, label: 'Enviar para Fila' },
        { value: 2, label: 'Enviar para usuário' }
      ]
    }
  },
  methods: {
    resetAcaoEtapa () {
      this.acaoEtapa = {
        stepReplyId: null,
        words: null,
        action: null,
        userId,
        queueId: null,
        userIdDestination: null,
        nextStepId: null,
        replyDefinition: null
      }
    },
    abrirModal () {
      if (this.acaoEtapaEdicao.id) {
        this.acaoEtapa = {
          ...this.acaoEtapaEdicao,
          userId
        }
      } else {
        this.resetAcaoEtapa()
      }
    },
    fecharModal () {
      this.resetAcaoEtapa()
      this.$emit('update:acaoEtapaEdicao', { id: null })
      this.$emit('update:modalAcaoEtapa', false)
    },
    async handleAcaoEtapa () {
      const params = {
        ...this.acaoEtapa,
        stepReplyId: this.etapaAutoResposta.id
      }
      if (params.id) {
        const { data } = await EditarAcaoEtapa(params)
        this.$emit('acaoEtapa:editada', data)
        this.$q.notify({
          type: 'info',
          progress: true,
          position: 'bottom-right',
          textColor: 'black',
          message: 'Ação editada!',
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
      } else {
        const { data } = await CriarAcaoEtapa(params)
        this.$emit('acaoEtapa:criada', data)
        this.$q.notify({
          type: 'positive',
          progress: true,
          position: 'bottom-right',
          message: 'Ação criada!',
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
      }
      this.fecharModal()
    },
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
    onEmojiSelectMart (emoji) {
      console.log('Emoji selecionado:', emoji)

      // emoji.native contém o caractere emoji selecionado
      const emojiChar = emoji.native

      if (!emojiChar) {
        console.warn('Nenhum emoji encontrado:', emoji)
        this.$q.notify({
          type: 'warning',
          message: 'Erro ao inserir emoji. Tente novamente.',
          position: 'bottom-right',
          timeout: 3000
        })
        return
      }

      // Inserir emoji no textarea
      const textarea = this.$refs.inputEnvioMensagem
      if (!textarea) {
        console.warn('Textarea não encontrado')
        return
      }

      // Obter posição do cursor
      const startPos = textarea.selectionStart
      const endPos = textarea.selectionEnd
      const currentValue = this.acaoEtapa.replyDefinition || ''

      // Inserir emoji na posição do cursor
      const newValue = currentValue.substring(0, startPos) + emojiChar + currentValue.substring(endPos)
      this.acaoEtapa.replyDefinition = newValue

      // Mover cursor para depois do emoji
      this.$nextTick(() => {
        textarea.focus()
        textarea.selectionStart = textarea.selectionEnd = startPos + emojiChar.length
      })

      console.log('Emoji inserido com sucesso:', emojiChar)
    }
  },
  mounted () {
    // Adicionar event listener para fechar o modal ao clicar fora
    document.addEventListener('click', this.handleClickOutsideEmojiPicker)
  },
  beforeDestroy () {
    // Remover event listener ao destruir o componente
    document.removeEventListener('click', this.handleClickOutsideEmojiPicker)
  }
}
</script>

<style lang="scss" scoped>
</style>
