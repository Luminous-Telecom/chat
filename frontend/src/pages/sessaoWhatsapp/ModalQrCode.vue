<template>
  <q-dialog :value="abrirModalQR"
    @hide="fecharModalQrModal"
    persistent>
    <q-card style="background: white;">
      <q-card-section>
        <div class="text-h6 text-primary">
          Leia o QrCode para iniciar a sessão
          <q-btn round
            class="q-ml-md"
            color="negative"
            icon="mdi-close"
            @click="fecharModalQrModal" />
        </div>
      </q-card-section>
      <q-card-section class="text-center"
        :style="$q.dark.isActive ? 'background: white !important' : ''">
        <qrcode-vue
          v-if="cQrcode"
          :value="cQrcode"
          :size="300"
          level="M"
        />
        <span v-else>
          Aguardando o Qr Code
        </span>
      </q-card-section>
      <q-card-section>
        <div class="row">Caso tenha problema com a leitura, solicite um novo Qr Code </div>
        <div class="row col-12 justify-center">
          <q-btn color="primary"
            glossy
            ripple
            outline
            label="Novo QR Code"
            @click="solicitarQrCode"
            icon="watch_later" />
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

</style>
