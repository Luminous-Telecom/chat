<template>
  <div>
    <q-card
      class="q-ma-sm "
      square
    >
      <div class="text-h5 q-pa-sm q-ma-sm">
        Horário de Atendimento
        <q-icon name="help">
          <q-tooltip content-class="bg-light-blue-1 text-black q-pa-sm shadow-4">
            <span class="text-weight-medium"> Tipos de horário: </span>
            <span class="row col">
              Aberto: Estabelecimento aberto durante todo o dia. Não será feito envio de mensagem de ausência;
            </span>
            <span class="row col">
              Fechado: Estabelecimento fechado durante todo o dia. Será feito envio de mensagem de ausência, independente do horário;
            </span>
            <span class="row col">
              Horário: Representa o horário de funcionamento do estabelecimento. O sistema enviará mensagem de ausênica quando mensagens forem recebidas fora dos horários estabelecidos.
            </span>
            <span class="row col">
              **Importante: A mensagem de ausência será enviada após o encerramento do atendimento automático.
            </span>
          </q-tooltip>
        </q-icon>

        <q-btn
          rounded
          color="positive"
          label="Salvar"
          class="float-right"
          @click="salvarHorariosAtendimento"
        />
      </div>
      <q-separator />
      <q-card-section>
        <div class="row q-col-gutter-sm">
          <div
            class="col-xs-12 col-sm-4 q-mt-sm"
            v-for="dia in businessHours"
            :key="dia.value"
          >
            <q-card
              square
              bordered
              flat
            >
              <div class="text-body1 text-bold bg-grey-3 q-pa-xs q-pl-sm">
                {{ dia.label }}
              </div>
              <q-separator />
              <q-card-section class="q-pt-none">
                <q-option-group
                  inline
                  class="row justify-between q-mb-md"
                  v-model="dia.type"
                  :options="optType"
                  color="primary"
                />

                <div class="row items-baseline q-gutter-sm">
                  <q-input
                    :disable="dia.type !== 'H'"
                    dense
                    rounded
                    outlined
                    class="col-grow"
                    error-message="Obrigatório"
                    hide-underline
                    type="time"
                    v-model="dia.hr1"
                  />
                  <h6>às</h6>
                  <q-input
                    :disable="dia.type !== 'H'"
                    dense
                    rounded
                    outlined
                    class="col-grow"
                    error-message="Obrigatório"
                    hide-underline
                    type="time"
                    v-model="dia.hr2"
                  />
                </div>
                <div class="row items-baseline q-gutter-sm">
                  <q-input
                    :disable="dia.type !== 'H'"
                    dense
                    rounded
                    outlined
                    class="col-grow"
                    error-message="Obrigatório"
                    hide-underline
                    type="time"
                    v-model="dia.hr3"
                  />
                  <h6>às</h6>
                  <q-input
                    :disable="dia.type !== 'H'"
                    dense
                    outlined
                    rounded
                    class="col-grow"
                    error-message="Obrigatório"
                    hide-underline
                    type="time"
                    v-model="dia.hr4"
                  />
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-card-section>
    </q-card>
    <q-card class="q-ma-sm q-mt-md full-full-height">
      <div class="text-h6 q-pa-sm q-ma-sm">
        Mensagem de Ausência
        <q-btn
          color="positive"
          label="Salvar"
          rounded
          class="float-right"
          @click="salvarMensagemAusencia"
        />
      </div>
      <q-card-section class="q-pt-none">
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
                <emoji-picker
                  style="width: 40vw"
                  @emoji-click="onInsertSelectEmoji"
                />
              </q-menu>
            </q-btn>
          </div>
          <div class="col-xs-8 col-sm-10 col-md-11 q-pl-sm">
            <textarea
              ref="inputEnvioMensagem"
              style="min-height: 9vh; max-height: 9vh;"
              class="q-pa-sm bg-white rounded-all full-width"
              placeholder="Digite a mensagem"
              autogrow
              dense
              outlined
              @input="(v) => messageBusinessHours = v.target.value"
              :value="messageBusinessHours"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script>
import 'emoji-picker-element'
import { MostrarHorariosAtendiemento, AtualizarHorariosAtendiemento, AtualizarMensagemHorariosAtendiemento } from 'src/service/empresas'
import { insertEmojiInTextarea } from 'src/utils/emojiUtils'
export default {
  name: 'HorarioAtendimento',
  components: { },
  data () {
    return {
      optType: [
        { value: 'O', label: 'Aberto' },
        { value: 'C', label: 'Fechado' },
        { value: 'H', label: 'Horário' }
      ],
      businessHours: [
        { day: 0, label: 'Domingo', type: 'O', hr1: '08:00', hr2: '12:00', hr3: '14:00', hr4: '18:00' },
        { day: 1, label: 'Segunda-Feira', type: 'O', hr1: '08:00', hr2: '12:00', hr3: '14:00', hr4: '18:00' },
        { day: 2, label: 'Terça-Feira', type: 'O', hr1: '08:00', hr2: '12:00', hr3: '14:00', hr4: '18:00' },
        { day: 3, label: 'Quarta-Feira', type: 'O', hr1: '08:00', hr2: '12:00', hr3: '14:00', hr4: '18:00' },
        { day: 4, label: 'Quinta-Feira', type: 'O', hr1: '08:00', hr2: '12:00', hr3: '14:00', hr4: '18:00' },
        { day: 5, label: 'Sexta-Feira', type: 'O', hr1: '08:00', hr2: '12:00', hr3: '14:00', hr4: '18:00' },
        { day: 6, label: 'Sábado', type: 'O', hr1: '08:00', hr2: '12:00', hr3: '14:00', hr4: '18:00' }
      ],
      messageBusinessHours: null
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
    onInsertSelectEmoji (event) {
      // O emoji está em event.detail.unicode ou event.detail.emoji
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
      const textarea = this.$refs.inputEnvioMensagem
      const success = insertEmojiInTextarea(
        emoji,
        textarea,
        (newValue) => {
          this.messageBusinessHours = newValue
        },
        this.messageBusinessHours
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
    async listarMensagemHorariosAtendimento () {
      const { data } = await MostrarHorariosAtendiemento()
      this.businessHours = data.businessHours
      this.messageBusinessHours = data.messageBusinessHours
    },
    async salvarHorariosAtendimento () {
      const { data } = await AtualizarHorariosAtendiemento(this.businessHours)
      this.businessHours = data.businessHours
    },
    async salvarMensagemAusencia () {
      const { data } = await AtualizarMensagemHorariosAtendiemento({
        messageBusinessHours: this.messageBusinessHours
      })
      this.messageBusinessHours = data.messageBusinessHours
    }
  },
  mounted () {
    this.listarMensagemHorariosAtendimento()
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
