<template>
  <q-dialog
    :value="value"
    @input="$emit('update:value', $event)"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="column">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Observações</div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          v-close-popup
        />
      </q-card-section>

      <q-card-section class="q-pt-md">
        <q-scroll-area
          style="height: calc(100vh - 100px)"
          class="scroll"
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
                    @error="() => console.error('ModalListarObservacoes - Erro ao carregar imagem:', obs.anexo)"
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
        console.log('ModalListarObservacoes - Carregando observações para ticketId:', this.ticketId)
        if (!this.ticketId) {
          this.observacoes = []
          return
        }

        console.log('ModalListarObservacoes - Fazendo requisição para API')
        const data = await ListarObservacoes(this.ticketId)
        console.log('ModalListarObservacoes - Dados recebidos:', data)

        // Log detalhado de cada observação
        data.forEach((obs, index) => {
          console.log(`ModalListarObservacoes - Observação ${index}:`, {
            id: obs.id,
            anexo: obs.anexo,
            texto: obs.texto,
            createdAt: obs.createdAt
          })
        })

        this.observacoes = data
      } catch (error) {
        console.error('ModalListarObservacoes - Erro ao carregar observações:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao carregar observações'
        })
      }
    },
    isImage (filename) {
      if (!filename) {
        console.log('ModalListarObservacoes - isImage: filename é null ou undefined')
        return false
      }
      const ext = filename.toLowerCase().split('.').pop()
      console.log('ModalListarObservacoes - isImage: verificando extensão:', ext, 'do arquivo:', filename)
      const isImageFile = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
      console.log('ModalListarObservacoes - isImage: é imagem?', isImageFile)
      return isImageFile
    },
    getAnexoUrl (filename) {
      if (!filename) {
        console.log('ModalListarObservacoes - getAnexoUrl: filename é null ou undefined')
        return ''
      }
      const url = `${process.env.VUE_URL_API}/public/sent/${filename}`
      console.log('ModalListarObservacoes - getAnexoUrl: URL gerada:', url)
      return url
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
.q-card {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.q-img {
  border: 1px solid #ddd;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
}

/* Dark mode styles */
body.body--dark .q-img {
        border: 1px solid $dark-border;
      }
</style>
