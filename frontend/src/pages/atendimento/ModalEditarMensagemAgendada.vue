<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    persistent
    transition-show="scale"
    transition-hide="scale"
  >
    <q-card style="width: 600px; max-width: 90vw; max-height: 70vh; overflow-y: auto;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Editar Mensagem Agendada</div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          @click="$emit('input', false)"
        />
      </q-card-section>

      <q-card-section class="q-pt-none">
                <q-form @submit="editarMensagem" class="q-gutter-md">
          <!-- Campo de Mensagem -->
          <q-input
            v-model="form.body"
            type="textarea"
            rows="3"
            outlined
            label="Mensagem *"
            placeholder="Digite sua mensagem..."
            :rules="[v => !!v || 'Mensagem é obrigatória']"
            counter
            maxlength="4096"
          />

          <!-- Data e Hora -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-input
                v-model="form.date"
                outlined
                label="Data *"
                mask="##/##/####"
                :rules="dateRules"
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date
                        v-model="form.date"
                        mask="DD/MM/YYYY"
                        :options="dateOptions"
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

            <div class="col">
              <q-input
                v-model="form.time"
                outlined
                label="Hora *"
                mask="##:##"
                :rules="timeRules"
              >
                <template v-slot:append>
                  <q-icon name="access_time" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-time
                        v-model="form.time"
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

                    <!-- Data/Hora Completa (readonly) -->
          <q-input
            :value="dataHoraFormatada"
            outlined
            readonly
            label="Data/Hora Final"
            class="readonly-field"
          />

          <!-- Informações da Mensagem Original -->
          <div v-if="mensagemValida" class="q-mt-md">
            <q-banner class="bg-blue-1 text-blue-8" rounded dense>
              <template v-slot:avatar>
                <q-icon name="info" />
              </template>
                             <div class="text-caption">
                 <div><strong>Para:</strong> {{ nomeContato }}</div>
                 <div><strong>Status:</strong> {{ mensagem.status === 'pending' ? 'Agendada' : mensagem.status }}</div>
                 <div v-if="mensagem.scheduleDate"><strong>Agendamento original:</strong> {{ $formatarData(mensagem.scheduleDate, 'dd/MM/yyyy HH:mm') }}</div>
               </div>
            </q-banner>
          </div>

          <!-- Botões -->
          <div class="row q-gutter-md q-mt-md">
            <q-btn
              label="Cancelar"
              flat
              color="grey"
              @click="$emit('input', false)"
            />
            <q-btn
              label="Salvar Alterações"
              type="submit"
              color="primary"
              :loading="loading"
              :disable="!formularioValido"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { format, isValid, isBefore, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EditarMensagemAgendada } from 'src/service/tickets'

export default {
  name: 'ModalEditarMensagemAgendada',

  props: {
    value: {
      type: Boolean,
      default: false
    },
    mensagem: {
      type: Object,
      default: () => ({})
    },
    nomeContato: {
      type: String,
      default: 'Contato não identificado'
    }
  },

  data () {
    return {
      loading: false,
      form: {
        body: '',
        date: '',
        time: ''
      }
    }
  },

  computed: {
    formularioValido () {
      return !!(
        this.form.body?.trim() &&
        this.form.date &&
        this.form.time &&
        this.dataHoraCompleta &&
        isValid(this.dataHoraCompleta) &&
        isBefore(new Date(), this.dataHoraCompleta)
      )
    },

    dataHoraCompleta () {
      if (!this.form.date || !this.form.time) return null

      try {
        const dateStr = `${this.form.date} ${this.form.time}`
        const parsed = parse(dateStr, 'dd/MM/yyyy HH:mm', new Date())
        return isValid(parsed) ? parsed : null
      } catch (error) {
        return null
      }
    },

    dataHoraFormatada () {
      if (!this.dataHoraCompleta) return ''
      return format(this.dataHoraCompleta, 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })
    },

    mensagemValida () {
      return this.mensagem && typeof this.mensagem === 'object' && this.mensagem.id
    },

    dateRules () {
      return [
        v => !!v || 'Data é obrigatória',
        v => {
          if (!v) return true
          const parsed = parse(v, 'dd/MM/yyyy', new Date())
          return isValid(parsed) || 'Data inválida'
        }
      ]
    },

    timeRules () {
      return [
        v => !!v || 'Hora é obrigatória',
        v => {
          if (!v) return true
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
          return timeRegex.test(v) || 'Hora inválida (formato: HH:MM)'
        }
      ]
    }
  },

  watch: {
    value (newVal) {
      if (newVal && this.mensagemValida) {
        this.carregarDadosMensagem()
      }
    },

    mensagem: {
      handler () {
        if (this.value && this.mensagemValida) {
          this.carregarDadosMensagem()
        }
      },
      deep: true
    }
  },

  methods: {
    carregarDadosMensagem () {
      if (!this.mensagemValida) return

      try {
        this.form.body = this.mensagem.body || ''

        if (this.mensagem.scheduleDate) {
          const scheduleDate = new Date(this.mensagem.scheduleDate)

          // Verificar se a data é válida
          if (isValid(scheduleDate)) {
            this.form.date = format(scheduleDate, 'dd/MM/yyyy')
            this.form.time = format(scheduleDate, 'HH:mm')
          } else {
            console.warn('Data de agendamento inválida:', this.mensagem.scheduleDate)
            this.form.date = ''
            this.form.time = ''
          }
        } else {
          this.form.date = ''
          this.form.time = ''
        }
      } catch (error) {
        console.error('Erro ao carregar dados da mensagem:', error)
        this.form = {
          body: '',
          date: '',
          time: ''
        }
      }
    },

    dateOptions (date) {
      // Permitir apenas datas futuras
      return date >= format(new Date(), 'yyyy/MM/dd')
    },

    async editarMensagem () {
      if (!this.mensagemValida) {
        this.$q.notify({
          type: 'warning',
          message: 'Mensagem inválida',
          position: 'bottom-right'
        })
        return
      }

      if (!this.formularioValido) {
        this.$q.notify({
          type: 'warning',
          message: 'Preencha todos os campos obrigatórios',
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
        const dados = {
          body: this.form.body.trim(),
          scheduleDate: this.dataHoraCompleta.toISOString()
        }

        await EditarMensagemAgendada(this.mensagem.id, dados)

        this.$q.notify({
          type: 'positive',
          message: 'Mensagem agendada editada com sucesso!',
          position: 'bottom-right',
          timeout: 3000
        })

        this.$emit('mensagem-editada', {
          ...this.mensagem,
          ...dados
        })

        this.$emit('input', false)
      } catch (error) {
        console.error('Erro ao editar mensagem agendada:', error)
        this.$q.notify({
          type: 'negative',
          message: error.response?.data?.message || 'Erro ao editar mensagem agendada',
          position: 'bottom-right'
        })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.readonly-field {
  .q-field__control {
    background: #fafafa;
  }
}

// Dark theme support
.body--dark {
  .q-card {
    background: var(--q-dark-page);
    color: var(--q-color-on-surface);
  }

  .readonly-field {
    .q-field__control {
      background: rgba(255, 255, 255, 0.05);
    }
  }

  .q-banner.bg-blue-1 {
    background: rgba(33, 150, 243, 0.1) !important;
    color: var(--q-color-on-surface) !important;
  }
}
</style>
