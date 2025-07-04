<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    persistent
    transition-show="scale"
    transition-hide="scale"
  >
    <q-card class="modal-listar-mensagens" style="width: 600px; max-width: 90vw; max-height: 70vh; overflow: hidden;">
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
        <q-scroll-area class="full-height modern-scrollbar">
          <div v-if="mensagensAgendadas.length === 0" class="text-center q-pa-lg">
            <q-icon name="mdi-calendar-clock" size="4rem" color="grey-5" />
            <div class="text-h6 text-grey-6 q-mt-md">Nenhuma mensagem agendada</div>
            <div class="text-body2 text-grey-5">Este ticket não possui mensagens agendadas.</div>
          </div>

          <q-list v-else separator>
            <q-item
              v-for="(mensagem, index) in mensagensOrdenadas"
              :key="mensagem.id || index"
              class="q-pa-sm"
            >
              <q-item-section avatar>
                <q-avatar color="primary" text-color="white" size="sm">
                  <q-icon name="mdi-calendar-clock" size="sm" />
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-weight-medium text-body2">
                  {{ $formatarData(mensagem.scheduleDate, 'dd/MM HH:mm') }}
                </q-item-label>
                <q-item-label caption class="q-mt-xs" style="max-height: 40px; overflow: hidden;">
                  <div class="message-content">
                    {{ (mensagem.body || 'Mensagem sem conteúdo').substring(0, 80) + (mensagem.body && mensagem.body.length > 80 ? '...' : '') }}
                  </div>
                </q-item-label>
                <q-item-label caption class="q-mt-xs text-grey-6 text-caption">
                  <q-icon name="mdi-account" size="xs" class="q-mr-xs" />
                  {{ mensagem.user?.name || 'Sistema' }}
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
      <q-card style="width: 450px; max-width: 90vw;">
        <q-card-section class="q-pb-none">
          <div class="text-subtitle2">Detalhes da Mensagem</div>
        </q-card-section>

        <q-card-section v-if="mensagemSelecionada" class="q-pt-sm">
          <div class="q-mb-sm">
            <div class="text-body2 text-weight-medium">Agendada para:</div>
            <div class="text-body2">{{ $formatarData(mensagemSelecionada.scheduleDate, 'dd/MM/yyyy HH:mm') }}</div>
          </div>

          <div class="q-mb-sm">
            <div class="text-body2 text-weight-medium">Conteúdo:</div>
            <div class="message-preview-content q-pa-sm rounded-borders" style="max-height: 120px; overflow-y: auto;">
              {{ mensagemSelecionada.body || 'Mensagem sem conteúdo' }}
            </div>
          </div>

          <div class="row q-gutter-sm items-center">
            <div class="text-caption text-grey-6">Status:</div>
            <q-chip
              :color="getStatusColor(mensagemSelecionada)"
              text-color="white"
              size="xs"
            >
              {{ getStatusText(mensagemSelecionada) }}
            </q-chip>
            <div class="text-caption text-grey-6">{{ mensagemSelecionada.user?.name || 'Sistema' }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pt-none">
          <q-btn flat label="Fechar" color="primary" size="sm" @click="fecharModalVisualizacao" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Modal de edição de mensagem -->
    <ModalEditarMensagemAgendada
      v-model="modalEditarMensagem"
      :mensagem="mensagemParaEditar"
      :nome-contato="nomeContato"
      @mensagem-editada="mensagemEditada"
    />
  </q-dialog>
</template>

<script>
import { CancelarMensagemAgendada } from 'src/service/tickets'
import ModalEditarMensagemAgendada from './ModalEditarMensagemAgendada.vue'

export default {
  name: 'ModalListarMensagensAgendadas',
  components: {
    ModalEditarMensagemAgendada
  },
  props: {
    modelValue: {
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
    },
    contato: {
      type: Object,
      default: () => ({})
    }
  },
  data () {
    return {
      modalVisualizacao: false,
      mensagemSelecionada: null,
      modalEditarMensagem: false,
      mensagemParaEditar: {}
    }
  },
  computed: {
    mensagensOrdenadas () {
      return [...this.mensagensAgendadas].sort((a, b) => {
        return new Date(b.scheduleDate) - new Date(a.scheduleDate)
      })
    },

    nomeContato () {
      return this.contato?.name || 'Contato não identificado'
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
      this.mensagemParaEditar = { ...mensagem }
      this.modalEditarMensagem = true
    },

    async cancelarMensagem (mensagem) {
      this.$q.dialog({
        title: 'Cancelar Mensagem Agendada',
        message: 'Tem certeza que deseja cancelar esta mensagem agendada?',
        cancel: {
          label: 'Não',
          color: 'primary',
          push: true
        },
        ok: {
          label: 'Sim, cancelar',
          color: 'negative',
          push: true
        },
        persistent: true
      }).onOk(async () => {
        try {
          await this.cancelarMensagemAPI(mensagem)
        } catch (error) {
          console.error('Erro ao cancelar mensagem:', error)
        }
      })
    },

    async cancelarMensagemAPI (mensagem) {
      try {
        await CancelarMensagemAgendada(mensagem.id)

        this.$q.notify({
          type: 'positive',
          message: 'Mensagem agendada cancelada com sucesso!',
          position: 'bottom-right'
        })

        // Remover a mensagem da lista local imediatamente
        const index = this.mensagensAgendadas.findIndex(m => m.id === mensagem.id)
        if (index !== -1) {
          this.mensagensAgendadas.splice(index, 1)
        }

        // Emitir evento para notificar o componente pai sobre a remoção
        this.$emit('mensagem-cancelada', mensagem.id)
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: error.response?.data?.message || 'Erro ao cancelar mensagem agendada',
          position: 'bottom-right'
        })
      }
    },

    mensagemEditada (mensagemEditada) {
      // Atualizar a mensagem na lista local
      const index = this.mensagensAgendadas.findIndex(m => m.id === mensagemEditada.id)
      if (index !== -1) {
        this.mensagensAgendadas[index] = {
          ...this.mensagensAgendadas[index],
          ...mensagemEditada
        }
      }

      this.$q.notify({
        type: 'positive',
        message: 'Mensagem atualizada na lista!',
        position: 'bottom-right'
      })
    },

    novamensagemAgendada () {
      this.$emit('update:modelValue', false)
      this.$emit('nova-mensagem-agendada')
    },

    fecharModalVisualizacao () {
      this.modalVisualizacao = false
      this.mensagemSelecionada = null
    },

    fecharModal () {
      this.$emit('update:modelValue', false)
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
    background: #f8f9fa;
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
    background: #1976d2;
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
    height: calc(70vh - 120px);
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
  background: #1976d2;
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
  background: #f8f9fa;
  padding: 12px 16px;
  border-radius: 12px;
  border-left: 4px solid var(--primary-color);
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
  background: rgba(248, 249, 250, 0.5);
}

// Empty state styling

.message-preview-content {
  background: var(--q-color-grey-1);
  border: 1px solid var(--q-color-grey-3);
  color: var(--q-color-on-surface);
}

// Dark theme support
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
      background: $dark-secondary;
      border-bottom-color: $dark-border;

      .close-btn:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }

    .counter-badge {
      background: rgba(66, 165, 245, 0.2);
      color: $dark-accent;
    }
  }

  .q-item {
    background: rgba(45, 55, 72, 0.8);

    &:hover {
      background: rgba(66, 165, 245, 0.1);
    }
  }

  .message-preview {
    background: $dark-secondary;
    color: $dark-text-primary;
    border-left-color: var(--primary-color);
  }

  .q-scroll-area {
    background: rgba(45, 55, 72, 0.5);
  }

  .message-preview-content {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--q-color-on-surface);
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
