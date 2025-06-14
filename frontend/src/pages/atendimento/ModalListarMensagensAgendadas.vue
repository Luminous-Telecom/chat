<template>
  <q-dialog
    :value="value"
    @input="$emit('update:value', $event)"
    persistent
    :maximized="$q.screen.lt.md"
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="modal-listar-mensagens" :style="$q.screen.width < 770 ? 'min-width: 95vw; max-width: 95vw; max-height: 90vh; overflow: hidden' : 'min-width: 70vw; max-width: 70vw; max-height: 85vh; overflow: hidden'">
      <q-card-section class="modal-header row items-center q-pb-none">
        <div class="text-subtitle1 text-primary">
          <q-icon name="mdi-calendar-clock" class="q-mr-xs text-primary" size="sm" />
          Mensagens Agendadas
        </div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          class="close-btn"
          @click="fecharModal"
        />
      </q-card-section>

      <q-card-section class="q-pt-none q-pb-sm">
        <div class="text-caption text-grey-7 counter-badge">
          <q-icon name="mdi-counter" class="q-mr-xs" size="xs" />
          Total: {{ mensagensAgendadas.length }} mensagem(ns) agendada(s)
        </div>
      </q-card-section>

      <q-separator class="separator-custom" />

      <q-card-section class="q-pa-none scroll-container">
        <q-scroll-area class="full-height">
          <div v-if="mensagensAgendadas.length === 0" class="text-center q-pa-lg">
            <q-icon name="mdi-calendar-clock" size="4rem" color="grey-5" />
            <div class="text-h6 text-grey-6 q-mt-md">Nenhuma mensagem agendada</div>
            <div class="text-body2 text-grey-5">Este ticket não possui mensagens agendadas.</div>
          </div>

          <q-list v-else separator>
            <q-item
              v-for="(mensagem, index) in mensagensOrdenadas"
              :key="mensagem.id || index"
              class="q-pa-md"
            >
              <q-item-section avatar>
                <q-avatar color="primary" text-color="white" size="sm">
                  <q-icon name="mdi-calendar-clock" size="sm" />
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-weight-medium text-body2">
                  {{ $formatarData(mensagem.scheduleDate, 'dd/MM/yyyy HH:mm') }}
                </q-item-label>
                <q-item-label caption class="q-mt-xs">
                  <div class="message-content">
                    {{ mensagem.body || 'Mensagem sem conteúdo' }}
                  </div>
                </q-item-label>
                <q-item-label caption class="q-mt-sm text-grey-6">
                  <q-icon name="mdi-account" size="xs" class="q-mr-xs" />
                  Criado por: {{ mensagem.user?.name || 'Sistema' }}
                </q-item-label>
                <q-item-label caption class="text-grey-6">
                  <q-icon name="mdi-clock" size="xs" class="q-mr-xs" />
                  Criado em: {{ $formatarData(mensagem.createdAt, 'dd/MM/yyyy HH:mm') }}
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <div class="column q-gutter-sm">
                  <q-chip
                    :color="getStatusColor(mensagem)"
                    text-color="white"
                    size="xs"
                    dense
                  >
                    {{ getStatusText(mensagem) }}
                  </q-chip>

                  <div class="row q-gutter-xs">
                    <q-btn
                      flat
                      dense
                      round
                      color="primary"
                      icon="mdi-eye"
                      size="xs"
                      @click="visualizarMensagem(mensagem)"
                    >
                      <q-tooltip>Visualizar</q-tooltip>
                    </q-btn>

                    <q-btn
                      v-if="podeEditarMensagem(mensagem)"
                      flat
                      dense
                      round
                      color="orange"
                      icon="mdi-pencil"
                      size="xs"
                      @click="editarMensagem(mensagem)"
                    >
                      <q-tooltip>Editar</q-tooltip>
                    </q-btn>

                    <q-btn
                      v-if="podeCancelarMensagem(mensagem)"
                      flat
                      dense
                      round
                      color="negative"
                      icon="mdi-delete"
                      size="xs"
                      @click="cancelarMensagem(mensagem)"
                    >
                      <q-tooltip>Cancelar</q-tooltip>
                    </q-btn>
                  </div>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="q-pa-md">
        <q-btn
          flat
          label="Fechar"
          color="primary"
          size="sm"
          @click="fecharModal"
        />
        <q-btn
          unelevated
          label="Nova Mensagem Agendada"
          color="primary"
          icon="mdi-plus"
          size="sm"
          @click="novamensagemAgendada"
        />
      </q-card-actions>
    </q-card>

    <!-- Modal de visualização de mensagem -->
    <q-dialog v-model="modalVisualizacao" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-subtitle1">Detalhes da Mensagem Agendada</div>
        </q-card-section>

        <q-card-section v-if="mensagemSelecionada">
          <div class="q-mb-md">
            <div class="text-weight-medium">Data/Hora Agendada:</div>
            <div>{{ $formatarData(mensagemSelecionada.scheduleDate, 'dd/MM/yyyy HH:mm') }}</div>
          </div>

          <div class="q-mb-md">
            <div class="text-weight-medium">Conteúdo:</div>
            <div class="message-preview">{{ mensagemSelecionada.body || 'Mensagem sem conteúdo' }}</div>
          </div>

          <div class="q-mb-md">
            <div class="text-weight-medium">Status:</div>
            <q-chip
              :color="getStatusColor(mensagemSelecionada)"
              text-color="white"
              size="xs"
            >
              {{ getStatusText(mensagemSelecionada) }}
            </q-chip>
          </div>

          <div class="q-mb-md">
            <div class="text-weight-medium">Criado por:</div>
            <div>{{ mensagemSelecionada.user?.name || 'Sistema' }}</div>
          </div>

          <div>
            <div class="text-weight-medium">Criado em:</div>
            <div>{{ $formatarData(mensagemSelecionada.createdAt, 'dd/MM/yyyy HH:mm') }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Fechar" color="primary" size="sm" @click="fecharModalVisualizacao" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-dialog>
</template>

<script>
export default {
  name: 'ModalListarMensagensAgendadas',
  props: {
    value: {
      type: Boolean,
      default: false
    },
    ticketId: {
      type: [Number, String],
      default: null
    },
    mensagensAgendadas: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      modalVisualizacao: false,
      mensagemSelecionada: null
    }
  },
  computed: {
    mensagensOrdenadas () {
      return [...this.mensagensAgendadas].sort((a, b) => {
        return new Date(a.scheduleDate) - new Date(b.scheduleDate)
      })
    }
  },
  methods: {
    getStatusColor (mensagem) {
      if (!mensagem.scheduleDate) return 'grey'

      const agora = new Date()
      const dataAgendada = new Date(mensagem.scheduleDate)

      if (mensagem.status === 'sent') return 'green'
      if (mensagem.status === 'failed') return 'red'
      if (dataAgendada < agora) return 'orange'

      return 'blue'
    },

    getStatusText (mensagem) {
      if (!mensagem.scheduleDate) return 'Indefinido'

      const agora = new Date()
      const dataAgendada = new Date(mensagem.scheduleDate)

      if (mensagem.status === 'sent') return 'Enviada'
      if (mensagem.status === 'failed') return 'Falhou'
      if (dataAgendada < agora) return 'Atrasada'

      return 'Agendada'
    },

    podeEditarMensagem (mensagem) {
      if (mensagem.status === 'sent' || mensagem.status === 'failed') return false

      const agora = new Date()
      const dataAgendada = new Date(mensagem.scheduleDate)

      return dataAgendada > agora
    },

    podeCancelarMensagem (mensagem) {
      return this.podeEditarMensagem(mensagem)
    },

    visualizarMensagem (mensagem) {
      this.mensagemSelecionada = mensagem
      this.modalVisualizacao = true
    },

    editarMensagem (mensagem) {
      this.$q.notify({
        type: 'info',
        message: 'Funcionalidade de edição será implementada em breve',
        position: 'top'
      })
    },

    cancelarMensagem (mensagem) {
      this.$q.dialog({
        title: 'Cancelar Mensagem Agendada',
        message: 'Tem certeza que deseja cancelar esta mensagem agendada?',
        cancel: true,
        persistent: true
      }).onOk(() => {
        this.$q.notify({
          type: 'info',
          message: 'Funcionalidade de cancelamento será implementada em breve',
          position: 'top'
        })
      })
    },

    novamensagemAgendada () {
      this.$emit('update:value', false)
      this.$emit('nova-mensagem-agendada')
    },

    fecharModalVisualizacao () {
      this.modalVisualizacao = false
      this.mensagemSelecionada = null
    },

    fecharModal () {
      this.$emit('update:value', false)
    }
  }
}
</script>

<style lang="scss" scoped>
.modal-listar-mensagens {
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;

  .modal-header {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    padding: 12px 16px;
    border-bottom: 1px solid #dee2e6;
    border-radius: 12px 12px 0 0;

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

  .counter-badge {
    background: rgba(25, 118, 210, 0.1);
    padding: 4px 8px;
    border-radius: 16px;
    display: inline-flex;
    align-items: center;
    font-weight: 500;
    font-size: 0.75rem;
  }

  .scroll-container {
    height: calc(85vh - 140px);
    overflow: hidden;
  }
}

.q-item {
  border-radius: 12px;
  margin: 6px 12px;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  padding: 12px;

  &:hover {
    background: rgba(25, 118, 210, 0.05);
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.q-avatar {
  background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
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

  &.q-btn--outline {
    border-width: 2px;

    &:hover {
      transform: scale(1.05);
    }
  }
}

.message-content {
  max-width: 400px;
  word-wrap: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
}

.message-preview {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 12px 16px;
  border-radius: 12px;
  border-left: 4px solid #1976d2;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 150px;
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.q-scroll-area {
  background: linear-gradient(180deg, rgba(248, 249, 250, 0.5) 0%, rgba(233, 236, 239, 0.3) 100%);
}

// Empty state styling
.text-center {
  .q-icon {
    opacity: 0.6;
    animation: pulse 2s infinite;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.3;
  }
}

// Dark mode styles
.body--dark {
  .modal-listar-mensagens {
    .modal-header {
      background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
      border-bottom-color: #4a5568;

      .close-btn:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }

    .counter-badge {
      background: rgba(66, 165, 245, 0.2);
      color: #90caf9;
    }
  }

  .q-item {
    background: rgba(45, 55, 72, 0.8);

    &:hover {
      background: rgba(66, 165, 245, 0.1);
    }
  }

  .message-preview {
    background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
    color: #e2e8f0;
    border-left-color: #42a5f5;
  }

  .q-scroll-area {
    background: linear-gradient(180deg, rgba(45, 55, 72, 0.5) 0%, rgba(26, 32, 44, 0.3) 100%);
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .modal-listar-mensagens {
    border-radius: 0;
    max-height: 95vh !important;

    .modal-header {
      padding: 12px 16px;
    }
  }

  .q-item {
    margin: 4px 8px;
    padding: 8px;
  }

  .message-content {
    max-width: 250px;
    font-size: 0.875rem;
  }

  .message-preview {
    padding: 8px 12px;
    max-height: 120px;
    font-size: 0.875rem;
  }

  .counter-badge {
    padding: 4px 8px;
    font-size: 0.75rem;
  }

  .q-scroll-area {
    max-height: calc(90vh - 120px);
  }

  .modal-listar-mensagens .scroll-container {
    height: calc(95vh - 120px) !important;
  }
}
</style>
