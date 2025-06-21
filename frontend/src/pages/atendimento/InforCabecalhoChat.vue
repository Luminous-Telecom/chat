<template>
  <div>
    <q-header class="bg-white text-grey-10 no-border-radius" style="box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
      <q-toolbar
        style="min-height: 50px; height: 50px;"
        class="no-border-radius q-pa-none"
      >
        <q-btn
          flat
          dense
          round
          icon="mdi-menu"
          v-if="$q.screen.lt.md"
          class="q-mx-xs-none q-ml-sm"
          :color="$q.dark.isActive ? 'white' : 'grey-8'"
          size="sm"
          @click="$root.$emit('infor-cabecalo-chat:acao-menu')"
        />
        <q-item
          clickable
          v-ripple
          class="q-ma-none q-pa-none full"
          style="min-height: 50px; height: 50px; width: 250px;"
          @click="$root.$emit('update-ticket:info-contato')"
        >
          <q-item-section
            avatar
            class="q-pl-xs"
          >
            <q-btn
              round
              flat
              dense
              class="q-mr-xs"
            >
              <q-avatar
                size="32px"
                class="bg-grey-2"
                style="border: 1px solid #e0e0e0;"
                :class="{ 'dark-avatar-border': $q.dark.isActive }"
              >
                <q-img
                  :src="Value(cticket.contact, 'profilePicUrl')"
                  style="width: 32px; height: 32px"
                >
                  <template v-slot:error>
                    <q-icon name="mdi-account" size="20px" color="grey-5" />
                  </template>
                </q-img>
              </q-avatar>
            </q-btn>
          </q-item-section>
          <q-item-section id="InfoCabecalhoChat" class="q-py-none">
            <q-item-label class="text-caption text-weight-medium text-grey-9 text-truncate" style="max-width: 180px">
              {{ Value(cticket.contact, 'name') }}
              <q-skeleton
                v-if="!Value(cticket.contact, 'name')"
                animation="none"
                style="width: 180px"
              />
            </q-item-label>
            <q-item-label
              caption
              lines="1"
              class="text-caption text-grey-7 text-truncate"
              style="margin-top: 0px !important; font-size: 11px; max-width: 180px;"
            >
              <q-icon name="mdi-account-tie" size="xs" class="q-mr-xs" />
              <span v-if="Value(cticket.user, 'name')">Atribuído à: {{ Value(cticket.user, 'name') }}</span>
              <q-skeleton
                v-else
                type="text"
                class="text-caption"
                animation="none"
                style="width: 150px"
              />
            </q-item-label>
            <q-item-label
              lines="1"
              class="text-caption text-grey-6 text-truncate"
              style="margin-top: 0px !important; font-size: 10px; max-width: 180px;"
            >
              <q-icon name="mdi-ticket" size="xs" class="q-mr-xs" />
              <span
                v-if="Value(cticket.contact, 'name')"
              >#{{ cticket.id }}</span>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-space />
        <div
          class="q-gutter-xs q-pr-sm"
          v-if="Value(cticket.contact, 'name')"
        >
          <q-btn
            color="amber-6"
            no-caps
            rounded
            @click="$emit('updateTicket:reabrir')"
            icon="mdi-reload"
            label="Reabrir"
            v-if="cticket.status == 'closed'"
          />

        </div>
      </q-toolbar>
      <q-separator />
    </q-header>

    <q-dialog
      v-model="modalTransferirTicket"
      @hide="modalTransferirTicket = false"
      persistent
      class="modal-modern"
    >
      <q-card style="width: 500px">
        <q-card-section class="modal-header">
          <div class="text-h6">Transferir Ticket</div>
          <div class="text-subtitle2">Selecione o destino para o ticket #{{ cticket.id }}</div>
        </q-card-section>
        <q-card-section class="modal-content">
          <div class="row q-gutter-sm">
            <div class="col-12">
              <q-select
                dense
                rounded
                outlined
                v-model="filaSelecionada"
                :options="opcoesFilas"
                emit-value
                map-options
                option-value="id"
                option-label="label"
                label="Departamento de destino"
                class="full-width"
                :loading="filas.length === 0"
                :rules="[val => !!val || 'Departamento é obrigatório']"
              />
            </div>
            <div class="col-12">
              <q-select
                rounded
                dense
                outlined
                v-model="usuarioSelecionado"
                :options="usuariosFiltrados"
                emit-value
                map-options
                option-value="id"
                option-label="name"
                label="Usuário destino"
                class="full-width"
                :loading="usuarios.length === 0"
              />
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right" class="modal-actions">
          <q-btn
            rounded
            label="Cancelar"
            color="negative"
            v-close-popup
            class="q-mr-md"
          />
          <q-btn
            rounded
            label="Transferir"
            color="primary"
            @click="confirmarTransferenciaTicket"
            :disable="!usuarioSelecionado || !filaSelecionada"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
const userId = +localStorage.getItem('userId')
import { mapGetters } from 'vuex'
import { ListarUsuarios } from 'src/service/user'
import { ListarFilas } from 'src/service/filas'
import { AtualizarTicket } from 'src/service/tickets'
export default {
  name: 'InfoCabecalhoMensagens',
  data () {
    return {
      modalTransferirTicket: false,
      usuarioSelecionado: null,
      filaSelecionada: null,
      usuarios: [],
      filas: [],
      usuariosFiltrados: []
    }
  },
  computed: {
    ...mapGetters([
      'ticketFocado'
    ]),
    cticket () {
      const infoDefault = {
        contact: { profilePicUrl: '', name: '' },
        user: { name: '' }
      }
      return Object.keys(this.ticketFocado).includes('contact') ? this.ticketFocado : infoDefault
    },
    opcoesFilas () {
      const opcoes = []

      if (this.filas && this.filas.length > 0) {
        this.filas.forEach(fila => {
          opcoes.push({
            id: fila.id,
            label: fila.queue || `Departamento ${fila.id}`
          })
        })
      }

      return opcoes
    }
  },
  methods: {
    Value (obj, prop) {
      try {
        return obj[prop]
      } catch (error) {
        return ''
      }
    },
    filterUsers (element, index, array) {
      const fila = this.filaSelecionada
      if (fila == null || fila === '') {
        return true
      }
      if (!element.queues || !Array.isArray(element.queues)) {
        return true
      }
      const queues_valid = element.queues.filter(function (queue, index, array) {
        return (queue.id == fila)
      })
      return queues_valid.length > 0
    },
    async listarFilas () {
      try {
        const { data } = await ListarFilas()
        this.filas = data
        await this.listarUsuarios()
        this.modalTransferirTicket = true
      } catch (error) {
        console.error('Erro ao carregar filas:', error)
        this.$notificarErro('Problema ao carregar filas', error)
      }
    },
    async listarUsuarios () {
      try {
        const { data } = await ListarUsuarios()
        this.usuarios = data.users
        this.usuariosFiltrados = this.usuarios.filter(this.filterUsers)
      } catch (error) {
        console.error('Erro ao carregar usuários:', error)
        this.$notificarErro('Problema ao carregar usuários', error)
      }
    },
    async confirmarTransferenciaTicket () {
      try {
        if (!this.usuarioSelecionado) {
          this.$q.notify({
            type: 'warning',
            message: 'Selecione um usuário de destino',
            progress: true,
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
          return
        }

        if (!this.filaSelecionada) {
          this.$q.notify({
            type: 'warning',
            message: 'Selecione um departamento de destino',
            progress: true,
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
          return
        }

        // Verificar se o ticket já pertence ao usuário selecionado
        if (this.ticketFocado.userId === this.usuarioSelecionado && this.ticketFocado.userId != null) {
          this.$q.notify({
            type: 'info',
            message: 'Ticket já pertence ao usuário selecionado.',
            progress: true,
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
          return
        }

        // Verificar se o ticket já pertence ao usuário atual
        if (this.ticketFocado.userId === userId && userId === this.usuarioSelecionado) {
          this.$q.notify({
            type: 'info',
            message: 'Ticket já pertence ao seu usuário',
            progress: true,
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
          return
        }

        // Verificar se o ticket já está no mesmo departamento e usuário
        if (this.ticketFocado.queueId === this.filaSelecionada && this.ticketFocado.userId === this.usuarioSelecionado) {
          this.$q.notify({
            type: 'info',
            message: 'Ticket já pertence a este departamento e usuário',
            progress: true,
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
          return
        }

        // Preparar dados para transferência
        const dadosTransferencia = {
          userId: this.usuarioSelecionado,
          status: 'open',
          isTransference: 1,
          queueId: this.filaSelecionada
        }

        // Realizar a transferência
        await AtualizarTicket(this.ticketFocado.id, dadosTransferencia)

        this.$q.notify({
          type: 'positive',
          message: 'Ticket transferido com sucesso!',
          progress: true,
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })

        // Limpar o modal e resetar os dados
        this.modalTransferirTicket = false
        this.usuarioSelecionado = null
        this.filaSelecionada = null

        // Limpar o ticket focado para forçar atualização
        this.$store.commit('TICKET_FOCADO', {})

        // Emitir evento para atualizar a lista de tickets
        this.$root.$emit('ticket:transferido')
      } catch (error) {
        console.error('Erro ao transferir ticket:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao transferir ticket. Tente novamente.',
          progress: true,
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
      }
    },
    abrirModalTransferirTicket () {
      this.listarFilas()
    }
  },
  watch: {
    filaSelecionada: {
      handler (newVal) {
        this.usuariosFiltrados = this.usuarios.filter(this.filterUsers)
      },
      immediate: true
    }
  },
  async mounted () {
    this.$root.$on('infor-cabecalo-chat:transferir-ticket', () => {
      this.abrirModalTransferirTicket()
    })
  },
  beforeDestroy () {
    this.$root.$off('infor-cabecalo-chat:transferir-ticket')
  }
}
</script>

<style lang="sass" scoped>
#InfoCabecalhoChat
  .q-item__label + .q-item__label
    margin-top: 1.5px

.dark-avatar-border
  border: 1px solid $dark-border !important
</style>
