<template>
  <q-dialog :value="value" @input="$emit('update:value', $event)" persistent transition-show="scale" transition-hide="scale" class="modal-modern">
    <q-card style="width: 500px; max-width: 90vw;">
      <q-card-section class="modal-header">
        <div class="text-h6">Nova Observação</div>
      </q-card-section>

      <q-card-section class="modal-content">
        <q-input
          v-model="observacao"
          type="textarea"
          label="Observação"
          :rules="[val => !!val || 'Campo obrigatório']"
          autogrow
        />
        <q-file
          v-model="anexo"
          label="Anexo"
          clearable
          class="q-mt-md"
        >
          <template v-slot:prepend>
            <q-icon name="attach_file" />
          </template>
        </q-file>
      </q-card-section>

      <q-card-actions align="right" class="modal-actions">
        <q-btn rounded label="Cancelar" color="negative" v-close-popup />
        <q-btn
          rounded
          label="Salvar"
          color="primary"
          :loading="loading"
          :disable="!observacao || !ticketId"
          @click="salvarObservacao"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { CriarObservacao } from '../../service/observacoes'

export default {
  name: 'ModalObservacao',
  props: {
    value: {
      type: Boolean,
      required: true
    },
    ticketId: {
      type: Number,
      required: false,
      default: null
    }
  },
  data () {
    return {
      observacao: '',
      anexo: null,
      loading: false
    }
  },
  watch: {
    value (newVal) {
      if (newVal) {
      }
    }
  },
  methods: {
    async salvarObservacao () {
      if (!this.observacao || !this.ticketId) {
        return
      }

      try {
        this.loading = true

        const data = await CriarObservacao(this.ticketId, {
          texto: this.observacao,
          anexo: this.anexo
        })

        this.$emit('observacao-salva', data)
        this.$q.notify({
          type: 'positive',
          message: 'Observação salva com sucesso!',
          position: 'bottom-right'
        })
        this.observacao = ''
        this.anexo = null
        this.$emit('update:value', false)
      } catch (err) {
        console.error('ModalObservacao - Erro ao salvar:', err)
        this.$q.notify({
          type: 'negative',
          message: err.response?.data?.error || 'Erro ao salvar observação',
          position: 'bottom-right'
        })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
</style>
