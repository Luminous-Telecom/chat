<template>
  <div>
    <q-table
      flat
      square
      hide-bottom
      class="my-sticky-dynamic q-ma-lg"
      title="Campanhas"
      :data="campanhas"
      :columns="columns"
      :loading="loading"
      row-key="id"
      :pagination.sync="pagination"
      :rows-per-page-options="[0]"
    >
      <template v-slot:top-right>
        <q-btn
          class="q-mr-md"
          color="black"
          icon="refresh"
          rounded
          @click="listarCampanhas"
        >
          <q-tooltip>
            Atualizar Listagem
          </q-tooltip>
        </q-btn>
        <q-btn
          rounded
          color="primary"
          label="Adicionar"
          @click="campanhaEdicao = {}; modalCampanha = true"
        />
      </template>
      <template v-slot:body-cell-color="props">
        <q-td class="text-center">
          <div
            class="q-pa-sm rounded-borders"
            :style="`background: ${props.row.color}`"
          >
            {{ props.row.color }}
          </div>
        </q-td>
      </template>
      <template v-slot:body-cell-isActive="props">
        <q-td class="text-center">
          <q-icon
            size="24px"
            :name="props.value ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline'"
            :color="props.value ? 'positive' : 'negative'"
          />
        </q-td>
      </template>
      <template v-slot:body-cell-businessHoursOnly="props">
        <q-td class="text-center">
          <q-chip
            v-if="props.row.businessHoursOnly"
            color="primary"
            text-color="white"
            size="sm"
            icon="mdi-clock-outline"
          >
            Sim
          </q-chip>
          <q-chip
            v-else
            color="grey-4"
            text-color="dark"
            size="sm"
            icon="mdi-clock-off-outline"
          >
            Não
          </q-chip>
        </q-td>
      </template>

      <template v-slot:body-cell-acoes="props">
        <q-td class="text-center">
          <q-btn
            flat
            round
            icon="mdi-account-details-outline"
            @click="contatosCampanha(props.row)"
          >
            <q-tooltip>
              Lista de Contatos da Campanha
            </q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            v-if="['pending', 'canceled'].includes(props.row.status)"
            icon="mdi-calendar-clock"
            @click="iniciarCampanha(props.row)"
          >
            <q-tooltip>
              Programar Envio
            </q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            v-if="['scheduled', 'processing'].includes(props.row.status)"
            icon="mdi-close-box-multiple"
            @click="cancelarCampanha(props.row)"
          >
            <q-tooltip>
              Cancelar Campanha
            </q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            icon="edit"
            @click="editarCampanha(props.row)"
          >
            <q-tooltip>
              Editar Campanha
            </q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            icon="mdi-delete"
            @click="deletarCampanha(props.row)"
          >
            <q-tooltip>
              Excluir Campanha
            </q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>
    <ModalCampanha
      v-if="modalCampanha"
      :modalCampanha.sync="modalCampanha"
      :campanhaEdicao.sync="campanhaEdicao"
      @modal-campanha:criada="campanhaCriada"
      @modal-campanha:editada="campanhaEditada"
    />
  </div>
</template>

<script>
import { CancelarCampanha, DeletarCampanha, IniciarCampanha, ListarCampanhas } from 'src/service/campanhas'
import ModalCampanha from './ModalCampanha'
import { format, parseISO, startOfDay } from 'date-fns'

export default {
  name: 'Campanhas',
  components: {
    ModalCampanha
  },
  data () {
    return {
      campanhaEdicao: {},
      modalCampanha: false,
      campanhas: [],
      pagination: {
        rowsPerPage: 40,
        rowsNumber: 0,
        lastIndex: 0
      },
      loading: false,
      updateTimeouts: {}, // Para controlar debounce das atualizações
      columns: [
        { name: 'id', label: '#', field: 'id', align: 'left' },
        { name: 'name', label: 'Campanha', field: 'name', align: 'left' },
        { name: 'start', label: 'Início', field: 'start', align: 'center', format: (v) => format(parseISO(v), 'dd/MM/yyyy HH:mm') },
        {
          name: 'status',
          label: 'Status',
          field: 'status',
          align: 'center',
          format: (v) => v ? this.status[v] : ''
        },
        { name: 'businessHoursOnly', label: 'Horário Comercial', field: 'businessHoursOnly', align: 'center' },
        { name: 'contactsCount', label: 'Qtd. Contatos', field: 'contactsCount', align: 'center' },
        { name: 'pendentesEnvio', label: 'À Enviar', field: 'pendentesEnvio', align: 'center' },
        { name: 'pendentesEntrega', label: 'À Entregar', field: 'pendentesEntrega', align: 'center' },
        { name: 'recebidas', label: 'Recebidas', field: 'recebidas', align: 'center' },
        { name: 'lidas', label: 'Lidas', field: 'lidas', align: 'center' },
        { name: 'acoes', label: 'Ações', field: 'acoes', align: 'center' }
      ],
      status: {
        pending: 'Pendente',
        scheduled: 'Programada',
        processing: 'Processando',
        canceled: 'Cancelada',
        finished: 'Finalizada'
      }
    }
  },
  methods: {
    async listarCampanhas () {
      const { data } = await ListarCampanhas()
      this.campanhas = data
    },
    isValidDate (v) {
      return startOfDay(new Date(parseISO(v))).getTime() >= startOfDay(new Date()).getTime()
    },
    campanhaCriada (campanha) {
      this.listarCampanhas()
    },
    campanhaEditada (campanha) {
      this.listarCampanhas()
    },
    editarCampanha (campanha) {
      if (campanha.status !== 'pending' && campanha.status !== 'canceled') {
        this.$notificarErro('Só é permitido editar campanhas que estejam pendentes ou canceladas.')
      }
      this.campanhaEdicao = {
        ...campanha,
        start: campanha.start, // format(parseISO(campanha.start), 'yyyy-MM-dd'),
        end: campanha.start // format(parseISO(campanha.start), 'yyyy-MM-dd')
      }
      this.modalCampanha = true
    },
    deletarCampanha (campanha) {
      if (campanha.status !== 'pending' && campanha.status !== 'canceled' && campanha.contactsCount) {
        this.$notificarErro('Só é permitido deletar campanhas que estejam pendentes ou canceladas e não possuam contatos vinculados.')
      }
      this.$q.dialog({
        title: 'Atenção!!',
        message: `Deseja realmente deletar a Campanha "${campanha.tag}"?`,
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
        DeletarCampanha(campanha)
          .then(res => {
            let newCampanhas = [...this.campanhas]
            newCampanhas = newCampanhas.filter(f => f.id !== campanha.id)
            this.campanhas = [...newCampanhas]
            this.$notificarSucesso(`Campanha ${campanha.tag} deletada!`)
          })
        this.loading = false
      })
    },
    contatosCampanha (campanha) {
      this.$router.push({
        name: 'contatos-campanha',
        params: {
          campanhaId: campanha.id,
          campanha
        }
      })
    },
    cancelarCampanha (campanha) {
      this.$q.dialog({
        title: 'Atenção!!',
        message: `Deseja realmente deletar a Campanha "${campanha.name}"?`,
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
        CancelarCampanha(campanha.id)
          .then(res => {
            this.$notificarSucesso('Campanha cancelada.')
            this.listarCampanhas()
          }).catch(err => {
            this.$notificarErro('Não foi possível cancelar a campanha.', err)
          })
      })
    },
    iniciarCampanha (campanha) {
      if (!this.isValidDate(campanha.start)) {
        this.$notificarErro('Não é possível programar campanha com data menor que a atual')
      }

      if (campanha.contactsCount == 0) {
        this.$notificarErro('Necessário ter contatos vinculados para programar a campanha.')
      }

      if (campanha.status !== 'pending' && campanha.status !== 'canceled') {
        this.$notificarErro('Só é permitido programar campanhas que estejam pendentes ou canceladas.')
      }

      IniciarCampanha(campanha.id).then(res => {
        this.$notificarSucesso('Campanha iniciada.')
        this.listarCampanhas()
      }).catch(err => {
        this.$notificarErro('Não foi possível iniciar a campanha.', err)
      })
    },
    iniciarSocketCampanhas () {
      if (this.$socket) {
        // Ouvir eventos de atualização de ACK de campanhas
        this.$socket.on(`${this.$store.getters.tenantId}:campaignUpdate`, this.handleCampaignAckUpdate)
        console.log('🔌 Socket campaigns ACK listener started')
      }
    },
    pararSocketCampanhas () {
      if (this.$socket) {
        this.$socket.off(`${this.$store.getters.tenantId}:campaignUpdate`, this.handleCampaignAckUpdate)
        console.log('🔌 Socket campaigns ACK listener stopped')
      }
    },
    handleCampaignAckUpdate (data) {
      if (data.type === 'campaign:ack') {
        const payload = data.payload
        console.log('🎯 Campaign ACK Update:', payload)

        // Encontrar a campanha na lista
        const campaignIndex = this.campanhas.findIndex(c => c.id === payload.campaignId)
        if (campaignIndex !== -1) {
          // Com modelo simplificado, qualquer ACK update significa mudança no status do contato
          this.atualizarCampanhaEspecificaDebounced(payload.campaignId)
          console.log(`📊 Scheduled update for campaign ${payload.campaignId} due to ACK change to ${payload.ack} (${payload.messageRandom})`)
        }
      }
    },
    atualizarCampanhaEspecificaDebounced (campanhaId) {
      // Cancelar timeout anterior se existir
      if (this.updateTimeouts[campanhaId]) {
        clearTimeout(this.updateTimeouts[campanhaId])
      }

      // Agendar nova atualização com debounce de 1 segundo
      this.updateTimeouts[campanhaId] = setTimeout(() => {
        this.atualizarCampanhaEspecifica(campanhaId)
        delete this.updateTimeouts[campanhaId]
      }, 1000)
    },
    async atualizarCampanhaEspecifica (campanhaId) {
      try {
        // Buscar dados atualizados da campanha específica
        const { data } = await ListarCampanhas()
        const campanhaAtualizada = data.find(c => c.id === campanhaId)

        if (campanhaAtualizada) {
          const campanhaIndex = this.campanhas.findIndex(c => c.id === campanhaId)
          if (campanhaIndex !== -1) {
            // Atualizar apenas a campanha específica na lista
            this.$set(this.campanhas, campanhaIndex, campanhaAtualizada)

            // Verificar se a campanha foi finalizada
            const totalProcessado = campanhaAtualizada.pendentesEntrega + campanhaAtualizada.recebidas + campanhaAtualizada.lidas
            if (totalProcessado === campanhaAtualizada.contactsCount && campanhaAtualizada.status === 'processing') {
              console.log(`🎯 Campaign ${campanhaId} completed! Total processed: ${totalProcessado}/${campanhaAtualizada.contactsCount}`)
            }
          }
        }
      } catch (error) {
        console.error('Error updating specific campaign:', error)
      }
    }
  },
  mounted () {
    this.listarCampanhas()
    this.iniciarSocketCampanhas()
  },
  beforeDestroy () {
    this.pararSocketCampanhas()

    // Limpar todos os timeouts pendentes
    Object.values(this.updateTimeouts).forEach(timeout => {
      clearTimeout(timeout)
    })
    this.updateTimeouts = {}
  }
}

</script>

<style lang="scss" scoped>
</style>
