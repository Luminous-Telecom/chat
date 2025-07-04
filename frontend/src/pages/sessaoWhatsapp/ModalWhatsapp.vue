<template>
  <q-dialog
    v-model="modalVisible"
    @show="abrirModal"
    persistent
    class="modal-modern"
  >
    <q-card style="width: 500px">
      <q-card-section class="modal-header">
        <div class="text-h6">
          <q-icon
            size="50px"
            class="q-mr-md"
            :name="whatsapp.type ? `img:${whatsapp.type}-logo.png` : 'mdi-alert'"
          /> {{ whatsapp.id ? 'Editar' :
              'Adicionar'
            }}
          Canal
        </div>
      </q-card-section>
      <q-card-section class="modal-content">
        <div class="row">
          <div class="col-12 q-my-sm">
            <q-select
              :disable="!!whatsapp.id"
              v-model="whatsapp.type"
              :options="optionsWhatsappsTypes"
              label="Tipo"
              emit-value
              map-options
              outlined
              rounded
              dense
            />
          </div>
          <div class="col-12">
            <q-input
              outlined
              rounded
              label="Nome"
              dense
              v-model="whatsapp.name"
            />
          </div>

          <div
            class="col-12 q-mt-md"
            v-if="whatsapp.type === 'telegram'"
          >
            <q-input
              outlined
              dense
              label="Token Telegram"
              v-model="whatsapp.tokenTelegram"
            />
          </div>
          <div
            class="q-mt-md row full-width justify-center"
            v-if="whatsapp.type === 'instagram'"
          >
            <div class="col">
              <fieldset class="full-width q-pa-md rounded-all">
                <legend>Dados da conta do Instagram</legend>
                <div
                  class="col-12 q-mb-md"
                  v-if="whatsapp.type === 'instagram'"
                >
                  <q-input
                    outlined
                    dense
                    label="Usuário"
                    v-model="whatsapp.instagramUser"
                    hint="Seu usuário do Instagram (sem @)"
                  />
                </div>
                <div
                  v-if="whatsapp.type === 'instagram' && !isEdit"
                  class="text-center"
                >
                  <q-btn
                    color="positive"
                    icon="edit"
                    label="Nova senha"
                    @click="isEdit = !isEdit"
                  >
                    <q-tooltip>
                      Alterar senha
                    </q-tooltip>
                  </q-btn>
                </div>
                <div
                  class="col-12"
                  v-if="whatsapp.type === 'instagram' && isEdit"
                >
                  <q-input
                    outlined
                    rounded
                    label="Senha"
                    :type="isPwd ? 'password' : 'text'"
                    v-model="whatsapp.instagramKey"
                    hint="Senha utilizada para logar no Instagram"
                    placeholder="*************"
                    :disable="!isEdit"
                  >
                    <template v-slot:after>
                      <q-btn
                        class="bg-padrao"
                        round
                        flat
                        color="negative"
                        icon="mdi-close"
                        @click="isEdit = !isEdit"
                      >
                        <q-tooltip>
                          Cancelar alteração de senha
                        </q-tooltip>

                      </q-btn>
                    </template>
                    <template v-slot:append>
                      <q-icon
                        :name="isPwd ? 'visibility_off' : 'visibility'"
                        class="cursor-pointer"
                        @click="isPwd = !isPwd"
                      />
                    </template>
                  </q-input>
                </div>
              </fieldset>

            </div>
          </div>
        </div>

        <div class="row q-my-md">
          <div class="col-12 relative-position">
            <label class="text-caption">Mensagem Despedida:
            </label>
            <textarea
              ref="inputFarewellMessage"
              style="min-height: 15vh; max-height: 15vh;"
              class="q-pa-sm rounded-all bg-white full-width"
              placeholder="Digite a mensagem"
              autogrow
              dense
              outlined
              v-model="whatsapp.farewellMessage"
            >
            </textarea>
            <div class="absolute-top-right">
              <q-btn
                rounded
                dense
                color="black"
                style="margin-bottom: -40px; margin-right: -10px"
              >
                <q-icon
                  size="1.5em"
                  name="mdi-variable"
                />
                <q-tooltip>
                  Variáveis
                </q-tooltip>
                <q-menu touch-position>
                  <q-list
                    dense
                    style="min-width: 100px"
                  >
                    <q-item
                      v-for="variavel in variaveis"
                      :key="variavel.label"
                      clickable
                      @click="onInsertSelectVariable(variavel.value)"
                      v-close-popup
                    >
                      <q-item-section>{{ variavel.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </div>
        </div>
      </q-card-section>
      <q-card-actions
        align="center"
        class="q-mt-lg"
      >
        <q-btn
          rounded
          label="Sair"
          class="q-px-md q-mr-lg"
          color="negative"
          @click="fecharModal"
        />
        <q-btn
          label="Salvar"
          color="positive"
          rounded
          class="q-px-md"
          @click="handleSaveWhatsApp(whatsapp)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { UpdateWhatsapp, CriarWhatsapp } from 'src/service/sessoesWhatsapp'
import { copyToClipboard, Notify } from 'quasar'

export default {
  name: 'ModalWhatsapp',
  props: {
    modalWhatsapp: {
      type: Boolean,
      default: false
    },
    whatsAppId: {
      type: Number,
      default: null
    },
    whatsAppEdit: {
      type: Object,
      default: () => { }
    }
  },
  data () {
    return {
      isPwd: true,
      isEdit: false,
      whatsapp: {
        name: '',
        isDefault: false,
        tokenTelegram: '',
        instagramUser: '',
        instagramKey: '',
        tokenAPI: '',
        type: 'whatsapp',
        farewellMessage: ''
      },
      optionsWhatsappsTypes: [
        { label: 'Whatsapp', value: 'whatsapp' },
        { label: 'Telegram', value: 'telegram' },
        { label: 'Instagram', value: 'instagram' }
      ],
      variaveis: [
        { label: 'Nome', value: '{{name}}' },
        { label: 'Saudação', value: '{{greeting}}' },
        { label: 'Protocolo', value: '{{protocol}}' }
      ]
    }
  },
  computed: {
    modalVisible: {
      get () {
        return this.modalWhatsapp
      },
      set (value) {
        this.$emit('update:modalWhatsapp', value)
      }
    },
    cBaseUrlIntegração () {
      return this.whatsapp.UrlMessengerWebHook
    }
  },
  watch: {
  },
  methods: {
    copy (text) {
      copyToClipboard(text)
        .then(this.$notificarSucesso('URL de integração copiada!'))
        .catch()
    },

    onInsertSelectVariable (variable) {
      const self = this
      var tArea = this.$refs.inputFarewellMessage
      // get cursor's position:
      var startPos = tArea.selectionStart,
        endPos = tArea.selectionEnd,
        cursorPos = startPos,
        tmpStr = tArea.value
      // filter:
      if (!variable) {
        return
      }
      // insert:
      self.txtContent = this.whatsapp.farewellMessage
      self.txtContent = tmpStr.substring(0, startPos) + variable + tmpStr.substring(endPos, tmpStr.length)
      this.whatsapp.farewellMessage = self.txtContent
      // move cursor:
      setTimeout(() => {
        tArea.selectionStart = tArea.selectionEnd = cursorPos + 1
      }, 10)
    },

    fecharModal () {
      this.whatsapp = {
        name: '',
        isDefault: false,
        tokenTelegram: '',
        instagramUser: '',
        instagramKey: '',
        tokenAPI: '',
        type: 'whatsapp',
        farewellMessage: ''
      }
      this.isEdit = false
      this.$emit('update:whatsAppEdit', {})
      this.$emit('update:modalWhatsapp', false)
    },
    abrirModal () {
      if (this.whatsAppEdit.id) {
        this.whatsapp = { ...this.whatsAppEdit }
      }
    },
    async handleSaveWhatsApp (whatsapp) {
      // Validação básica do nome
      if (!whatsapp.name || whatsapp.name.length < 3) {
        return this.$q.notify({
          type: 'warning',
          progress: true,
          position: 'bottom-right',
          message: 'Ops! O nome deve ter pelo menos 3 caracteres.',
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
      }
      try {
        if (this.whatsAppEdit.id) {
          await UpdateWhatsapp(this.whatsAppEdit.id, whatsapp)
        } else {
          await CriarWhatsapp(whatsapp)
        }
        this.$q.notify({
          type: 'positive',
          progress: true,
          position: 'bottom-right',
          message: `Whatsapp ${this.whatsAppEdit.id ? 'editado' : 'criado'} com sucesso!`,
          actions: [{
            icon: 'close',
            round: true,
            color: 'white'
          }]
        })
        this.$emit('recarregar-lista')
        this.fecharModal()
      } catch (error) {
        console.error(error, error.data.error === 'ERR_NO_PERMISSION_CONNECTIONS_LIMIT')
        if (error.data.error === 'ERR_NO_PERMISSION_CONNECTIONS_LIMIT') {
          Notify.create({
            type: 'negative',
            message: 'Limite de conexões atingida.',
            caption: 'ERR_NO_PERMISSION_CONNECTIONS_LIMIT',
            position: 'bottom-right',
            progress: true
          })
        } else {
          console.error(error)
          return this.$q.notify({
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
      }
    }
  },
  destroyed () {
  }
}
</script>

<style lang="scss" scoped>
</style>
