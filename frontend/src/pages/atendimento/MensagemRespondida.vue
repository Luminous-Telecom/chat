<template>
  <q-item
    clickable
    v-ripple
    class="q-pa-none fit btn-rounded q-mt-md q-mb-sm row justify-center"
    dense
  >
    <q-chat-message
      :key="mensagem.id"
      :sent="mensagem.fromMe"
      class="text-weight-medium fit q-ma-none cursor-pointer"
      id="chat-message-resp"
      style="min-width: 100px; max-width: 350px"
      :class="{
        'q-message-text--deleted': mensagem.isDeleted,
        'q-message-text--group': isGroupLabel(mensagem),
        'q-message-text--media': ['image', 'video', 'audio'].includes(mensagem.mediaType)
      }"
      @click="focarElemento(mensagem)"
    >
      <!-- @click="focarElemento(mensagem)" -->

      <!-- :bg-color="mensagem.fromMe ? '' : 'green-3' " -->
      <!-- :bg-color="mensagem.fromMe ? 'grey-2' : 'secondary' " -->
      <div
        class="full-width"
        :style="mensagem.isDeleted ? 'color: rgba(0, 0, 0, 0.36) !important;' : ''"
      >
        <div
          v-if="mensagem.isDeleted"
          class="text-italic"
        > Mensagem apagada em {{ formatarData(mensagem.updatedAt, 'dd/MM/yyyy') }}.</div>
        <div
          v-if="isGroupLabel(mensagem)"
          class="q-mb-sm"
          style="display: flex; color: rgb(59 23 251); fontWeight: 500;"
        >
          {{ isGroupLabel(mensagem) }}
        </div>
        <div
          v-if="!isGroupLabel(mensagem) && !mensagem.fromMe"
          class="q-mb-sm"
          style="display: flex; color: rgb(59 23 251); fontWeight: 500;"
        >
          {{ mensagem.contact && mensagem.contact.name }}
        </div>
        <template v-if="mensagem.mediaType === 'audio'">
          <div style="position: relative; cursor: pointer;" title="Clique para navegar até a mensagem original">
            <WhatsAppAudioPlayer
              :audioUrl="mensagem.mediaUrl"
              :isPTT="isAudioPTT(mensagem)"
              :isSent="mensagem.fromMe"
              :audioName="getAudioFileName(mensagem)"
              :showSpeedControl="true"
              :ackStatus="mensagem.ack || 0"
              style="pointer-events: none;"
            />
            <!-- Overlay clicável transparente para interceptar cliques -->
            <div
              @click.stop.prevent="focarElemento(mensagem)"
              style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10; cursor: pointer;"
              title="Clique para navegar até a mensagem original"
            ></div>
          </div>
        </template>
        <template v-if="mensagem.mediaType === 'vcard'">
          <q-btn
            type="a"
            color="black"
            outline
            dense
            class="q-px-sm text-center"
            download="vCard"
            :href="`data:text/x-vcard;charset=utf-8;base64,${returnCardContato(mensagem.body)}`"
            @click.stop.prevent="focarElemento(mensagem)"
            title="Clique para navegar até a mensagem original"
          >
            Download Contato
          </q-btn>
        </template>
        <template v-if="mensagem.mediaType === 'image'">
          <!-- @click="buscarImageCors(mensagem.mediaUrl)" -->
          <q-img
            @click.stop.prevent="focarElemento(mensagem)"
            :src="mensagem.mediaUrl"
            spinner-color="primary"
            height="60px"
            width="100px"
            style="cursor: pointer; max-width: 100px; object-fit: cover; border-radius: 8px;"
            title="Clique para navegar até a mensagem original"
          />
          <VueEasyLightbox
            moveDisabled
            :visible="abrirModalImagem"
            :imgs="urlMedia"
            :index="mensagem.ticketId || 1"
            @hide="abrirModalImagem = false"
          />
        </template>
        <template v-if="mensagem.mediaType === 'video'">
          <div style="position: relative; cursor: pointer;" title="Clique para navegar até a mensagem original">
            <video
              :src="mensagem.mediaUrl"
              controls
              style="objectFit: contain;
                    width: 130px;
                    height: 60px;
                    borderTopLeftRadius: 8px;
                    borderTopRightRadius: 8px;
                    borderBottomLeftRadius: 8px;
                    borderBottomRightRadius: 8px;
                    pointer-events: none;
                    background: #f5f5f5;
                  "
              >
            </video>
            <!-- Overlay clicável transparente para interceptar cliques -->
            <div
              @click.stop.prevent="focarElemento(mensagem)"
              style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10; cursor: pointer;"
              title="Clique para navegar até a mensagem original"
            ></div>
          </div>
        </template>
        <template v-if="mensagem.mediaType === 'application'">
          <div class="text-center ">
            <q-btn
              type="a"
              color="grey-3"
              no-wrap
              no-caps
              stack
              class="q-my-sm text-center text-black btn-rounded text-grey-9 ellipsis"
              download
              :target="isPDF(mensagem.mediaUrl) ? '_blank' : ''"
              :href="mensagem.mediaUrl"
              @click.stop.prevent="focarElemento(mensagem)"
              title="Clique para navegar até a mensagem original"
            >
              <q-tooltip
                v-if="mensagem.mediaUrl"
                content-class="bg-padrao text-grey-9 text-bold"
              >
                Baixar: <span v-html="formatarMensagemWhatsapp(mensagem.body)"></span>
              </q-tooltip>
              <template slot>
                <div
                  class="row items-center q-my-sm"
                  style="max-width: 180px"
                >
                  <div class="ellipsis col-grow q-pr-sm" v-html="formatarMensagemWhatsapp(mensagem.body)">
                  </div>
                  <q-icon
                    class="col"
                    name="mdi-download"
                  />
                </div>

              </template>
            </q-btn>
          </div>
          <!-- <q-btn
                type="a"
                color="primary"
                outline
                dense
                class="q-px-sm text-center"
                target="_blank"
                :href="`http://docs.google.com/gview?url=${mensagem.mediaUrl}&embedded=true`"
              >
                Visualizar
              </q-btn> -->
        </template>
        <div
          v-linkified
          v-if="!['vcard', 'application', 'audio', 'image', 'video'].includes(mensagem.mediaType)"
          :class="{'q-mt-sm': mensagem.mediaType !== 'chat'}"
          class="q-message-container row items-end no-wrap ellipsis-3-lines"
        >
          <div v-html="formatarMensagemWhatsapp(mensagem.body)">
          </div>
        </div>

        <!-- Botões Interativos -->
        <template v-if="mensagem.dataPayload && mensagem.dataPayload.buttons">
          <div class="row q-gutter-sm justify-start q-mt-sm">
            <q-btn
              v-for="(button, btnIndex) in mensagem.dataPayload.buttons"
              :key="btnIndex"
              dense
              outline
              no-caps
              color="primary"
              class="q-px-sm"
              :label="button.body || button.buttonText?.displayText || 'Botão'"
              :loading="buttonStates[`button_${mensagem.id}_${btnIndex}`]?.loading"
              :disabled="buttonStates[`button_${mensagem.id}_${btnIndex}`]?.disabled"
              @click.stop.prevent="focarElemento(mensagem)"
              title="Clique para navegar até a mensagem original"
            />
          </div>
        </template>

        <!-- Lista Interativa -->
        <template v-if="mensagem.dataPayload && mensagem.dataPayload.title">
          <div class="row q-gutter-sm justify-start q-mt-sm">
            <q-card class="list-message-card" flat @click.stop.prevent="focarElemento(mensagem)" style="cursor: pointer;" title="Clique para navegar até a mensagem original">
              <q-card-section class="q-pa-sm">
                <div class="text-subtitle2 text-weight-medium">{{ mensagem.dataPayload.title }}</div>
                <div v-if="mensagem.dataPayload.description" class="text-caption q-mt-xs">
                  {{ mensagem.dataPayload.description }}
                </div>
              </q-card-section>
              <q-card-section class="q-pa-sm q-pt-none" v-if="mensagem.dataPayload.buttons">
                <q-btn
                  v-for="(section, sectionIndex) in mensagem.dataPayload.buttons"
                  :key="sectionIndex"
                  dense
                  outline
                  no-caps
                  color="primary"
                  class="q-px-sm q-mb-xs full-width"
                  :label="section.title || 'Opção'"
                  :loading="buttonStates[`section_${mensagem.id}_${sectionIndex}`]?.loading"
                  :disabled="buttonStates[`section_${mensagem.id}_${sectionIndex}`]?.disabled"
                  @click.stop.prevent="focarElemento(mensagem)"
                  title="Clique para navegar até a mensagem original"
                />
              </q-card-section>
            </q-card>
          </div>
        </template>

        <!-- Indicador de Resposta de Botão -->
        <template v-if="mensagem.dataPayload && mensagem.dataPayload.isButtonResponse">
          <div class="row q-gutter-sm justify-start q-mt-xs">
            <q-chip
              dense
              color="positive"
              text-color="white"
              icon="mdi-check-circle"
              class="q-px-sm"
              @click.stop.prevent="focarElemento(mensagem)"
              style="cursor: pointer;"
              title="Clique para navegar até a mensagem original"
            >
              Resposta: {{ mensagem.dataPayload.buttonText }}
            </q-chip>
          </div>
        </template>
      </div>
    </q-chat-message>
  </q-item>

</template>

<script>
import { Base64 } from 'js-base64'

import mixinCommon from './mixinCommon'
import VueEasyLightbox from 'vue-easy-lightbox'
import { EnviarRespostaBotao } from 'src/service/tickets'
import WhatsAppAudioPlayer from 'src/components/WhatsAppAudioPlayer'

export default {
  name: 'MensagemChat',
  mixins: [mixinCommon],
  props: {
    mensagem: {
      type: Object,
      default: () => { }
    },
    ticketFocado: {
      type: Object,
      default: () => { }
    },
    size: {
      type: [String, Number],
      default: '5'
    },
    isLineDate: {
      type: Boolean,
      default: true
    },
    replyingMessage: {
      type: Object,
      default: () => { }
    }
  },
  data () {
    return {
      abrirModalImagem: false,
      urlMedia: '',
      buttonStates: {}, // Para gerenciar estado dos botões
      ackIcons: { // Se ACK == 3 ou 4 entao color green
        0: 'mdi-clock-outline',
        1: 'mdi-check',
        2: 'mdi-check-all',
        3: 'mdi-check-all',
        4: 'mdi-check-all'
      }
    }
  },
  components: {
    VueEasyLightbox,
    WhatsAppAudioPlayer
  },
  methods: {
    isPDF (url) {
      if (!url) return false
      const split = url.split('.')
      const ext = split[split.length - 1]
      return ext === 'pdf'
    },
    isGroupLabel (mensagem) {
      try {
        return this.ticketFocado.isGroup ? mensagem.contact.name : ''
      } catch (error) {
        return ''
      }
    },
    returnCardContato (str) {
      // return btoa(str)
      return Base64.encode(str)
    },
    focarElemento (mensagem) {
      this.$emit('mensagem-respondida:focar-mensagem', mensagem)
    },
    async handleButtonClick (mensagem, button, btnIndex) {
      try {
        // Adicionar loading ao botão usando uma propriedade local
        const buttonKey = `button_${mensagem.id}_${btnIndex}`
        this.$set(this.buttonStates, buttonKey, { loading: true })

        const buttonText = button.body || button.buttonText?.displayText || 'Botão'

        // Enviar resposta do botão
        await EnviarRespostaBotao({
          ticketId: this.ticketFocado?.id,
          buttonId: button.id,
          buttonText: buttonText,
          messageId: mensagem.id
        })

        // Marcar botões como desabilitados usando propriedades locais
        if (mensagem.dataPayload && mensagem.dataPayload.buttons) {
          mensagem.dataPayload.buttons.forEach((btn, index) => {
            const btnKey = `button_${mensagem.id}_${index}`
            this.$set(this.buttonStates, btnKey, { disabled: true, loading: false })
          })
        }

        this.$q.notify({
          type: 'positive',
          message: `Resposta enviada: ${buttonText}`,
          position: 'bottom-right'
        })
      } catch (error) {
        console.error('Erro ao enviar resposta do botão:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao enviar resposta do botão',
          position: 'bottom-right'
        })
      } finally {
        // Remover loading do botão
        const buttonKey = `button_${mensagem.id}_${btnIndex}`
        this.$set(this.buttonStates, buttonKey, { loading: false })
      }
    },
    async handleListButtonClick (mensagem, section, sectionIndex) {
      try {
        // Adicionar loading ao botão da lista usando uma propriedade local
        const sectionKey = `section_${mensagem.id}_${sectionIndex}`
        this.$set(this.buttonStates, sectionKey, { loading: true })

        const buttonText = section.title || 'Opção'

        // Enviar resposta do botão da lista
        await EnviarRespostaBotao({
          ticketId: this.ticketFocado?.id,
          buttonId: section.id || `section_${sectionIndex}`,
          buttonText: buttonText,
          messageId: mensagem.id
        })

        // Marcar botões da lista como desabilitados usando propriedades locais
        if (mensagem.dataPayload && mensagem.dataPayload.buttons) {
          mensagem.dataPayload.buttons.forEach((btn, index) => {
            const btnKey = `section_${mensagem.id}_${index}`
            this.$set(this.buttonStates, btnKey, { disabled: true, loading: false })
          })
        }

        this.$q.notify({
          type: 'positive',
          message: `Resposta enviada: ${buttonText}`,
          position: 'bottom-right'
        })
      } catch (error) {
        console.error('Erro ao enviar resposta da lista:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao enviar resposta da lista',
          position: 'bottom-right'
        })
      } finally {
        // Remover loading do botão da lista
        const sectionKey = `section_${mensagem.id}_${sectionIndex}`
        this.$set(this.buttonStates, sectionKey, { loading: false })
      }
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
  }
}
</script>

<style lang="scss">
.message-image {
  cursor: pointer;
  object-fit: cover;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
}

// Estilos específicos para mensagens de resposta
#chat-message-resp {
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  /* Indicador visual de que é clicável */
  &::after {
    content: '↗';
    position: absolute;
    top: 4px;
    right: 8px;
    font-size: 10px;
    color: rgba(25, 118, 210, 0.6);
    font-weight: bold;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

    &::after {
      opacity: 1;
    }

    .q-message-text {
      background: rgba(25, 118, 210, 0.08) !important;
      border-left-color: rgba(25, 118, 210, 0.8) !important;
    }
  }

  .q-message-text {
    background: rgba(0, 0, 0, 0.05) !important;
    border-radius: 8px !important;
    padding: 6px 10px !important;
    font-size: 12px !important;
    line-height: 1.3 !important;
    max-width: 100% !important;
    margin: 0 !important;
    box-shadow: none !important;
    transition: all 0.2s ease;

    &::before {
      display: none !important;
    }
  }

  .q-message-text--received {
    background: rgba(0, 0, 0, 0.05) !important;
    border-left: 3px solid var(--primary-color) !important;
  }

  .q-message-text--sent {
    background: rgba(37, 211, 102, 0.1) !important;
    border-left: 3px solid var(--primary-color) !important;
  }

  .q-message-text--deleted {
    background: rgba(0, 0, 0, 0.03) !important;
    color: var(--text-color-secondary) !important;
    opacity: 0.6;
    font-style: italic;
  }

  /* Todos os elementos de mídia dentro da mensagem citada são clicáveis */
  video, audio, img, .q-img, .q-btn, .q-card, .q-chip {
    cursor: pointer !important;
  }

  /* Overlay para elementos de mídia */
  .media-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    cursor: pointer;
    border-radius: inherit;

    &:hover {
      background: rgba(25, 118, 210, 0.1);
    }
  }
}

// Modo escuro para mensagens de resposta
.body--dark #chat-message-resp {
  &::after {
    color: rgba(144, 202, 249, 0.8);
  }

  &:hover {
    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);

    .q-message-text {
      background: rgba(144, 202, 249, 0.15) !important;
      border-left-color: rgba(144, 202, 249, 0.8) !important;
    }
  }

  .q-message-text {
    background: rgba(255, 255, 255, 0.1) !important;
  }

  .q-message-text--received {
    background: rgba(255, 255, 255, 0.1) !important;
    border-left-color: var(--primary-color) !important;
  }

  .q-message-text--sent {
    background: rgba(37, 211, 102, 0.2) !important;
    border-left-color: var(--primary-color) !important;
  }

  .q-message-text--deleted {
    background: rgba(255, 255, 255, 0.05) !important;
    color: var(--text-color-secondary) !important;
    opacity: 0.6;
  }

  .media-overlay:hover {
    background: rgba(144, 202, 249, 0.15);
  }
}
</style>
