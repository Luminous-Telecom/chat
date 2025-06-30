<template>
  <div>
    <div class="row col full-width q-pa-sm">
      <q-card
        flat
        class="full-width"
      >
        <q-card-section class="text-h6 text-bold">
          Canais
          <div class="absolute-right q-pa-md">
            <q-btn
              rounded
              color="black"
              icon="mdi-plus"
              label="Adicionar"
              @click="modalWhatsapp = true"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
    <div class="row full-width">
      <q-card
        v-for="item in canais"
        :key="item.id"
        flat
        bordered
        class="col-xs-12 col-sm-5 col-md-4 col-lg-3 q-ma-sm"
      >
        <q-item>
          <q-item-section avatar>
            <q-avatar>
              <q-icon
                size="40px"
                :name="`img:${item.type}-logo.png`"
              />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-h6 text-bold">Nome: {{ item.name }}</q-item-label>
            <q-item-label class="text-h6 text-caption">
              {{ item.type }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              round
              flat
              dense
              icon="mdi-pen"
              @click="handleOpenModalWhatsapp(item)"
              v-if="isAdmin"
            />
          </q-item-section>
        </q-item>
        <q-separator />
        <q-card-section>
          <ItemStatusChannel :item="item" />
          <template v-if="item.type === 'messenger'">
            <div class="text-body2 text-bold q-mt-sm">
              <span> Página: </span>
              {{ item.fbObject && item.fbObject.name || 'Nenhuma página configurada.' }}
            </div>
          </template>
        </q-card-section>
        <q-card-section>
          <q-select
            outlined
            dense
            rounded
            label="Bot"
            v-model="item.chatFlowId"
            :options="listaChatFlow"
            map-options
            emit-value
            option-value="id"
            option-label="name"
            clearable
            @input="handleSaveWhatsApp(item)"
          />
        </q-card-section>
        <q-separator />
        <q-card-actions
          class="q-gutter-md q-pa-md q-pt-none"
          align="center"
        >
          <template v-if="item.type !== 'messenger'">
            <q-btn
              rounded
              v-if="item.type == 'whatsapp' && item.status == 'qrcode'"
              color="blue-5"
              label="QR Code"
              @click="handleOpenQrModal(item, 'btn-qrCode')"
              icon-right="watch_later"
              :disable="!isAdmin"
            />

            <div
              v-if="item.status == 'DISCONNECTED'"
              class="q-gutter-sm"
            >
              <q-btn
                rounded
                color="positive"
                label="Conectar"
                @click="handleStartWhatsAppSession(item.id)"
              />
              <q-btn
                rounded
                v-if="item.status == 'DISCONNECTED' && item.type == 'whatsapp'"
                color="blue-5"
                label="Novo QR Code"
                @click="handleRequestNewQrCode(item, 'btn-qrCode')"
                icon-right="watch_later"
                :disable="!isAdmin"
              />
            </div>

            <div
              v-if="item.status == 'OPENING'"
              class="row items-center q-gutter-sm flex flex-inline"
            >
              <div class="text-bold">
                Conectando
              </div>
              <q-spinner-radio
                color="positive"
                size="2em"
              />
              <q-separator
                vertical
                spaced=""
              />
            </div>

            <q-btn
              v-if="['OPENING', 'CONNECTED', 'PAIRING', 'TIMEOUT'].includes(item.status)"
              color="negative"
              label="Desconectar"
              @click="handleDisconectWhatsSession(item.id)"
              :disable="!isAdmin"
              class="q-mx-sm"
            />
          </template>
          <q-btn
            color="red"
            icon="mdi-delete"
            @click="deleteWhatsapp(item)"
            :disable="!isAdmin"
            dense
            round
            flat
            class="absolute-bottom-right"
          >
            <q-tooltip>
              Deletar conexáo
            </q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-card>
    </div>
    <ModalQrCode
      :abrirModalQR.sync="abrirModalQR"
      :channel="cDadosWhatsappSelecionado"
      @gerar-novo-qrcode="v => handleRequestNewQrCode(v, 'btn-qrCode')"
      @conectar-por-numero="handleConnectByNumber"
    />
    <ModalWhatsapp
      :modalWhatsapp.sync="modalWhatsapp"
      :whatsAppEdit.sync="whatsappSelecionado"
      @recarregar-lista="listarWhatsapps"
    />
    <q-inner-loading :showing="loading">
      <q-spinner-gears
        size="50px"
        color="primary"
      />
    </q-inner-loading>
  </div>
</template>

<script>

import { ListarWhatsapps, DeletarWhatsapp, UpdateWhatsapp, StartWhatsappSession, RequestNewQrCode, DeleteWhatsappSession, GetWhatSession } from 'src/service/sessoesWhatsapp'
import { format, parseISO } from 'date-fns'
import pt from 'date-fns/locale/pt-BR/index'
import ModalQrCode from './ModalQrCode'
import { mapGetters } from 'vuex'
import ModalWhatsapp from './ModalWhatsapp'
import ItemStatusChannel from './ItemStatusChannel'
import { ListarChatFlow } from 'src/service/chatFlow'
import request from 'src/service/request'

const userLogado = JSON.parse(localStorage.getItem('usuario'))

export default {
  name: 'IndexSessoesWhatsapp',
  components: {
    ModalQrCode,
    ModalWhatsapp,
    ItemStatusChannel
  },
  data () {
    return {
      loading: false,
      userLogado,
      isAdmin: false,
      abrirModalQR: false,
      modalWhatsapp: false,
      whatsappSelecionado: {},
      listaChatFlow: [],
      whatsAppId: null,
      canais: [],
      objStatus: {
        qrcode: ''
      },
      columns: [
        {
          name: 'name',
          label: 'Nome',
          field: 'name',
          align: 'left'
        },
        {
          name: 'status',
          label: 'Status',
          field: 'status',
          align: 'center'
        },
        {
          name: 'session',
          label: 'Sessão',
          field: 'status',
          align: 'center'
        },
        {
          name: 'number',
          label: 'Número',
          field: 'number',
          align: 'center'
        },
        {
          name: 'updatedAt',
          label: 'Última Atualização',
          field: 'updatedAt',
          align: 'center',
          format: d => this.formatarData(d, 'dd/MM/yyyy HH:mm')
        },
        {
          name: 'isDefault',
          label: 'Padrão',
          field: 'isDefault',
          align: 'center'
        },
        {
          name: 'acoes',
          label: 'Ações',
          field: 'acoes',
          align: 'center'
        }
      ]
    }
  },
  watch: {
    whatsapps: {
      handler (newWhatsapps) {
        this.canais = JSON.parse(JSON.stringify(this.whatsapps))

        console.log('🔄 Whatsapps store updated, checking selected whatsapp...')

        // Se há um whatsapp selecionado e o modal está aberto, atualize a referência
        if (this.whatsappSelecionado && this.whatsappSelecionado.id && this.abrirModalQR) {
          const updatedWhatsapp = newWhatsapps.find(w => w.id === this.whatsappSelecionado.id)
          if (updatedWhatsapp) {
            console.log('📱 Updating selected whatsapp reference:', updatedWhatsapp)
            console.log('🔑 QR Code in updated whatsapp:', updatedWhatsapp.qrcode ? 'QR CODE PRESENT' : 'NO QR CODE')

            // Force update the reference
            this.whatsappSelecionado = { ...updatedWhatsapp }
          }
        }
      },
      deep: true
    }
  },
  computed: {
    ...mapGetters(['whatsapps']),
    cDadosWhatsappSelecionado () {
      const { id } = this.whatsappSelecionado
      console.log('🔍 cDadosWhatsappSelecionado computed called for ID:', id)
      console.log('📊 Current whatsapps in store:', this.whatsapps.length)

      const found = this.whatsapps.find(w => w.id === id)
      console.log('📱 Found whatsapp:', found)
      console.log('🔑 QR Code in found whatsapp:', found ? found.qrcode : 'NO WHATSAPP FOUND')
      console.log('📊 Status in found whatsapp:', found ? found.status : 'NO WHATSAPP FOUND')

      return found
    }
  },
  methods: {
    formatarData (data, formato) {
      return format(parseISO(data), formato, { locale: pt })
    },
    handleOpenQrModal (channel) {
      console.log('🎯 handleOpenQrModal called with channel:', channel)
      this.whatsappSelecionado = channel
      this.abrirModalQR = true
      console.log('✅ Modal should be open now, abrirModalQR:', this.abrirModalQR)
    },
    handleOpenModalWhatsapp (whatsapp) {
      this.whatsappSelecionado = whatsapp
      this.modalWhatsapp = true
    },
    async handleDisconectWhatsSession (whatsAppId) {
      this.$q.dialog({
        title: 'Atenção!! Deseja realmente desconectar? ',
        cancel: {
          label: 'Não',
          color: 'primary',
          push: true
        },
        ok: {
          label: 'Sim',
          color: 'negative',
          push: true
        },
        persistent: true
      }).onOk(() => {
        this.loading = true
        DeleteWhatsappSession(whatsAppId).then(() => {
          const whatsapp = this.whatsapps.find(w => w.id === whatsAppId)
          this.$store.commit('UPDATE_WHATSAPPS', {
            ...whatsapp,
            status: 'DISCONNECTED'
          })
        }).finally(f => {
          this.loading = false
        })
      })
    },
    async handleStartWhatsAppSession (whatsAppId) {
      try {
        this.loading = true
        const { data: currentState } = await GetWhatSession(whatsAppId)
        if (['CONNECTING', 'CONNECTED', 'OPENING'].includes(currentState.status)) {
          this.$q.notify({
            type: 'info',
            message: 'Sessão já está em andamento, aguarde...',
            position: 'bottom-right'
          })
          return
        }
        if (['DISCONNECTED', 'TIMEOUT', 'ERROR'].includes(currentState.status)) {
          await DeleteWhatsappSession(whatsAppId)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        await StartWhatsappSession(whatsAppId)
        this.$q.notify({
          type: 'positive',
          message: 'Iniciando conexão com o WhatsApp...',
          position: 'bottom-right',
          timeout: 3000
        })
        let attempts = 0
        const maxAttempts = 10
        const checkConnection = async () => {
          if (attempts >= maxAttempts) {
            this.$q.notify({
              type: 'negative',
              message: 'Tempo limite excedido ao tentar conectar',
              position: 'bottom-right'
            })
            return
          }
          try {
            const { data: status } = await GetWhatSession(whatsAppId)
            if (status.status === 'CONNECTED') {
              this.$q.notify({
                type: 'positive',
                message: 'Conectado com sucesso!',
                position: 'bottom-right'
              })
              await this.loadWhatsapps()
              return
            }
            if (['DISCONNECTED', 'TIMEOUT', 'ERROR'].includes(status.status)) {
              this.$q.notify({
                type: 'negative',
                message: 'Falha na conexão. Tente novamente.',
                position: 'bottom-right'
              })
              return
            }
            attempts++
            setTimeout(checkConnection, 2000)
          } catch (error) {
            // Erro ao verificar conexão
            attempts++
            setTimeout(checkConnection, 2000)
          }
        }
        setTimeout(checkConnection, 2000)
      } catch (error) {
        console.error('Erro ao iniciar sessão:', error)
        let msg = ''
        if (error?.response?.data?.error) {
          msg = error.response.data.error
        } else if (error?.response?.data?.details) {
          msg = error.response.data.details
        } else if (error?.message && error.message !== 'Network Error') {
          msg = error.message
        }
        if (msg) {
          this.$q.notify({
            type: 'negative',
            message: msg,
            position: 'bottom-right'
          })
        }
      } finally {
        this.loading = false
      }
    },
    async handleRequestNewQrCode (channel, origem) {
      console.log('🔄 handleRequestNewQrCode called with:', { channel, origem })
      if (channel.type === 'telegram' && !channel.tokenTelegram) {
        this.$notificarErro('Necessário informar o token para Telegram')
        return
      }

      this.loading = true
      try {
        if (channel.status !== 'DISCONNECTED') {
          console.log('🗑️ Deleting existing session...')
          await DeleteWhatsappSession(channel.id)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        const qrCodeData = { id: channel.id, isQrcode: true, forceNewSession: true }
        console.log('📡 Requesting new QR code with data:', qrCodeData)
        await RequestNewQrCode(qrCodeData)

        // O QR code será recebido via WebSocket e automaticamente atualizado no store
        // Aguardar um tempo para o QR code ser gerado
        console.log('⏳ Waiting for QR code generation...')
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Buscar o canal atualizado do store (que foi atualizado via WebSocket)
        const updatedChannelFromStore = this.$store.state.whatsapp.whatsApps.find(w => w.id === channel.id)
        console.log('🔍 Updated channel from store:', updatedChannelFromStore)

        if (updatedChannelFromStore && updatedChannelFromStore.qrcode) {
          console.log('✅ QR code found in store, opening modal')
          // Se o modal já está aberto, apenas atualizar o canal selecionado
          if (this.abrirModalQR) {
            console.log('📱 Modal already open, updating channel')
            this.whatsappSelecionado = updatedChannelFromStore
          } else {
            console.log('🚀 Opening modal with updated channel')
            this.handleOpenQrModal(updatedChannelFromStore)
          }
        } else {
          console.log('⏳ QR code not found yet, waiting more...')
          // Aguardar mais um pouco e tentar novamente
          await new Promise(resolve => setTimeout(resolve, 2000))
          const finalChannel = this.$store.state.whatsapp.whatsApps.find(w => w.id === channel.id)
          console.log('🔍 Final channel check:', finalChannel)
          // Se o modal já está aberto, apenas atualizar o canal selecionado
          if (this.abrirModalQR) {
            console.log('📱 Modal already open, updating with final channel')
            this.whatsappSelecionado = finalChannel || channel
          } else {
            console.log('🚀 Opening modal with final channel')
            this.handleOpenQrModal(finalChannel || channel)
          }
        }
      } catch (error) {
        console.error('❌ Error in handleRequestNewQrCode:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao gerar novo QR code. Tente novamente em alguns segundos.',
          position: 'bottom-right'
        })
      } finally {
        this.loading = false
      }
    },
    async listarWhatsapps () {
      const { data } = await ListarWhatsapps()
      this.$store.commit('LOAD_WHATSAPPS', data)
    },
    async deleteWhatsapp (whatsapp) {
      this.$q.dialog({
        title: 'Atenção!! Deseja realmente deletar? ',
        message: 'Não é uma boa ideia apagar se já tiver gerado atendimentos para esse whatsapp.',
        cancel: {
          label: 'Não',
          color: 'primary',
          push: true
        },
        ok: {
          label: 'Sim',
          color: 'negative',
          push: true
        },
        persistent: true
      }).onOk(() => {
        this.loading = true
        DeletarWhatsapp(whatsapp.id).then(r => {
          this.$store.commit('DELETE_WHATSAPPS', whatsapp.id)
        }).finally(f => {
          this.loading = false
        })
      })
    },
    async listarChatFlow () {
      const { data } = await ListarChatFlow()
      this.listaChatFlow = data.chatFlow
    },
    async handleSaveWhatsApp (whatsapp) {
      try {
        await UpdateWhatsapp(whatsapp.id, whatsapp)
        this.$q.notify({
          type: 'positive',
          progress: true,
          position: 'bottom-right',
          message: `Whatsapp ${whatsapp.id ? 'editado' : 'criado'} com sucesso!`,
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
      } catch (error) {
        this.$q.notify({
          type: 'error',
          progress: true,
          position: 'bottom-right',
          message: 'Ops! Verifique os erros... O nome da conexão não pode existir na plataforma, é um identificador único.',
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
      }
    },
    async handleSessionError (error) {
      if (error.message && error.message.includes('conflict')) {
        try {
          await request.post(`/api/whatsappSession/${this.channel.id}/force-new`)
          this.$q.notify({
            type: 'info',
            message: 'Sessão anterior removida. Tentando nova conexão...'
          })
          await this.loadSession()
        } catch (err) {
          this.$q.notify({
            type: 'negative',
            message: 'Erro ao forçar nova sessão: ' + err.message
          })
        }
      } else {
        this.$q.notify({
          type: 'negative',
          message: 'Erro na sessão: ' + error.message
        })
      }
    },
    async loadSession () {
      try {
        const { data } = await request({
          url: `/api/whatsappSession/${this.channel.id}`,
          method: 'get'
        })
        this.channel = data
        if (data.status === 'CONNECTED') {
          this.abrirModalQR = false
        } else if (data.status === 'OPENING') {
          this.abrirModalQR = true
        }
      } catch (error) {
        await this.handleSessionError(error)
      }
    },
    async handleWhatsAppSession () {
      try {
        await StartWhatsappSession(this.whatsapp.id)
        this.$q.notify({
          type: 'positive',
          message: 'Sessão iniciada com sucesso!'
        })
        await this.loadWhatsapps()
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao iniciar sessão!'
        })
      }
    },
    async handleWhatsAppSessionDelete () {
      try {
        await DeleteWhatsappSession(this.whatsapp.id)
        this.$q.notify({
          position: 'bottom-right',
          icon: 'mdi-wifi-arrow-up-down',
          message: 'Sessão do WhatsApp encerrada com sucesso!',
          type: 'positive',
          color: 'primary',
          html: true,
          progress: true,
          timeout: 7000,
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }],
          classes: 'text-body2 text-weight-medium'
        })
      } catch (error) {
        this.$notificarErro('Não foi possível encerrar a sessão', error)
      }
    },
    async handleConnectByNumber ({ channel, number }) {
      this.loading = true
      try {
        await request({
          url: `/api/whatsappsession/${channel.id}/connect-by-number`,
          method: 'post',
          data: { number }
        })
        this.$q.notify({
          type: 'positive',
          message: 'Iniciando conexão via número...'
        })
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao conectar via número.'
        })
      } finally {
        this.loading = false
      }
    }
  },
  mounted () {
    this.isAdmin = localStorage.getItem('profile')
    this.listarWhatsapps()
    this.listarChatFlow()
  }
}
</script>

<style lang="scss" scoped>
</style>
