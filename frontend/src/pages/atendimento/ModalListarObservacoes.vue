<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    persistent
    transition-show="scale"
    transition-hide="scale"
    class="modal-modern"
  >
    <q-card class="column" style="width: 700px; max-width: 90vw; max-height: 80vh; overflow-y: auto;">
      <q-card-section class="modal-header row items-center q-pb-none">
        <div class="text-h6">Observações</div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          class="close-btn"
          v-close-popup
        />
      </q-card-section>

      <q-separator />

      <q-card-section class="modal-content">
        <q-scroll-area
          style="height: calc(80vh - 120px)"
          class="scroll modern-scrollbar"
        >
          <q-list>
            <q-item
              v-for="obs in observacoes"
              :key="obs.id"
              class="observacao-item"
            >
              <q-item-section>
                <q-item-label caption>
                  {{ formatarData(obs.createdAt) }} - {{ obs.user.name }}
                </q-item-label>
                <q-item-label class="text-body1 q-mt-sm">{{ obs.texto }}</q-item-label>
                <div v-if="obs.anexo && isImage(obs.anexo)" class="observacao-anexo-thumb" v-viewer>
                  <img
                    :src="getAnexoUrl(obs.anexo)"
                    class="img-preview-chat"
                    style="cursor: pointer; max-width: 80px; max-height: 80px; border-radius: 14px;"
                    alt="imagem do chat"
                  />
                </div>
                <div v-else-if="obs.anexo && isVideo(obs.anexo)" class="observacao-anexo-thumb">
                  <video
                    :src="getAnexoUrl(obs.anexo)"
                    style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; display: block;"
                    autoplay
                    muted
                    loop
                    playsinline
                  ></video>
                </div>
                <div v-else-if="obs.anexo" class="observacao-anexo-thumb">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    icon="mdi-paperclip"
                    :label="obs.anexo"
                    @click="abrirAnexo(obs.anexo)"
                    style="margin-top: 8px;"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { ListarObservacoes } from '../../service/observacoes'
import VueEasyLightbox from 'vue-easy-lightbox'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default {
  name: 'ModalListarObservacoes',
  components: {
    VueEasyLightbox
  },
  props: {
    modelValue: {
      type: Boolean,
      required: true
    },
    ticketId: {
      type: Number,
      required: false,
      default: null
    }
  },
  data () {
    return {
      observacoes: [],
      showLightbox: false,
      currentImage: null
    }
  },
  watch: {
    modelValue (val) {
      if (val && this.ticketId) {
        this.carregarObservacoes()
      }
    }
  },
  methods: {
    formatarData (data) {
      return format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    },
    async carregarObservacoes () {
      try {
        if (!this.ticketId) {
          this.observacoes = []
          return
        }

        const data = await ListarObservacoes(this.ticketId)

        this.observacoes = data
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao carregar observações'
        })
      }
    },
    isImage (filename) {
      if (!filename) return false
      const ext = filename.toLowerCase().split('.').pop()
      return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
    },
    isVideo (filename) {
      if (!filename) return false
      const ext = filename.toLowerCase().split('.')
        .pop()
      return ['mp4', 'webm', 'ogg'].includes(ext)
    },
    getAnexoUrl (filename) {
      if (!filename) return ''
      return `${process.env.VUE_URL_API}/public/sent/${filename}`
    },
    abrirModalImagem (anexo) {
      this.currentImage = anexo
      this.showLightbox = true
    },
    abrirAnexo (anexo) {
      const url = this.getAnexoUrl(anexo)
      if (this.isImage(anexo)) {
        this.abrirModalImagem(anexo)
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = anexo
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.q-img {
  border: 1px solid #ddd;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
}

.modal-header {
      background: #f8f9fa;
  padding: 12px 16px;
  border-bottom: 1px solid #dee2e6;

  .text-h6 {
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

.modal-content {
  padding: 8px 12px 12px 12px;
}

/* Dark mode styles */
.body--dark {
  .q-img {
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-header {
    background: rgba(255, 255, 255, 0.08);
    border-bottom-color: rgba(255, 255, 255, 0.1);

    .close-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }
}

// Ajuste visual para cada observação
.observacao-item {
  width: 100%;
  margin-bottom: 24px;
  background: transparent;
  border-radius: 8px;
  padding: 8px 0;
  box-sizing: border-box;
}

// Miniatura de anexo (imagem ou vídeo)
.observacao-anexo-thumb {
  width: 80px;
  height: 80px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}
</style>

<style>
/* Garante que o overlay do Viewer.js fique acima do modal do Quasar */
.viewer-container,
.viewer-backdrop,
.viewer-toolbar,
.viewer-navbar,
.viewer-title,
.viewer-mask {
  z-index: 10000 !important;
}
</style>
