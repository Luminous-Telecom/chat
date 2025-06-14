<template>
  <q-dialog :value="value" @input="$emit('update:value', $event)" persistent>
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">Nova Observação</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
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

      <q-card-actions align="right" class="text-primary">
        <q-btn flat label="Cancelar" v-close-popup />
        <q-btn
          flat
          label="Salvar"
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
        console.log('ModalObservacao - Modal aberto, ticketId:', this.ticketId, 'tipo:', typeof this.ticketId)
      }
    }
  },
  methods: {
    async salvarObservacao () {
      console.log('ModalObservacao - Tentando salvar, ticketId:', this.ticketId, 'tipo:', typeof this.ticketId)
      if (!this.observacao || !this.ticketId) {
        console.log('ModalObservacao - Validação falhou:', { observacao: !!this.observacao, ticketId: !!this.ticketId })
        return
      }

      try {
        this.loading = true
        console.log('ModalObservacao - Dados para salvar:', {
          texto: this.observacao,
          anexo: this.anexo ? {
            name: this.anexo.name,
            type: this.anexo.type,
            size: this.anexo.size
          } : null
        })

        const data = await CriarObservacao(this.ticketId, {
          texto: this.observacao,
          anexo: this.anexo
        })

        console.log('ModalObservacao - Observação salva com sucesso:', data)
        this.$emit('observacao-salva', data)
        this.$q.notify({
          type: 'positive',
          message: 'Observação salva com sucesso!',
          position: 'top'
        })
        this.observacao = ''
        this.anexo = null
        this.$emit('update:value', false)
      } catch (err) {
        console.error('ModalObservacao - Erro ao salvar:', err)
        this.$q.notify({
          type: 'negative',
          message: err.response?.data?.error || 'Erro ao salvar observação',
          position: 'top'
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
