<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    persistent
    transition-show="scale"
    transition-hide="scale"
    class="modal-modern"
  >
    <q-card class="modal-agendar-mensagem" style="width: 600px; max-width: 90vw; max-height: 75vh; overflow-y: auto;">
      <q-card-section class="modal-header row items-center q-pb-none">
        <div class="text-subtitle1 text-primary">
          <q-icon name="mdi-calendar-plus" class="q-mr-xs text-primary" size="sm" />
          Agendar Nova Mensagem
        </div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          class="close-btn"
          @click="cancelar"
        />
      </q-card-section>

      <q-separator class="q-mt-md separator-custom" />

      <q-card-section>
        <div class="row q-gutter-md">
          <!-- Data e Hora do Agendamento -->
          <div class="col-12 col-md-6">
            <q-input
              filled
              v-model="agendamento.data"
              label="Data do Agendamento"
              mask="##/##/####"
              :rules="[val => !!val || 'Data é obrigatória']"
            >
              <template v-slot:append>
                <q-icon name="mdi-calendar" class="cursor-pointer" size="sm">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date
                      v-model="agendamento.data"
                      mask="DD/MM/YYYY"
                      :options="optionsDate"
                    >
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="Fechar" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>

          <div class="col-12 col-md-6">
            <q-input
              filled
              v-model="agendamento.hora"
              label="Hora do Agendamento"
              mask="##:##"
              :rules="[val => !!val || 'Hora é obrigatória']"
            >
              <template v-slot:append>
                <q-icon name="mdi-clock" class="cursor-pointer" size="sm">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-time
                      v-model="agendamento.hora"
                      format24h
                    >
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="Fechar" color="primary" flat />
                      </div>
                    </q-time>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
        </div>

        <!-- Preview da data/hora selecionada -->
        <div v-if="dataHoraCompleta" class="q-mt-md">
          <q-banner class="bg-blue-1 text-blue-8" rounded>
            <template v-slot:avatar>
              <q-icon name="mdi-information" size="sm" />
            </template>
            <strong>Mensagem será enviada em:</strong> {{ dataHoraFormatada }}
          </q-banner>
        </div>

        <!-- Conteúdo da Mensagem -->
        <div class="q-mt-lg">
          <div class="text-body2 q-mb-md">
            <q-icon name="mdi-message-text" class="q-mr-xs" size="sm" />
            Conteúdo da Mensagem
          </div>

          <!-- Mensagens Rápidas -->
          <div v-if="mensagensRapidas && mensagensRapidas.length > 0" class="q-mb-md">
            <q-select
              filled
              v-model="mensagemRapidaSelecionada"
              :options="mensagensRapidas"
              option-label="shortcode"
              option-value="message"
              label="Mensagens Rápidas (opcional)"
              clearable
              @input="aplicarMensagemRapida"
            >
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps" v-on="scope.itemEvents">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.shortcode }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.message }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>

          <!-- Campo de texto da mensagem -->
          <q-input
            filled
            v-model="agendamento.mensagem"
            label="Digite sua mensagem"
            type="textarea"
            rows="4"
            counter
            maxlength="4096"
            :rules="[val => !!val || 'Mensagem é obrigatória']"
            placeholder="Digite o conteúdo da mensagem que será enviada..."
          />
        </div>

        <!-- Opções Avançadas -->
        <q-expansion-item
          class="q-mt-md"
          icon="mdi-cog"
          label="Opções Avançadas"
          header-class="text-primary text-body2"
        >
          <div class="q-pa-md bg-grey-1 rounded-borders">
            <div class="row q-gutter-md">
              <div class="col">
                <q-checkbox
                  v-model="agendamento.opcoes.repetir"
                  label="Repetir mensagem"
                  color="primary"
                />
              </div>

              <div class="col" v-if="agendamento.opcoes.repetir">
                <q-select
                  filled
                  v-model="agendamento.opcoes.intervaloRepeticao"
                  :options="opcoesRepeticao"
                  label="Intervalo de repetição"
                  dense
                />
              </div>
            </div>

            <div class="q-mt-md">
              <q-checkbox
                v-model="agendamento.opcoes.notificarFalha"
                label="Notificar em caso de falha no envio"
                color="primary"
              />
            </div>
          </div>
        </q-expansion-item>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="q-pa-md">
        <q-btn
          flat
          label="Cancelar"
          color="grey-7"
          size="sm"
          @click="cancelar"
        />
        <q-btn
          unelevated
          label="Agendar Mensagem"
          color="primary"
          icon="mdi-calendar-check"
          size="sm"
          :loading="loading"
          :disable="!formularioValido"
          @click="agendarMensagem"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { format, isValid, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EnviarMensagemTexto } from 'src/service/tickets'
import { uid } from 'quasar'

export default {
  name: 'ModalAgendarMensagem',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    ticketId: {
      type: [Number, String],
      default: null
    },
    mensagensRapidas: {
      type: Array,
      default: () => []
    },
    scheduledMessages: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      loading: false,
      mensagemRapidaSelecionada: null,
      agendamento: {
        data: '',
        hora: '',
        mensagem: '',
        opcoes: {
          repetir: false,
          intervaloRepeticao: null,
          notificarFalha: true
        }
      },
      opcoesRepeticao: [
        { label: 'Diariamente', value: 'daily' },
        { label: 'Semanalmente', value: 'weekly' },
        { label: 'Mensalmente', value: 'monthly' }
      ]
    }
  },
  computed: {
    dataHoraCompleta () {
      if (!this.agendamento.data || !this.agendamento.hora) return null

      try {
        const dataStr = this.agendamento.data.split('/').reverse().join('-')
        const dataHora = new Date(`${dataStr}T${this.agendamento.hora}:00`)
        return isValid(dataHora) ? dataHora : null
      } catch (error) {
        return null
      }
    },

    dataHoraFormatada () {
      if (!this.dataHoraCompleta) return ''
      return format(this.dataHoraCompleta, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    },

    formularioValido () {
      return (
        this.agendamento.data &&
        this.agendamento.hora &&
        this.agendamento.mensagem &&
        this.dataHoraCompleta &&
        !isBefore(this.dataHoraCompleta, new Date())
      )
    }
  },
  watch: {
    modelValue (newVal) {
      if (newVal) {
        this.resetarFormulario()
      }
    }
  },
  methods: {
    optionsDate (date) {
      // Só permite datas a partir de hoje
      const hoje = new Date()
      const dataComparar = new Date(date)
      return dataComparar >= hoje.setHours(0, 0, 0, 0)
    },

    aplicarMensagemRapida (mensagemRapida) {
      if (mensagemRapida) {
        this.agendamento.mensagem = mensagemRapida.message
      }
    },

    resetarFormulario () {
      this.agendamento = {
        data: '',
        hora: '',
        mensagem: '',
        opcoes: {
          repetir: false,
          intervaloRepeticao: null,
          notificarFalha: true
        }
      }
      this.mensagemRapidaSelecionada = null
    },

    async agendarMensagem () {
      if (!this.formularioValido) {
        this.$q.notify({
          type: 'warning',
          message: 'Preencha todos os campos obrigatórios',
          position: 'bottom-right'
        })
        return
      }

      if (!this.dataHoraCompleta) {
        this.$q.notify({
          type: 'warning',
          message: 'Data e hora são obrigatórias',
          position: 'bottom-right'
        })
        return
      }

      if (isBefore(this.dataHoraCompleta, new Date())) {
        this.$q.notify({
          type: 'warning',
          message: 'A data/hora deve ser no futuro',
          position: 'bottom-right'
        })
        return
      }

      this.loading = true

      try {
        // Preparar dados da mensagem para agendamento
        const messageData = {
          body: this.agendamento.mensagem,
          fromMe: true,
          read: 1,
          mediaUrl: '',
          scheduleDate: this.dataHoraCompleta.toISOString(),
          sendType: 'schedule',
          quotedMsg: null,
          quotedMsgId: null,
          id: uid()
        }

        // Enviar mensagem agendada para a API
        await EnviarMensagemTexto(this.ticketId, messageData)

        this.$q.notify({
          type: 'positive',
          message: 'Mensagem agendada com sucesso!',
          position: 'bottom-right'
        })

        // Emit antes de resetar o formulário
        this.$emit('mensagem-agendada', {
          ticketId: this.ticketId,
          scheduleDate: this.dataHoraCompleta.toISOString(),
          body: this.agendamento.mensagem,
          opcoes: this.agendamento.opcoes
        })

        this.resetarFormulario()
        this.$emit('update:modelValue', false)
      } catch (error) {
        console.error('Erro ao agendar mensagem:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao agendar mensagem. Tente novamente.',
          position: 'bottom-right'
        })
      } finally {
        this.loading = false
      }
    },

    cancelar () {
      this.resetarFormulario()
      this.$emit('update:modelValue', false)
    }
  }
}
</script>

<style lang="scss" scoped>
.modal-agendar-mensagem {
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;

  .modal-header {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    padding: 16px 20px;
    border-bottom: 1px solid #dee2e6;

    .text-subtitle1 {
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

  .separator-custom {
    background: linear-gradient(90deg, transparent 0%, #1976d2 50%, transparent 100%);
    height: 2px;
  }
}

.q-expansion-item {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  margin-bottom: 16px;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
}

.q-field {
  .q-field__control {
    border-radius: 8px;
  }
}

.q-btn {
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;

  &.q-btn--standard {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }
}

.q-card-section {
  padding: 8px 12px;
}

.modal-agendar-mensagem {
  .q-card-section:first-child {
    padding: 8px 12px;
  }

  .q-card-actions {
    padding: 8px 12px;
  }
}

// Dark mode styles
.body--dark {
  .modal-agendar-mensagem {
    .modal-header {
      background: linear-gradient(135deg, $dark-secondary 0%, $dark-primary 100%);
      border-bottom-color: $dark-border;

      .close-btn:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }
  }

  .q-expansion-item {
    border-color: $dark-border;
    background-color: $dark-secondary;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
  }

  .bg-grey-1 {
    background: $dark-secondary !important;
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .modal-agendar-mensagem {
    border-radius: 0;
    max-height: 95vh !important;
    overflow-y: auto;

    .modal-header {
      padding: 12px 16px;
    }

    .q-card-section {
      padding: 12px 16px;
    }

    .row.q-gutter-md {
      margin: -8px;

      > div {
        padding: 8px;
      }
    }
  }

  .q-expansion-item {
    margin-bottom: 12px;
  }

  .q-field {
    margin-bottom: 12px;
  }
}
</style>
