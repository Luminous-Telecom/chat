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
      class="text-weight-medium fit q-ma-none"
      id="chat-message-resp"
      style="min-width: 100px; max-width: 350px"
      :class="{
        'q-message-text--deleted': mensagem.isDeleted,
        'q-message-text--group': isGroupLabel(mensagem),
        'q-message-text--media': ['image', 'video', 'audio'].includes(mensagem.mediaType)
      }"
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
          <div style="width: 200px; heigth: 300px">
            <audio
              style="max-width: 200px;"
              class="full-width"
              controls
            >
              <source
                :src="mensagem.mediaUrl"
                type="audio/ogg"
              />
            </audio>
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
          >
            Download Contato
          </q-btn>
        </template>
        <template v-if="mensagem.mediaType === 'image'">
          <!-- @click="buscarImageCors(mensagem.mediaUrl)" -->
          <q-img
            @click="urlMedia=mensagem.mediaUrl; abrirModalImagem=true"
            :src="mensagem.mediaUrl"
            spinner-color="primary"
            height="60px"
            width="130px"
            style="cursor: pointer;"
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
          <video
            :src="mensagem.mediaUrl"
            controls
            style="objectFit: cover;
                  width: 130px;
                  height: 60px;
                  borderTopLeftRadius: 8px;
                  borderTopRightRadius: 8px;
                  borderBottomLeftRadius: 8px;
                  borderBottomRightRadius: 8px;
                "
            >
          </video>
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
            >
              <q-tooltip
                v-if="mensagem.mediaUrl"
                content-class="bg-padrao text-grey-9 text-bold"
              >
                Baixar: {{ mensagem.body }}
              </q-tooltip>
              <template slot>
                <div
                  class="row items-center q-my-sm"
                  style="max-width: 180px"
                >
                  <div class="ellipsis col-grow q-pr-sm">
                    {{ farmatarMensagemWhatsapp(mensagem.body) }}
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
          v-if="!['vcard', 'application', 'audio', 'image', 'video' ].includes(mensagem.mediaType)"
          :class="{'q-mt-sm': mensagem.mediaType !== 'chat'}"
          class="q-message-container row items-end no-wrap ellipsis-3-lines"
        >
          <div v-html="farmatarMensagemWhatsapp(mensagem.body)">
          </div>
        </div>
      </div>
    </q-chat-message>
  </q-item>

</template>

<script>
import { Base64 } from 'js-base64'

import mixinCommon from './mixinCommon'
import VueEasyLightbox from 'vue-easy-lightbox'

export default {
  name: 'MensagemChat',
  mixins: [mixinCommon],
  props: {
    mensagem: {
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
    VueEasyLightbox
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
  .q-message-text {
    background: rgba(0, 0, 0, 0.05) !important;
    border-radius: 8px !important;
    padding: 6px 10px !important;
    font-size: 12px !important;
    line-height: 1.3 !important;
    max-width: 100% !important;
    margin: 0 !important;
    box-shadow: none !important;

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
}

// Modo escuro para mensagens de resposta
.body--dark #chat-message-resp {
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
}
</style>
