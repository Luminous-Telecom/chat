<template>
  <q-dialog
    :value="modalChatFlow"
    @hide="fecharModal"
    @show="abrirModal"
    persistent
    class="modal-modern"
  >
    <q-card style="width: 500px">
      <q-card-section class="modal-header">
        <div class="text-h6">{{ chatFlow.isDuplicate ? 'Duplicar' : chatFlowEdicao.id ? 'Editar': 'Criar' }} Fluxo</div>
        <div v-if="chatFlow.isDuplicate" class="text-subtitle2">Nome: {{ chatFlowEdicao.name }}</div>
      </q-card-section>
      <q-card-section class="modal-content">
        <q-input
          class="row col"
          outlined
          rounded
          dense
          v-model="chatFlow.name"
          label="Descrição"
        />
        <div class="row col q-mt-md">
          <q-input
            clearable
            class="full-width"
            rounded
            dense
            outlined
            v-model="chatFlow.celularTeste"
            label="Número para Teste"
            hint="Deixe limpo para que a Auto resposta funcione. Caso contrário, irá funcionar somente para o número informado aqui."
          />
        </div>
        <div class="row col q-mt-md">
          <q-checkbox
            v-model="chatFlow.isActive"
            label="Ativo"
          />
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
          label="Salvar"
          color="primary"
          @click="handleAutoresposta"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

</template>

<script>
const userId = +localStorage.getItem('userId')
import { CriarChatFlow, UpdateChatFlow } from 'src/service/chatFlow'
import { getDefaultFlow } from 'src/components/ccFlowBuilder/defaultFlow'

export default {
  name: 'ModalNovoChatFlow',
  props: {
    modalChatFlow: {
      type: Boolean,
      default: false
    },
    chatFlowEdicao: {
      type: Object,
      default: () => {
        return { id: null }
      }
    }
  },
  data () {
    return {
      chatFlow: {
        name: null,
        userId,
        celularTeste: null,
        isActive: true
      }
      // options: [
      //   { value: 0, label: 'Entrada (Criação do Ticket)' },
      //   { value: 1, label: 'Encerramento (Resolução Ticket)' }
      // ]
    }
  },
  methods: {
    abrirModal () {
      if (this.chatFlowEdicao.id) {
        this.chatFlow = {
          ...this.chatFlowEdicao,
          userId
        }
      } else {
        this.chatFlow = {
          name: null,
          action: 0,
          userId,
          celularTeste: null,
          isActive: true
        }
      }
    },
    fecharModal () {
      this.chatFlow = {
        name: null,
        action: 0,
        userId,
        celularTeste: null,
        isActive: true
      }
      this.$emit('update:chatFlowEdicao', { id: null })
      this.$emit('update:modalChatFlow', false)
    },
    async handleAutoresposta () {
      if (this.chatFlow.id && !this.chatFlow?.isDuplicate) {
        const { data } = await UpdateChatFlow(this.chatFlow)
        this.$notificarSucesso('Fluxo editado.')
        this.$emit('chatFlow:editado', data)
      } else {
        // setar id = null para rotina de duplicação de fluxo
        const defaultFlow = getDefaultFlow()
        // Extrair defaultQueueId das configurações do fluxo
        const configNode = defaultFlow.flow.nodeList.find(node => node.type === 'configurations')
        const defaultQueueId = configNode?.configurations?.defaultQueueId || null

        const flow = { ...defaultFlow, ...this.chatFlow, id: null, defaultQueueId }
        const { data } = await CriarChatFlow(flow)
        this.$notificarSucesso('Novo fluxo criado.')
        this.$emit('chatFlow:criada', data)
      }
      this.fecharModal()
    }
  }
}
</script>

<style lang="scss" scoped>
</style>
