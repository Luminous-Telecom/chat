<template>
  <div>
    <q-card flat class="q-pa-sm q-pb-md">
      <q-card-section style="min-height: 100px" class="q-pa-none">
        <q-file style="display: none" :loading="loading" rounded label="Mídia composição mensagem"
          ref="PickerFileMessage" v-model="file" class="col-grow" bg-color="blue-grey-1" input-style="max-height: 30vh"
          outlined clearable autogrow append :max-files="1" counter :max-file-size="10242880" :max-total-size="10242880"
          accept=".txt, .jpg, .png, image/jpeg, .jpeg, image/*, .pdf, .doc, .docx, .xls, .xlsx, .zip, .ppt, .pptx, .mp4, .mp3"
          @rejected="onRejectedFiles" @input="getMediaUrl" />
        <q-btn v-if="!$attrs.element.data.type" icon="mdi-file-plus-outline"
          @click="$refs.PickerFileMessage.pickFiles()" round flat size="lg"
          class="bg-grey-3 z-max q-pa-lg absolute-center" />

        <div class="text-center full-width hide-scrollbar no-scroll">
          <div
            v-if="cMediaUrl && $attrs.element.data.type === 'application/pdf'"
            class="pdf-preview-container"
            title="Clique para abrir PDF em nova guia"
          >
            <!-- Preview moderno do PDF -->
            <div class="pdf-preview-card">
              <div class="pdf-preview-header">
                <q-icon name="mdi-file-pdf-box" size="24px" color="red-6" />
                <div class="pdf-preview-title-section">
                  <span class="pdf-preview-title">PDF</span>
                  <span class="pdf-preview-filename">{{ $attrs.element.data.name || 'Documento' }}</span>
                </div>
              </div>
              <div class="pdf-preview-content">
                <div class="pdf-preview-iframe-container">
                  <iframe
                    :src="cMediaUrl"
                    class="pdf-preview-iframe"
                    frameborder="0"
                    title="Preview do PDF"
                  >
                    Seu navegador não suporta visualização de PDF.
                  </iframe>
                </div>
              </div>
              <div class="pdf-preview-actions q-pa-sm flex flex-center q-gutter-md">
                <q-btn
                  color="primary"
                  icon="mdi-eye"
                  label="Visualizar"
                  @click="abrirPDFNovaGuia(cMediaUrl)"
                  class="pdf-action-btn"
                />
                <q-btn
                  color="secondary"
                  icon="mdi-open-in-new"
                  label="Abrir em nova guia"
                  @click="abrirPDFNovaGuia(cMediaUrl, true)"
                  class="pdf-action-btn"
                />
              </div>
            </div>
          </div>
          <video v-if="cMediaUrl && $attrs.element.data.type.indexOf('video') != -1" :src="cMediaUrl" controls
            class="q-mt-md" style="objectFit: contain;
                  width: 330px;
                  height: 150px;
                  borderTopLeftRadius: 8px;
                  borderTopRightRadius: 8px;
                  borderBottomLeftRadius: 8px;
                  borderBottomRightRadius: 8px;
                  background: #f5f5f5;" type="video/mp4">
          </video>
          <audio v-if="cMediaUrl && $attrs.element.data.type.indexOf('audio') != -1" class="q-mt-md full-width"
            controls>
            <source :src="cMediaUrl" type="audio/ogg" />
          </audio>

          <q-img v-if="cMediaUrl && $attrs.element.data.type.indexOf('image') != -1" @click="abrirModalImagem = true"
            :src="cMediaUrl" spinner-color="primary" height="120px" width="100%" id="imagemfield"
            style="cursor: pointer; max-width: 280px; object-fit: cover; border-radius: 8px;" />

        </div>
        <VueEasyLightbox v-if="cMediaUrl && $attrs.element.data.type.indexOf('image') != -1" :visible="abrirModalImagem"
          :imgs="cMediaUrl" :index="1" @hide="abrirModalImagem = false;" />
        <div v-if="getFileIcon($attrs.element.data.name)">
          <q-icon size="80px" :name="getFileIcon($attrs.element.data.name)" />
        </div>
        <div v-if="cMediaUrl" class="text-bold flex flex-inline flex-center items-center">
          <div style="max-width: 340px" class="ellipsis">
            {{ $attrs.element.data.name }}
            <q-tooltip>
              {{ $attrs.element.data.name }}
            </q-tooltip>

          </div>
          <q-btn v-if="cMediaUrl" flat class="bg-padrao btn-rounded q-ma-sm" color="primary" no-caps
            icon="mdi-image-edit-outline" @click="$refs.PickerFileMessage.pickFiles()">
            <q-tooltip>
              Substituir Arquivo
            </q-tooltip>
          </q-btn>
        </div>

      </q-card-section>
    </q-card>

    <!-- Modal para visualizar PDF em tela cheia -->
    <q-dialog v-model="showPdfModal" persistent>
      <q-card class="pdf-modal-card">
        <q-card-section class="pdf-modal-header">
          <div class="text-h6">{{ currentPdfName || 'Visualizar PDF' }}</div>
          <q-btn
            icon="close"
            color="negative"
            round
            outline
            @click="showPdfModal = false"
          />
        </q-card-section>
        <q-card-section class="pdf-modal-content">
          <iframe
            v-if="currentPdfUrl"
            :src="currentPdfUrl"
            class="pdf-modal-iframe"
            frameborder="0"
            title="PDF em tela cheia"
          >
            Seu navegador não suporta visualização de PDF.
          </iframe>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import VueEasyLightbox from 'vue-easy-lightbox'

export default {
  name: 'MediaField',
  components: { VueEasyLightbox },
  data () {
    return {
      mediaUrl: '',
      file: [],
      abrirModalImagem: false,
      loading: false,
      name: '',
      icons: {
        xls: 'mdi-microsoft-excel',
        xlsx: 'mdi-microsoft-excel',
        doc: 'mdi-file-word',
        docx: 'mdi-file-word',
        zip: 'mdi-folder-zip-outline',
        ppt: 'mdi-microsoft-powerpoint',
        pptx: 'mdi-microsoft-powerpoint'
      },
      showPdfModal: false,
      currentPdfUrl: '',
      currentPdfName: ''
    }
  },
  computed: {
    cMediaUrl () {
      if (this.$attrs.element.data?.mediaUrl) {
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        this.mediaUrl = this.$attrs.element.data.mediaUrl
        return this.mediaUrl
      }
      if (!this.$attrs.element.data?.mediaUrl && this.file.type) {
        this.getMediaUrl()
        return this.mediaUrl
      }
      return ''
    }
  },
  methods: {
    async getMediaUrl () {
      let url = ''
      if (this.file?.type) {
        const blob = new Blob([this.file], { type: this.file.type })
        url = window.URL.createObjectURL(blob)
        this.$attrs.element.data.mediaUrl = url
        const base64 = await this.getBase64(this.file)
        this.$attrs.element.data.ext = this.getFileExtension(this.file.name)
        this.$attrs.element.data.media = base64
        this.$attrs.element.data.type = this.file.type
        this.$attrs.element.data.name = this.file.name
      } else {
        this.mediaUrl = this.$attrs.element.data.mediaUrl
      }
    },
    getNewMediaUrl () {
      if (this.$attrs.element.data?.mediaUrl) {
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        this.mediaUrl = this.$attrs.element.data.mediaUrl
        return this.mediaUrl
      }
      if (!this.$attrs.element.data?.mediaUrl && this.file.type) {
        return this.getMediaUrl()
      } else {
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        // this.mediaUrl = ''
        return this.mediaUrl
      }
    },
    getFileExtension (name) {
      if (!name) return ''
      const split = name.split('.')
      const ext = split[split.length - 1]
      return ext
    },
    getFileIcon (name) {
      return this.icons[this.getFileExtension(name)]
    },
    getBase64 (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result)
        reader.onerror = error => reject(error)
      })
    },
    onRejectedFiles (rejectedEntries) {
      this.$q.notify({
        html: true,
        message: `Ops... Ocorreu um erro! <br>
        <ul>
          <li>Arquivo deve ter no máximo 5MB.</li>
          <li>Priorize o envio de imagem ou vídeo.</li>
        </ul>`,
        type: 'negative',
        progress: true,
        position: 'bottom-right',
        actions: [{
          icon: 'close',
          round: true,
          color: 'white'
        }]
      })
    },
    abrirPDFNovaGuia (url, openInNewTab = false) {
      // Verificar se a URL é válida
      if (!url || typeof url !== 'string') {
        console.warn('URL inválida fornecida para abrirPDFNovaGuia:', url)
        return
      }

      if (openInNewTab) {
        window.open(url, '_blank')
        return
      }
      this.currentPdfUrl = url
      this.currentPdfName = this.$attrs.element.data?.name || 'Documento'
      this.showPdfModal = true
    }
  }
}
</script>

<style lang="scss" scoped>
#imagemfield>.q-img__content>div {
  padding: 0 !important;
  background: none; // rgba(0, 0, 0, 0.47);
}

.pdf-preview-container {
  cursor: pointer;
  display: inline-block;
  position: relative;
  margin-bottom: 8px;

  &:hover {
    .pdf-preview-card {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }

    .pdf-preview-footer {
      background: linear-gradient(135deg, #1976d2, #1565c0);

      .pdf-preview-action {
        color: white;
      }

      .q-icon {
        color: white !important;
      }
    }
  }
}

.pdf-preview-card {
  width: 280px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.pdf-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.pdf-preview-title-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pdf-preview-title {
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.pdf-preview-filename {
  font-size: 11px;
  color: #6c757d;
  font-weight: 400;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-preview-content {
  padding: 0;
  background: #f8f9fa;
  min-height: 200px;
  max-height: 300px;
  overflow: hidden;
  border-radius: 0;
}

.pdf-preview-iframe-container {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
  border-radius: 0;
}

.pdf-preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

.pdf-preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.pdf-preview-container:hover .pdf-preview-overlay {
  opacity: 1;
}

.pdf-overlay-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
}

.pdf-overlay-btn {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9) !important;
  border: 2px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.1);
    background: rgba(255, 255, 255, 1) !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }
}

.pdf-preview-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.pdf-preview-action {
  font-weight: 600;
  color: #1976d2;
  font-size: 13px;
  transition: color 0.3s ease;
}

/* Dark mode support */
.body--dark .pdf-preview-card {
  background: #2d3748;
  border-color: rgba(255, 255, 255, 0.1);
}

.body--dark .pdf-preview-header {
  background: linear-gradient(135deg, #4a5568, #2d3748);
}

.body--dark .pdf-preview-title {
  color: #e2e8f0;
}

.body--dark .pdf-preview-content {
  background: #1a202c;
}

.body--dark .pdf-preview-iframe-container {
  background: #1a202c;
}

.body--dark .pdf-preview-iframe {
  background: #1a202c;
}

.body--dark .pdf-preview-overlay {
  background: rgba(0, 0, 0, 0.6);
}

.body--dark .pdf-overlay-text {
  color: white;
}

.body--dark .pdf-preview-footer {
  background: #1a202c;
  border-top-color: rgba(255, 255, 255, 0.1);
}

.body--dark .pdf-preview-action {
  color: #63b3ed;
}

.body--dark .pdf-preview-filename {
  color: #a0aec0;
}

/* Modal do PDF */
.pdf-modal-card {
  background: white;
  border-radius: 12px;
  width: 90vw;
  max-width: 1200px;
  height: 80vh;
  max-height: 800px;
  overflow: hidden;
}

.pdf-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding: 16px 24px;
  border-radius: 12px 12px 0 0;
}

.pdf-modal-content {
  padding: 0;
  height: calc(100% - 80px);
  overflow: hidden;
}

.pdf-modal-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
  border-radius: 0 0 12px 12px;
}

/* Dark mode para o modal */
.body--dark .pdf-modal-card {
  background: #1a202c;
}

.body--dark .pdf-modal-header {
  background: #2d3748;
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.body--dark .pdf-modal-iframe {
  background: #1a202c;
}

/* Ações do PDF no card */
.pdf-preview-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding-top: 8px;
  padding-bottom: 8px;
  border-top: 1px solid #f0f0f0;
  background: #f8f9fa;
}

.pdf-action-btn {
  min-width: 140px;
  font-weight: 600;
  letter-spacing: 0.5px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.pdf-action-btn .q-icon {
  margin-right: 6px;
}

/* Remover overlay antigo */
.pdf-preview-overlay, .pdf-overlay-buttons, .pdf-overlay-btn { display: none !important; }
</style>
