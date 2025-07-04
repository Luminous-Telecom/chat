<template>
  <q-dialog 
    v-model="modalVisible"
    @hide="fecharModalQrModal"
    persistent
    transition-show="scale"
    transition-hide="scale"
    class="modal-modern"
    style="z-index: 9999;">
    <q-card
      class="modern-modal-professional"
      :class="{ 'light-theme': !$q.dark.isActive, 'dark-theme': $q.dark.isActive }"
      style="min-width: 400px; max-width: 90vw;">

      <!-- Header -->
      <q-card-section class="professional-header">
        <div class="header-content">
          <div class="header-title">
            <div class="title-icon-wrapper">
              <q-icon name="qr_code_scanner" class="title-icon" />
            </div>
            <div class="title-text">
              <div class="main-title">Conectar WhatsApp</div>
              <div class="subtitle">
                {{ channel?.name || 'Carregando...' }} - 
                {{ channel?.status || 'Verificando status...' }}
              </div>
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
        <div v-if="!showNumberInput">
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
                  :size="160"
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
          <!-- Botão para conectar por número -->
          <q-btn
            flat
            color="primary"
            class="full-width q-mt-md"
            @click="showNumberInput = true"
          >
            Conectar com número de telefone
          </q-btn>
        </div>
        <div v-else class="q-pa-md flex flex-center column">
          <div class="text-h5 text-center q-mb-md">Insira o número de telefone</div>
          <div class="text-subtitle2 text-center q-mb-lg">Selecione o país e insira seu número de telefone.</div>
          <q-select
            outlined
            dense
            v-model="selectedCountry"
            :options="countryOptions"
            option-label="label"
            option-value="ddi"
            label="Selecionar país"
            emit-value
            map-options
            class="q-mb-md"
          />
          <q-input
            outlined
            dense
            v-model="phoneNumber"
            label="Número de telefone"
            type="tel"
            class="q-mb-md"
          />
          <template v-if="pairingCode">
            <div class="q-mb-md text-center">
              <div class="text-h6">Código de pareamento:</div>
              <div class="text-h4 text-bold text-primary">{{ pairingCode }}</div>
              <div class="text-caption">Digite este código no WhatsApp Web para conectar</div>
            </div>
          </template>
          <q-btn color="primary" class="full-width q-mb-md" @click="conectarPorNumero">Avançar</q-btn>
          <q-btn flat color="primary" class="full-width" @click="showNumberInput = false">
            Conectar com o QR code <q-icon name="chevron_right" />
          </q-btn>
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

const countryOptions = [
  { label: 'Brasil (+55)', ddi: '55' },
  { label: 'Portugal (+351)', ddi: '351' },
  { label: 'Estados Unidos (+1)', ddi: '1' },
  { label: 'Argentina (+54)', ddi: '54' },
  { label: 'Espanha (+34)', ddi: '34' },
  { label: 'Alemanha (+49)', ddi: '49' },
  { label: 'Reino Unido (+44)', ddi: '44' }
  // ...adicione mais países conforme necessário
]

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
    abrirModalQR: {
      handler (newValue, oldValue) {
        // Modal opened/closed
      },
      immediate: true
    },
    channel: {
      handler (newChannel, oldChannel) {
        if (newChannel && newChannel.status === 'CONNECTED') {
          this.fecharModalQrModal()
        }
      },
      deep: true,
      immediate: true
    },
    'channel.status': {
      handler (newStatus, oldStatus) {
        if (newStatus === 'CONNECTED') {
          this.fecharModalQrModal()
        }
      },
      immediate: true
    },
    'channel.qrcode': {
      handler (newQrcode, oldQrcode) {
        // QR Code updated
      },
      immediate: true
    }
  },
  data () {
    return {
      baileysLogo,
      showNumberInput: false,
      selectedCountry: '55',
      phoneNumber: '',
      countryOptions,
      connectionNumber: '',
      pairingCode: ''
    }
  },
  computed: {
    cQrcode () {
      return this.channel && this.channel.qrcode ? this.channel.qrcode : ''
    },
    modalVisible: {
      get () {
        return this.abrirModalQR
      },
      set (value) {
        this.$emit('update:abrirModalQR', value)
      }
    }
  },
  methods: {
    solicitarQrCode () {
      this.$emit('gerar-novo-qrcode', this.channel)
    },
    fecharModalQrModal () {
      this.$emit('update:abrirModalQR', false)
      this.$nextTick(() => {
        this.modalVisible = false
      })
    },
    conectarPorNumero () {
      if (!this.selectedCountry || !this.phoneNumber) {
        this.$q.notify({ type: 'negative', message: 'Preencha o país e o número!', position: 'bottom-right' })
        return
      }
      const numeroCompleto = this.selectedCountry + this.phoneNumber.replace(/\D/g, '')
      this.$emit('conectar-por-numero', { channel: this.channel, number: numeroCompleto })
      this.fecharModalQrModal()
    }
  },
  mounted () {
    // Listener direto para atualizações de sessão via socket
    this.$eventBus.on('UPDATE_SESSION', (session) => {
      if (session.id === this.channel?.id) {
        // Só fecha o modal se a sessão estiver conectada, não para qrcode
        if (session.status === 'CONNECTED') {
          this.fecharModalQrModal()
        }
        // Para status 'qrcode', apenas atualiza os dados sem fechar o modal
        // O canal será atualizado automaticamente via props reativas
      }
    })

    // Listener adicional para readySession
    this.$eventBus.on('READY_SESSION', (session) => {
      if (session.id === this.channel?.id) {
        this.fecharModalQrModal()
      }
    })

    // Listener para pairing code via WebSocket
    const usuario = JSON.parse(localStorage.getItem('usuario'))
    if (usuario && usuario.tenantId) {
      const socket = window.socket || this.$root.$socket || window.$nuxt?.$socket
      if (socket) {
        socket.on(`${usuario.tenantId}:pairingCode`, ({ whatsappId, pairingCode }) => {
          if (this.channel && this.channel.id === whatsappId) {
            this.pairingCode = pairingCode
          }
        })
      }
    }
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
  width: 380px;
  max-width: 90vw;
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &.light-theme {
    background: #ffffff;
  }

  &.dark-theme {
    background: $dark-secondary;
  }
}

// Professional Header
.professional-header {
  background: #10b981;
  padding: 16px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255,255,255,0.1);
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
  padding: 16px 20px;
  text-align: center;
}

.qr-content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.logo-container {
  display: flex;
  justify-content: center;
}

.logo-badge {
  background: #ffffff;
  padding: 4px 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.baileys-logo-professional {
  width: 120px;
  height: 36px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.qr-code-container {
  position: relative;
  display: inline-block;
}

.qr-frame {
  background: white;
  padding: 16px;
  border-radius: 16px;
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
    background: rgba(16, 185, 129, 0.05);
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
  color: var(--text-color-secondary);
  letter-spacing: -0.025em;
}

// Instructions Section
.instructions-section {
  padding: 0 16px 8px;
}

.instruction-panel {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 8px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.instruction-steps {
  margin-bottom: 6px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.step-icon {
  width: 24px;
  height: 24px;
  background: #10b981;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.step-text {
  .step-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin-bottom: 1px;
    letter-spacing: -0.025em;
  }

  .step-desc {
    font-size: 10px;
    color: var(--text-color-secondary);
    font-weight: 400;
  }
}

.help-text {
  text-align: center;
  font-size: 9px;
  color: var(--text-color-secondary);
  margin-bottom: 6px;
  font-weight: 400;
}

.action-buttons {
  display: flex;
  justify-content: center;
}

.refresh-btn {
  background: #10b981;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 10px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 1px 4px rgba(16, 185, 129, 0.3);
  letter-spacing: -0.025em;

  &:hover {
    transform: translateY(-0.5px);
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
    background: #059669;
  }

  &:active {
    transform: translateY(0);
  }
}

// Dark Theme Adjustments
.dark-theme {
  .instruction-panel {
    background: rgba(45, 55, 72, 0.8);
    border: 1px solid rgba(74, 85, 104, 0.3);
  }

  .step-text .step-title {
    color: $dark-text-secondary;
  }

  .step-text .step-desc {
    color: $dark-text-primary;
  }

  .help-text {
    color: $dark-text-primary;
  }

  .loading-text {
    color: $dark-text-primary;
  }

  .logo-badge {
    background: $dark-secondary;
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
