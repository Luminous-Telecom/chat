<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    @hide="fecharModal"
    persistent
    transition-show="scale"
    transition-hide="scale"
    class="modal-modern"
  >
    <q-card style="width: 900px; max-width: 95vw; max-height: 85vh; overflow-y: auto;">
      <q-card-section class="modal-header row items-center q-pb-none">
        <div class="text-h6">
          Timeline do Contato: {{ contato.name }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section class="modal-content">
        <q-scroll-area ref="scrollArea" class="modern-scrollbar" style="height: calc(85vh - 140px);">
          <div v-if="loading" class="row justify-center q-my-md">
            <q-spinner color="primary" size="3em" />
          </div>
          <div v-else class="q-pa-sm">
            <template v-for="(mensagem, index) in mensagens" :key="mensagem.id">
              <div>
                <div v-if="deveExibirData(mensagem, index)" class="row justify-center q-my-sm">
                  <q-chip
                    color="grey-3"
                    text-color="black"
                    class="text-body2 text-weight-medium"
                  >
                    {{ formatarData(mensagem.createdAt) }}
                  </q-chip>
                </div>
                <div v-if="deveExibirTicketInfo(mensagem, index)" class="row justify-center q-my-sm">
                  <q-chip
                    outline
                    color="primary"
                    text-color="primary"
                    class="text-body2 text-weight-medium"
                  >
                    Ticket #{{ mensagem.ticketId }} - Aberto em {{ formatarData(mensagem.ticket.createdAt, 'dd/MM/yyyy HH:mm') }}
                  </q-chip>
                </div>
                <div class="row" :class="{'justify-end': mensagem.fromMe}">
                  <div
                    class="q-message-container row items-end no-wrap"
                    :class="mensagem.fromMe ? 'sent' : 'received'"
                  >
                    <div
                      :class="mensagem.fromMe ? 'q-message-text sent' : 'q-message-text received'"
                      class="text-black"
                    >
                      <div class="q-message-text-content">
                        <div v-if="!mensagem.fromMe" class="text-caption text-primary text-weight-bold">
                          {{ (mensagem.contact && mensagem.contact.name) || (contato && contato.name) }}
                        </div>

                        <!-- Áudio -->
                        <template v-if="mensagem.mediaType === 'audio'">
                          <WhatsAppAudioPlayer
                            :audioUrl="mensagem.mediaUrl"
                            :isPTT="isAudioPTT(mensagem)"
                            :isSent="mensagem.fromMe"
                            :audioName="getAudioFileName(mensagem)"
                            :showSpeedControl="true"
                            :ackStatus="mensagem.ack || 0"
                          />
                        </template>

                        <!-- Contato vCard -->
                        <template v-if="mensagem.mediaType === 'vcard'">
                          <q-btn
                            type="a"
                            :color="$q.dark.isActive ? '' : 'black'"
                            outline
                            dense
                            class="q-px-sm text-center btn-rounded"
                            download="vCard"
                            :href="`data:text/x-vcard;charset=utf-8;base64,${returnCardContato(mensagem.body)}`"
                          >
                            Download Contato
                          </q-btn>
                        </template>

                        <!-- Imagem -->
                        <template v-if="mensagem.mediaType === 'image'">
                          <div v-viewer>
                            <img
                              :src="mensagem.mediaUrl"
                              class="img-preview-chat"
                              style="cursor: pointer; max-width: 280px; max-height: 200px; border-radius: 14px;"
                              alt="imagem do chat"
                            />
                          </div>
                        </template>

                        <!-- Vídeo -->
                        <template v-if="mensagem.mediaType === 'video'">
                          <video
                            :src="mensagem.mediaUrl"
                            controls
                            class="q-mt-md"
                            style="object-fit: contain; width: 330px; height: 150px; border-radius: 8px; background: #f5f5f5;"
                          >
                          </video>
                        </template>

                        <!-- Outros arquivos (PDF, documentos, etc.) -->
                        <template v-if="!['audio', 'vcard', 'image', 'video'].includes(mensagem.mediaType) && mensagem.mediaUrl">
                          <div class="text-center full-width no-scroll">
                            <div
                              v-if="isPDF(mensagem.mediaUrl)"
                              class="pdf-preview-container"
                              title="Clique para abrir PDF em nova guia"
                            >
                              <!-- Preview moderno do PDF -->
                              <div class="pdf-preview-card">
                                <div class="pdf-preview-header">
                                  <q-icon name="mdi-file-pdf-box" size="24px" color="red-6" />
                                  <div class="pdf-preview-title-section">
                                    <span class="pdf-preview-title">PDF</span>
                                    <span class="pdf-preview-filename">{{ mensagem.mediaName || mensagem.body || 'Documento' }}</span>
                                  </div>
                                </div>
                                <div class="pdf-preview-content">
                                  <div class="pdf-preview-iframe-container">
                                    <iframe
                                      :src="mensagem.mediaUrl"
                                      class="pdf-preview-iframe"
                                      frameborder="0"
                                      title="Preview do PDF"
                                    >
                                      Seu navegador não suporta visualização de PDF.
                                    </iframe>
                                  </div>
                                </div>
                                <div class="pdf-preview-actions">
                                  <q-btn
                                    color="primary"
                                    label="Visualizar"
                                    @click.stop.prevent="abrirModalPDF(mensagem.mediaUrl)"
                                    class="pdf-action-btn"
                                  />
                                  <q-btn
                                    color="primary"
                                    label="Abrir em nova guia"
                                    @click.stop.prevent="abrirPDFNovaGuia(mensagem.mediaUrl, true)"
                                    class="pdf-action-btn"
                                  />
                                </div>
                              </div>
                            </div>
                            <q-btn
                              v-if="!isPDF(mensagem.mediaUrl)"
                              type="a"
                              :color="$q.dark.isActive ? '' : 'grey-3'"
                              no-wrap
                              no-caps
                              stack
                              dense
                              class="q-mt-sm text-center text-black btn-rounded text-grey-9 ellipsis"
                              download
                              :target="isPDF(mensagem.mediaUrl) ? '_blank' : ''"
                              :href="mensagem.mediaUrl"
                            >
                              <q-tooltip
                                v-if="mensagem.mediaUrl"
                                content-class="text-bold"
                              >
                                Baixar: {{ mensagem.mediaName }}
                                <span v-html="formatarMensagemWhatsapp(mensagem.body)"></span>
                              </q-tooltip>
                              <div class="row items-center q-ma-xs">
                                <div
                                  class="ellipsis col-grow q-pr-sm"
                                  style="max-width: 290px"
                                  v-html="formatarMensagemWhatsapp(mensagem.body || mensagem.mediaName)"
                                >
                                </div>
                                <q-icon name="mdi-download" />
                              </div>
                            </q-btn>
                          </div>
                        </template>

                        <!-- Texto da mensagem -->
                        <div
                          v-if="mensagem.body && !['vcard', 'application', 'audio'].includes(mensagem.mediaType)"
                          v-html="formatarMensagemWhatsapp(mensagem.body)"
                          :class="{ 'q-mt-sm': mensagem.mediaUrl }"
                        >
                        </div>

                        <!-- Botões Interativos -->
                        <template v-if="mensagem.mediaType === 'buttonsMessage' && mensagem.dataPayload && mensagem.dataPayload.buttons">
                          <div class="row q-gutter-sm justify-start q-mt-sm">
                            <q-btn
                              v-for="(button, btnIndex) in mensagem.dataPayload.buttons"
                              :key="btnIndex"
                              dense
                              outline
                              no-caps
                              color="primary"
                              class="q-px-sm"
                              :label="button.buttonText?.displayText || 'Botão'"
                              disable
                            />
                          </div>
                        </template>

                        <div class="row items-center justify-end q-message-meta-container">
                          <div class="q-message-meta">
                            <span class="text-caption">{{ formatarData(mensagem.createdAt, 'HH:mm') }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div id="end-of-timeline"></div>
        </q-scroll-area>
      </q-card-section>
    </q-card>
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
  </q-dialog>
</template>

<script>
import { ListarMensagensContato } from 'src/service/tickets'
import mixinCommon from 'src/pages/atendimento/mixinCommon'
import { isSameDay, parseISO } from 'date-fns'
import { Base64 } from 'js-base64'
import WhatsAppAudioPlayer from 'src/components/WhatsAppAudioPlayer.vue'

export default {
  name: 'ModalTimeline',
  mixins: [mixinCommon],
  components: {
    WhatsAppAudioPlayer
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    contato: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      loading: false,
      mensagens: [],
      ticketFocado: {
        id: -1, // ID Fixo para não interferir
        contact: this.contato
      },
      showPdfModal: false,
      currentPdfUrl: '',
      currentPdfName: ''
    }
  },
  methods: {
    fecharModal () {
      this.$emit('update:modelValue', false)
    },
    async carregarMensagens () {
      if (!this.contato || !this.contato.id) return
      this.loading = true
      try {
        const { data } = await ListarMensagensContato(this.contato.id)
        this.mensagens = data
      } catch (e) {
        this.$notificarErro('Não foi possível carregar o histórico.', e)
      } finally {
        this.loading = false
      }
    },
    deveExibirData (mensagem, index) {
      if (index === 0) return true
      const msgAnterior = this.mensagens[index - 1]
      return !isSameDay(parseISO(mensagem.createdAt), parseISO(msgAnterior.createdAt))
    },
    deveExibirTicketInfo (mensagem, index) {
      if (index === 0) return true
      const msgAnterior = this.mensagens[index - 1]
      return mensagem.ticketId !== msgAnterior.ticketId
    },
    isPDF (url) {
      if (!url) return false
      const split = url.split('.')
      const ext = split[split.length - 1]
      return ext === 'pdf'
    },
    returnCardContato (str) {
      return Base64.encode(str)
    },
    abrirModalPDF (url) {
      this.currentPdfUrl = url
      this.currentPdfName = this.mensagens.find(m => m.mediaUrl === url)?.mediaName || 'Documento'
      this.showPdfModal = true
    },
    abrirPDFNovaGuia (url, isNewTab = false) {
      if (!url) {
        console.warn('URL inválida fornecida para abrirPDFNovaGuia:', url)
        return
      }

      window.open(url, '_blank')
    },
    isAudioPTT (mensagem) {
      // Verificar se é uma mensagem de voz (PTT - Push to Talk)
      // Primeiro verificar nos dados salvos
      if (mensagem.dataPayload) {
        try {
          const payload = typeof mensagem.dataPayload === 'string'
            ? JSON.parse(mensagem.dataPayload)
            : mensagem.dataPayload
          if (typeof payload.isPtt === 'boolean') {
            return payload.isPtt
          }
        } catch (e) {
          // Se falhar ao parsear, continuar com verificação manual
        }
      }

      // Fallback para verificação manual
      return mensagem.body?.includes('ptt') ||
             mensagem.mediaUrl?.includes('ptt') ||
             (mensagem.mediaName && mensagem.mediaName.includes('ptt'))
    },
    getAudioFileName (mensagem) {
      // Sempre usar mediaUrl como fonte primária para garantir consistência
      const url = mensagem.mediaUrl || ''
      const filename = url.split('/').pop() || ''

      if (filename) {
        // Se o filename começa com audio_ e é um timestamp, formatar melhor
        if (filename.startsWith('audio_') && filename.match(/^audio_\d+\.mp3$/)) {
          const timestamp = filename.match(/audio_(\d+)\.mp3$/)?.[1]
          if (timestamp) {
            const date = new Date(parseInt(timestamp))
            return `Áudio ${date.toLocaleString('pt-BR')}`
          }
        }
        return filename
      }

      // Fallback para mediaName se mediaUrl não estiver disponível
      if (mensagem.mediaName) {
        // Se o nome começa com audio_ e é um timestamp, formatar melhor
        if (mensagem.mediaName.startsWith('audio_') && mensagem.mediaName.match(/^audio_\d+\.mp3$/)) {
          const timestamp = mensagem.mediaName.match(/audio_(\d+)\.mp3$/)?.[1]
          if (timestamp) {
            const date = new Date(parseInt(timestamp))
            return `Áudio ${date.toLocaleString('pt-BR')}`
          }
        }
        return mensagem.mediaName
      }

      // Fallback para body se nem mediaUrl nem mediaName estiverem disponíveis
      if (mensagem.body) {
        // Se o body começa com audio_ e é um timestamp, formatar melhor
        if (mensagem.body.startsWith('audio_') && mensagem.body.match(/^audio_\d+\.mp3$/)) {
          const timestamp = mensagem.body.match(/audio_(\d+)\.mp3$/)?.[1]
          if (timestamp) {
            const date = new Date(parseInt(timestamp))
            return `Áudio ${date.toLocaleString('pt-BR')}`
          }
        }
        return mensagem.body
      }

      return this.isAudioPTT(mensagem) ? 'Mensagem de voz' : 'Arquivo de áudio'
    }
  },
  watch: {
    modelValue (newVal) {
      if (newVal) {
        this.carregarMensagens()
      } else {
        this.mensagens = []
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.q-message-container {
  max-width: 70%;
  margin: 4px 0;

  &.sent {
    justify-content: flex-end;
  }

  &.received {
    justify-content: flex-start;
  }
}

.q-message-text {
  word-wrap: break-word;
  overflow-wrap: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  padding: 8px 12px;

  &.sent {
    background: #D9FDD3;
    border-radius: 18px 18px 4px 18px;
  }

  &.received {
    background: #FFF;
    border-radius: 18px 18px 18px 4px;
  }
}

.q-message-text-content {
  max-width: 100%;
}

.q-message-meta-container {
  margin-top: 4px;
}

.q-message-meta {
  font-size: 11px;
  opacity: 0.7;
}

/* Dark mode styles */
.body--dark {
  .q-message-text {
    &.sent {
      background: #2e7d32 !important;
      color: white !important;
    }

    &.received {
      background: #424242 !important;
      color: white !important;
    }
  }
}

/* Estilos para diferentes tipos de mídia */
.img-preview-chat {
  cursor: pointer;
  max-width: 280px;
  max-height: 200px;
  border-radius: 14px;
  transition: transform 0.2s ease;
}

.img-preview-chat:hover {
  transform: scale(1.02);
}

.btn-rounded {
  border-radius: 50%;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Estilos para PDF */
.pdf-preview-container {
  margin: 8px 0;
}

.pdf-preview-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.pdf-preview-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.pdf-preview-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.pdf-preview-title-section {
  margin-left: 12px;
  display: flex;
  flex-direction: column;
}

.pdf-preview-title {
  font-weight: 600;
  color: #1976d2;
  font-size: 14px;
}

.pdf-preview-filename {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

.pdf-preview-content {
  background: #f8f9fa;
  padding: 16px;
}

.pdf-preview-iframe-container {
  position: relative;
  width: 100%;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.pdf-preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

/* Ações do PDF */
.pdf-preview-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  padding-bottom: 16px;
}

.pdf-action-btn {
  min-width: 70px;
  font-weight: 500;
  letter-spacing: 0.05px;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  font-size: 0.60rem;
  padding: 2px 8px;
  height: 24px;
  transition: all 0.2s cubic-bezier(.4,0,.2,1);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1976d2;
  color: #fff !important;
  border: none;
  line-height: 1;
}

.pdf-action-btn:hover, .pdf-action-btn:focus {
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.10);
  background: #1565c0;
  color: #fff !important;
  transform: translateY(-1px) scale(1.02);
}

.pdf-action-btn:active {
  box-shadow: 0 1px 4px rgba(25, 118, 210, 0.08);
  transform: scale(0.98);
}

/* Dark mode para mídia */
.body--dark .pdf-preview-card {
  background: #2d3748;
  border-color: rgba(255, 255, 255, 0.1);
}

.body--dark .pdf-preview-header {
  background: #4a5568;
}

.body--dark .pdf-preview-title {
  color: #e2e8f0;
}

.body--dark .pdf-preview-filename {
  color: #a0aec0;
}

.body--dark .pdf-preview-content {
  background: #1a202c;
}

.body--dark .pdf-preview-iframe-container {
  background: #2d3748;
  border-color: rgba(255, 255, 255, 0.1);
}

.body--dark .pdf-preview-iframe {
  background: #2d3748;
}

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
</style>
