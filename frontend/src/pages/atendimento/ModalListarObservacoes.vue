<template>
  <q-dialog
    :value="value"
    @input="$emit('update:value', $event)"
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
              class="q-mb-md"
              style="display: block;"
            >
              <q-item-section>
                <q-item-label caption>
                  {{ formatarData(obs.createdAt) }} - {{ obs.user.name }}
                </q-item-label>
                <q-item-label class="text-body1 q-mt-sm">{{ obs.texto }}</q-item-label>
                <div v-if="obs.anexo && isImage(obs.anexo)" style="margin-bottom: 24px;">
                  <q-img
                    :src="getAnexoUrl(obs.anexo)"
                    style="max-width: 150px; max-height: 150px; display: block; margin-top: 8px; object-fit: cover; border-radius: 8px;"
                    class="rounded-borders cursor-pointer"
                    @click="abrirModalImagem(obs.anexo)"
                    @error="() => {}"
                  >
                    <template v-slot:loading>
                      <q-spinner-dots color="primary" />
                    </template>
                    <template v-slot:error>
                      <div class="absolute-full flex flex-center bg-negative text-white">
                        Erro ao carregar imagem
                      </div>
                    </template>
                  </q-img>
                  <VueEasyLightbox
                    :visible="showLightbox"
                    :imgs="[getAnexoUrl(currentImage)]"
                    :index="0"
                    @hide="showLightbox = false"
                  />
                </div>
                <div v-else-if="obs.anexo" style="margin-bottom: 24px;">
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
    value: {
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
    value (val) {
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
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
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
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
    border-bottom-color: rgba(255, 255, 255, 0.1);

    .close-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }
}
</style>
