<template>
  <q-dialog :value="abrirModalQR"
    @hide="fecharModalQrModal"
    persistent>
    <q-card
      class="modern-modal-professional"
      :class="{ 'light-theme': !$q.dark.isActive, 'dark-theme': $q.dark.isActive }">

      <!-- Header -->
      <q-card-section class="professional-header">
        <div class="header-content">
          <div class="header-title">
            <div class="title-icon-wrapper">
              <q-icon name="qr_code_scanner" class="title-icon" />
            </div>
            <div class="title-text">
              <div class="main-title">Conectar WhatsApp</div>
              <div class="subtitle">Escaneie o código QR para conectar</div>
            </div>
          </div>
          <q-btn
            round
            flat
            icon="close"
            @click="fecharModalQrModal"
            class="close-btn" />
        </div>
      </q-card-section>

      <!-- QR Code Section -->
      <q-card-section class="qr-main-section">
        <div v-if="cQrcode" class="qr-content-wrapper">
          <!-- Logo above QR Code -->
          <div class="logo-container">
            <div class="logo-badge">
              <img :src="baileysLogo" alt="Baileys Logo" class="baileys-logo-professional" />
            </div>
          </div>

           <!-- QR Code -->
          <div class="qr-code-container">
            <div class="qr-frame">
              <qrcode-vue
                :value="cQrcode"
                :size="200"
                level="M"
                render-as="svg"
                class="qr-code-professional" />
            </div>
            <div class="qr-scan-animation"></div>
          </div>
        </div>

         <div v-else class="loading-state">
          <div class="loading-animation">
            <div class="loading-spinner"></div>
            <div class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="loading-text">
            Gerando QR Code...
          </div>
        </div>
      </q-card-section>

      <!-- Instructions Section -->
      <q-card-section class="instructions-section">
        <div class="instruction-panel">
          <div class="instruction-steps">
            <div class="step-item">
              <div class="step-icon">
                <q-icon name="smartphone" />
              </div>
              <div class="step-text">
                <div class="step-title">Abra o WhatsApp</div>
                <div class="step-desc">No seu celular e escaneie o código</div>
              </div>
            </div>
          </div>

          <div class="help-text">
            Problemas para conectar? Gere um novo código
          </div>

          <div class="action-buttons">
            <q-btn
              class="refresh-btn"
              @click="solicitarQrCode"
              :loading="false">
              <q-icon name="refresh" class="q-mr-sm" />
              Gerar Novo QR Code
            </q-btn>
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
// Professional Modal Container
.modern-modal-professional {
  width: 420px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &.light-theme {
    background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  }

  &.dark-theme {
    background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
  }
}

// Professional Header
.professional-header {
  background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
  padding: 24px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 100%);
    pointer-events: none;
  }
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title-icon-wrapper {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.title-icon {
  font-size: 24px;
  color: white;
}

.title-text {
  .main-title {
    font-size: 20px;
    font-weight: 600;
    color: white;
    margin-bottom: 4px;
    letter-spacing: -0.025em;
  }

  .subtitle {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 400;
  }
}

.close-btn {
  color: white;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }
}

// QR Code Section
.qr-main-section {
  padding: 32px 24px;
  text-align: center;
}

.qr-content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.logo-container {
  display: flex;
  justify-content: center;
}

.logo-badge {
  background: linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%);
  padding: 12px 20px;
  border-radius: 16px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.baileys-logo-professional {
  width: 140px;
  height: 42px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.qr-code-container {
  position: relative;
  display: inline-block;
}

.qr-frame {
  background: white;
  padding: 20px;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%);
    pointer-events: none;
  }
}

.qr-code-professional {
  border-radius: 12px;
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.02);
  }
}

.qr-scan-animation {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 240px;
  height: 240px;
  border: 2px solid #10b981;
  border-radius: 20px;
  opacity: 0;
  animation: scanPulse 3s ease-in-out infinite;
}

@keyframes scanPulse {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  50% { opacity: 0.3; transform: translate(-50%, -50%) scale(1.1); }
}

// Loading State
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  gap: 24px;
}

.loading-animation {
  position: relative;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 3px solid rgba(16, 185, 129, 0.1);
  border-top: 3px solid #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-dots {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: center;

  span {
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    animation: bounce 1.4s ease-in-out infinite both;

    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
    &:nth-child(3) { animation-delay: 0s; }
  }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  color: #64748b;
  letter-spacing: -0.025em;
}

// Instructions Section
.instructions-section {
  padding: 0 24px 32px;
}

.instruction-panel {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 250, 252, 0.8) 100%);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.05);
}

.instruction-steps {
  margin-bottom: 20px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.step-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.step-text {
  .step-title {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 4px;
    letter-spacing: -0.025em;
  }

  .step-desc {
    font-size: 14px;
    color: #64748b;
    font-weight: 400;
  }
}

.help-text {
  text-align: center;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 24px;
  font-weight: 400;
}

.action-buttons {
  display: flex;
  justify-content: center;
}

.refresh-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  letter-spacing: -0.025em;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
  }

  &:active {
    transform: translateY(0);
  }
}

// Dark Theme Adjustments
.dark-theme {
  .instruction-panel {
    background: linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .step-text .step-title {
    color: #f1f5f9;
  }

  .step-text .step-desc {
    color: #94a3b8;
  }

  .help-text {
    color: #94a3b8;
  }

  .loading-text {
    color: #94a3b8;
  }

  .logo-badge {
    background: linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%);
  }
}

// Responsive Design
@media (max-width: 480px) {
  .modern-modal-professional {
    width: calc(100vw - 32px);
    margin: 16px;
  }

  .professional-header {
    padding: 20px;
  }

  .qr-main-section {
    padding: 24px 16px;
  }

  .instructions-section {
    padding: 0 16px 24px;
  }

  .qr-frame {
    padding: 16px;
  }

  .qr-code-professional {
    width: 180px;
    height: 180px;
  }
}
</style>
