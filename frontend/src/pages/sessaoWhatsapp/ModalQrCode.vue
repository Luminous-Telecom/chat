<template>
  <q-dialog :value="abrirModalQR"
    @hide="fecharModalQrModal"
    persistent>
    <q-card
      :class="{ 'bg-white': !$q.dark.isActive, 'bg-dark': $q.dark.isActive }"
      class="modern-modal"
      style="min-width: 400px; border-radius: 16px; overflow: hidden;">

      <!-- Header -->
      <q-card-section class="row items-center justify-between q-pa-lg" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div class="text-h6 text-white font-weight-medium">
          <q-icon name="qr_code_scanner" class="q-mr-sm" size="24px" />
          Conectar WhatsApp
        </div>
        <q-btn
          round
          flat
          color="white"
          icon="close"
          size="sm"
          @click="fecharModalQrModal"
          class="hover-scale" />
      </q-card-section>

      <!-- QR Code Section -->
      <q-card-section class="text-center q-pa-xl qr-code-section" style="background: #f8f9fa;">
        <div class="qr-container">
          <div v-if="cQrcode" class="qr-code-wrapper">
            <qrcode-vue
              :value="cQrcode"
              :size="280"
              level="M"
              class="qr-code-modern"
            />
            <!-- Baileys Logo Overlay -->
            <div class="baileys-logo-overlay">
              <svg width="60" height="60" viewBox="0 0 100 100" class="baileys-logo">
                <!-- Background circle -->
                <circle cx="50" cy="50" r="45" fill="#25D366" stroke="white" stroke-width="4"/>
                <!-- WhatsApp-style icon -->
                <path d="M50 15C30.67 15 15 30.67 15 50c0 6.08 1.56 11.8 4.3 16.78L15 85l18.22-4.3C38.2 83.44 43.92 85 50 85c19.33 0 35-15.67 35-35S69.33 15 50 15zm0 63c-5.22 0-10.16-1.44-14.38-4.17L25 76l2.17-10.62C24.44 60.16 23 55.22 23 50c0-14.91 12.09-27 27-27s27 12.09 27 27-12.09 27-27 27z" fill="white"/>
                <!-- Inner chat bubble -->
                <path d="M42 38c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8l6 6V40c0-1.1-.9-2-2-2H42z" fill="white"/>
                <!-- Baileys text -->
                <text x="50" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#25D366">BAILEYS</text>
              </svg>
            </div>
          </div>
          <div v-else class="loading-container">
            <q-spinner-dots size="40px" color="primary" />
            <div class="text-body1 text-grey-7 q-mt-md">Aguardando QR Code...</div>
          </div>
        </div>
      </q-card-section>

      <!-- Instructions -->
      <q-card-section class="q-pa-lg">
        <div class="instruction-card">
          <div class="text-body2 text-center q-mb-md" :class="{ 'text-grey-8': !$q.dark.isActive, 'text-grey-3': $q.dark.isActive }">
            <q-icon name="smartphone" class="q-mr-xs" />
            Abra o WhatsApp no seu celular e escaneie o código
          </div>

          <div class="text-caption text-center q-mb-lg" :class="{ 'text-grey-6': !$q.dark.isActive, 'text-grey-4': $q.dark.isActive }">
            Caso tenha problemas com a leitura, solicite um novo QR Code
          </div>

          <div class="row justify-center">
            <q-btn
              color="primary"
              unelevated
              rounded
              label="Gerar Novo QR Code"
              @click="solicitarQrCode"
              icon="refresh"
              class="modern-btn q-px-lg"
              :loading="false" />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>

</template>

<script>
import QrcodeVue from 'qrcode.vue'

export default {
  name: 'ModalQrCode',
  components: {
    QrcodeVue
  },
  props: {
    abrirModalQR: {
      type: Boolean,
      default: false
    },
    channel: {
      type: Object,
      default: () => ({
        id: null,
        qrcode: ''
      })
    }
  },
  watch: {
    channel: {
      handler (v) {
        if (this.channel.status === 'CONNECTED') {
          this.fecharModalQrModal()
        }
      },
      deep: true
    },
    'channel.status': {
      handler (newStatus) {
        if (newStatus === 'CONNECTED') {
          this.fecharModalQrModal()
        }
      },
      immediate: true
    }
  },
  computed: {
    cQrcode () {
      return this.channel.qrcode
    }
  },
  methods: {
    solicitarQrCode () {
      this.$emit('gerar-novo-qrcode', this.channel)
      this.fecharModalQrModal()
    },
    fecharModalQrModal () {
      this.$emit('update:abrirModalQR', false)
    }
  },
  mounted () {
    // Listener direto para atualizações de sessão via socket
    this.$root.$on('UPDATE_SESSION', (session) => {
      if (session.id === this.channel.id && session.status === 'CONNECTED') {
        this.fecharModalQrModal()
      }
    })

    // Listener adicional para readySession
    this.$root.$on('READY_SESSION', (session) => {
      if (session.id === this.channel.id) {
        this.fecharModalQrModal()
      }
    })
  },
  beforeDestroy () {
    // Remove os listeners para evitar memory leaks
    this.$root.$off('UPDATE_SESSION')
    this.$root.$off('READY_SESSION')
  }
}
</script>

<style lang="scss" scoped>
.modern-modal {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
}

.qr-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 320px;
  padding: 20px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.qr-code-wrapper {
  position: relative;
  display: inline-block;
}

.qr-code-modern {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.02);
  }
}

.baileys-logo-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  pointer-events: none;
}

.baileys-logo {
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}

.instruction-card {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  padding: 20px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modern-btn {
  transition: all 0.3s ease;
  font-weight: 500;
  text-transform: none;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
}

.hover-scale {
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
}

// Dark theme adjustments
body.body--dark {
  .instruction-card {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .qr-container {
    background: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
}

// Responsive design
@media (max-width: 480px) {
  .modern-modal {
    margin: 16px;
    min-width: auto;
    width: calc(100vw - 32px);
  }

  .qr-code-modern {
    max-width: 100%;
    height: auto;
  }

  .qr-container {
    padding: 16px;
    min-height: 280px;
  }
}
</style>
