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
            <div class="logo-above-qr">
              <img :src="baileysLogo" alt="Baileys Logo" class="baileys-logo-above" />
            </div>
            <qrcode-vue
              :value="cQrcode"
              :size="280"
              level="H"
              :margin="2"
              class="qr-code-modern"
            />
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
import baileysLogo from 'assets/baileys.png'

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
  data () {
    return {
      baileysLogo
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

.logo-above-qr {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.baileys-logo-above {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: white;
  padding: 8px;
}

.qr-code-modern {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.02);
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
