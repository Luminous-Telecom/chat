<template>
  <q-dialog
    persistent
    :value="modalEtiqueta"
    @hide="fecharModal"
    @show="abrirModal"
    class="modal-modern"
  >
    <q-card style="width: 500px">
      <q-card-section class="modal-header">
        <div class="text-h6">{{ etiquetaEdicao.id ? 'Editar': 'Criar' }} Etiqueta</div>
      </q-card-section>
      <q-card-section class="modal-content">
        <q-input
          class="row col"
          rounded
          dense
          outlined
          v-model="etiqueta.tag"
          label="Nome da Etiqueta"
        />
        <q-input
          rounded
          outlined
          dense
          hide-bottom-space
          :style="`background: ${etiqueta.color}; border-radius: 20px `"
          v-model="etiqueta.color"
          :rules="['anyColor']"
          class="q-my-md"
          :dark="false"
        >
          <template v-slot:preappend>
          </template>
          <template v-slot:append>
            <q-icon
              name="colorize"
              class="cursor-pointer"
            >
              <q-popup-proxy
                transition-show="scale"
                transition-hide="scale"
              >
                <q-color
                  format-model="hex"
                  square
                  default-view="palette"
                  no-header
                  bordered
                  v-model="etiqueta.color"
                />
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
        <q-checkbox
          v-model="etiqueta.isActive"
          label="Ativo"
        />
      </q-card-section>
      <q-card-actions
        align="right"
        class="modal-actions"
      >
        <q-btn
          rounded
          label="Cancelar"
          color="negative"
          v-close-popup
          class="q-mr-md"
        />
        <q-btn
          rounded
          label="Salvar"
          color="primary"
          @click="handleEtiqueta"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

</template>

<script>
import { CriarEtiqueta, AlterarEtiqueta } from 'src/service/etiquetas'
export default {
  name: 'ModalEtiqueta',
  props: {
    modalEtiqueta: {
      type: Boolean,
      default: false
    },
    etiquetaEdicao: {
      type: Object,
      default: () => {
        return { id: null }
      }
    }
  },
  data () {
    return {
      etiqueta: {
        id: null,
        tag: null,
        color: '#ffffff',
        isActive: true
      }
    }
  },
  methods: {
    resetarEtiqueta () {
      this.etiqueta = {
        id: null,
        tag: null,
        color: '#ffffff',
        isActive: true
      }
    },
    fecharModal () {
      this.resetarEtiqueta()
      this.$emit('update:etiquetaEdicao', { id: null })
      this.$emit('update:modalEtiqueta', false)
    },
    abrirModal () {
      if (this.etiquetaEdicao.id) {
        this.etiqueta = { ...this.etiquetaEdicao }
      } else {
        this.resetarEtiqueta()
      }
    },
    async handleEtiqueta () {
      try {
        this.loading = true
        if (this.etiqueta.id) {
          const { data } = await AlterarEtiqueta(this.etiqueta)
          this.$emit('modal-etiqueta:editada', data)
          this.$q.notify({
            type: 'info',
            progress: true,
            position: 'bottom-right',
            textColor: 'black',
            message: 'Etiqueta editada!',
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
        } else {
          const { data } = await CriarEtiqueta(this.etiqueta)
          this.$emit('modal-etiqueta:criada', data)
          this.$q.notify({
            type: 'positive',
            progress: true,
            position: 'bottom-right',
            message: 'Etiqueta criada!',
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
        }
        this.loading = false
        this.fecharModal()
      } catch (error) {
        console.error(error)
        this.$notificarErro('Ocorreu um erro ao criar a etiqueta', error)
      }
    }
  }

}
</script>

<style lang="scss" scoped>
</style>
