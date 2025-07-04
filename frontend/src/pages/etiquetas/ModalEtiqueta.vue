<template>
  <q-dialog
    persistent
    :model-value="modalEtiqueta"
    @update:model-value="$emit('update:modalEtiqueta', $event)"
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
        <div class="q-my-md">
          <q-input
            rounded
            outlined
            dense
            hide-bottom-space
            v-model="etiqueta.color"
            label="Cor da Etiqueta"
            :rules="['anyColor']"
            :dark="false"
            class="color-input"
            style="color: #333 !important;"
          >
            <template v-slot:prepend>
              <div
                class="color-preview"
                :style="{ backgroundColor: etiqueta.color }"
              ></div>
            </template>
            <template v-slot:append>
              <q-icon
                name="colorize"
                class="cursor-pointer color-icon"
                color="grey-7"
              >
                <q-popup-proxy
                  transition-show="scale"
                  transition-hide="scale"
                >
                  <q-color
                    v-model="etiqueta.color"
                    square
                    default-view="palette"
                    no-header
                    bordered
                  />
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>
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

<style lang="scss">
.color-input .q-field__control,
.color-input .q-field__native,
.color-input .q-field__input,
.color-input .q-field__prefix,
.color-input .q-field__suffix,
.color-input input {
  color: #333 !important;
}
.color-input .q-field__label {
  color: #666 !important;
}

.body--dark .color-input .q-field__control,
.body--dark .color-input .q-field__native,
.body--dark .color-input .q-field__input,
.body--dark .color-input .q-field__prefix,
.body--dark .color-input .q-field__suffix,
.body--dark .color-input input {
  color: #fff !important;
}
.body--dark .color-input .q-field__label {
  color: #bbb !important;
}

.color-preview {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #ccc;
  margin-right: 8px;
}

.color-icon {
  color: #666 !important;
}
</style>
