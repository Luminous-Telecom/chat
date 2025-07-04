<template>
  <q-dialog
    persistent
    :model-value="modalFilaUsuario"
    @hide="fecharModal"
    @show="abrirModal"
    class="modal-modern"
  >
    <q-card style="width: 400px">
      <q-card-section class="modal-header">
        <div class="text-h6">Departamentos do Usuário</div>
        <div class="text-subtitle2">Nome: {{ usuarioSelecionado.name }}</div>
        <div class="text-subtitle2">Email: {{ usuarioSelecionado.email }}</div>
      </q-card-section>
      <q-card-section class="modal-content">
        <template v-for="fila in filas" :key="fila.id">
          <div
            class="row col"
          >
            <q-checkbox
              :disable="!fila.isActive"
              v-model="filasUsuario"
              :label="`${fila.queue} ${!fila.isActive ? '(Inativo)' : ''}`"
              :val="fila.id"
            />
          </div>
        </template>
      </q-card-section>
      <q-card-actions align="right" class="modal-actions">
        <q-btn
          label="Cancelar"
          class="q-px-md q-mr-sm"
          color="negative"
          rounded
          v-close-popup
        />
        <q-btn
          label="Salvar"
          class="q-px-md"
          color="primary"
          rounded
          @click="handleFilaUsuario"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { UpdateUsuarios } from 'src/service/user'
export default {
  name: 'ModalFilaUsuario',
  props: {
    modalFilaUsuario: {
      type: Boolean,
      default: false
    },
    usuarioSelecionado: {
      type: Object,
      default: () => { return { id: null } }
    },
    filas: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      filasUsuario: []
    }
  },
  methods: {
    abrirModal () {
      if (this.usuarioSelecionado.id) {
        this.filasUsuario = [...this.usuarioSelecionado.queues.map(f => f.id)]
      }
    },
    fecharModal () {
      this.$emit('update:usuarioSelecionado', {})
      this.$emit('update:modalFilaUsuario', false)
    },
    async handleFilaUsuario () {
      const req = {
        ...this.usuarioSelecionado,
        queues: [...this.filasUsuario]
      }
      const { data } = await UpdateUsuarios(req.id, req)
      this.$emit('modalFilaUsuario:sucesso', data)
      this.$q.notify({
        type: 'positive',
        progress: true,
        position: 'bottom-right',
        message: 'Filas do usuário editadas com sucesso!',
        actions: [{
          icon: 'close',
          round: true,
          color: 'white'
        }]
      })
      this.fecharModal()
    }
  }

}
</script>

<style lang="scss" scoped>
</style>
