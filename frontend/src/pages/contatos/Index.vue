<template>
  <div>
    <q-table
      class="my-sticky-dynamic"
      title="Contatos"
      :id="`tabela-contatos-${isChatContact ? 'atendimento' : ''}`"
      :rows="contacts"
      :columns="columns"
      :loading="loading"
      row-key="id"
      virtual-scroll
      :virtual-scroll-item-size="48"
      :virtual-scroll-sticky-size-start="48"
      v-model:pagination="pagination"
      :rows-per-page-options="[0]"
      @virtual-scroll="onScroll"
      :bordered="isChatContact"
      :square="isChatContact"
      :flat="isChatContact"
      :separator="isChatContact ? 'vertical' : 'horizontal'"
      :class="{
        'q-ma-lg': !isChatContact,
        'q-ml-md heightChat': isChatContact
      }"
    >
      <template v-slot:top>
        <div class="row col-2 q-table__title items-center ">
          <q-btn
            v-if="isChatContact"
            class="q-mr-sm"
            color="black"
            round
            flat
            icon="mdi-close"
            @click="$router.push({ name: 'chat-empty' })"
          />
          Contatos
        </div>
        <q-space />
        <ModernSearch
          :class="{
          'order-last q-mt-md': $q.screen.width < 500
        }"
          v-model="filter"
          placeholder="Localizar contatos..."
          :debounce="500"
          @search="filtrarContato"
        />
        <q-space />
        <q-btn-dropdown
          color="primary"
          label="Adicionar"
          rounded
          split
          class="glossy"
          @click="selectedContactId = null; modalContato = true"
        >
          <q-list separator>
            <q-item
              clickable
              v-close-popup
              @click="modalImportarContatos = true"
            >
              <q-item-section>
                <q-item-label>Importar .CSV</q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              clickable
              v-close-popup
              @click="handleExportContacts"
            >
              <q-item-section>
                <q-item-label>Exportar</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </template>
      <template v-slot:body-cell-profilePicUrl="props">
        <q-td>
          <q-avatar style="border: 1px solid #e0e0e0 !important; background: #f3f4f6 !important; color: #424242 !important; border-radius: 50% !important;" size="40px" rounded>
            <q-icon
              name="mdi-account"
              size="1.5em"
              color="grey-6"
              v-if="!props.value"
            />
            <q-img
              :src="props.value"
              style="max-width: 150px; border-radius: 50%;"
            >
              <template v-slot:error>
                <q-icon
                  name="mdi-account"
                  size="1.5em"
                  color="grey-6"
                />
              </template>
            </q-img>
          </q-avatar>
        </q-td>
      </template>
      <template v-slot:body-cell-acoes="props">
        <q-td class="text-center">
          <q-btn
            flat
            round
            icon="img:whatsapp-logo.png"
            @click="handleSaveTicket(props.row, 'whatsapp')"
            v-if="props.row.number"
          />
          <q-btn
            flat
            round
            icon="img:instagram-logo.png"
            @click="handleSaveTicket(props.row, 'instagram')"
            v-if="props.row.instagramPK"
          />
          <q-btn
            flat
            round
            icon="img:telegram-logo.png"
            @click="handleSaveTicket(props.row, 'telegram')"
            v-if="props.row.telegramId"
          />
          <q-btn
            flat
            round
            icon="edit"
            @click="editContact(props.row.id)"
          />
          <q-btn
            flat
            round
            icon="mdi-delete"
            @click="deleteContact(props.row.id)"
          />
        </q-td>
      </template>
      <template v-slot:pagination="{ pagination }">
        {{ contacts.length }}/{{ pagination.rowsNumber }}
      </template>
    </q-table>
    <ContatoModal
      :contactId="selectedContactId"
      v-model:modalContato="modalContato"
      @contatoModal:contato-editado="UPDATE_CONTACTS"
      @contatoModal:contato-criado="UPDATE_CONTACTS"
    />

    <q-dialog
      v-model="modalImportarContatos"
      persistent
      position="top"
      @show="abrirEnvioArquivo"
    >
      <q-card style="width: 400px;">
        <q-card-section class="row items-center">
          <div class="text-h6">Selecione o arquivo</div>
        </q-card-section>
        <q-card-section>
          <q-file
            ref="PickerFileMessage"
            id="PickerFileMessage"
            outlined
            dense
            rounded
            use-chips
            accept=".csv"
            v-model="file"
            label="Arquivo de contatos"
            hint="Colunas: Nome; Numero"
          >
            <template v-slot:prepend>
              <q-icon name="cloud_upload" />
            </template>
          </q-file>

        </q-card-section>
        <q-card-section class="row q-gutter-sm">
          <div class="col-12">
            <q-select
              class="full-width"
              outlined
              dense
              rounded
              v-model="tags"
              multiple
              label="Etiquetas"
              :options="etiquetas"
              use-chips
              option-value="id"
              option-label="tag"
              emit-value
              map-options
            >
              <template v-slot:option="{ itemProps, itemEvents, opt, selected, toggleOption }">
                <q-item
                  v-bind="itemProps"
                  v-on="itemEvents"
                >
                  <q-item-section>
                    <q-item-label v-html="opt.tag"></q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-checkbox
                      :value="selected"
                      @input="toggleOption(opt)"
                    />
                  </q-item-section>
                </q-item>
              </template>
              <template v-slot:selected-item="{ opt }">
                <q-chip
                  dense
                  square
                  color="white"
                  text-color="primary"
                  class="q-ma-xs row col-12 text-body1"
                >
                  <q-icon
                    :style="`color: ${opt.color}`"
                    name="mdi-pound-box-outline"
                    size="28px"
                    class="q-mr-sm"
                  />
                  {{ opt.tag }}
                </q-chip>
              </template>
              <template v-slot:no-option="{ itemProps, itemEvents }">
                <q-item
                  v-bind="itemProps"
                  v-on="itemEvents"
                >
                  <q-item-section>
                    <q-item-label class="text-negative text-bold">
                      Ops... Sem etiquetas criadas!
                    </q-item-label>
                    <q-item-label caption>
                      Cadastre novas etiquetas na administração de sistemas.
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </template>

            </q-select>
          </div>
          <div class="col-12">


          </div>

        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            class="q-ml-md"
            color="negative"
            label="Cancelar"
            v-close-popup
            rounded
            @click="isImportCSV = false; modalImportarContatos = false"
          />

          <q-btn
            class="q-ml-md"
            color="positive"
            label="Confirmar"
            rounded
            @click="handleImportCSV"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
const userId = +localStorage.getItem('userId')
import { CriarTicket } from 'src/service/tickets'
import { ListarContatos, ImportarArquivoContato, DeletarContato, ExportarArquivoContato } from 'src/service/contatos'
import ContatoModal from './ContatoModal'
import { ListarUsuarios } from 'src/service/user'
import { ListarEtiquetas } from 'src/service/etiquetas'
import { mapGetters } from 'vuex'
import ModernSearch from 'src/components/ModernSearch'

export default {
  name: 'IndexContatos',
  components: { ContatoModal, ModernSearch },
  userProfile: 'user',
  usuario: {},
  props: {
    isChatContact: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    ...mapGetters(['whatsapps'])
  },
  data () {
    return {
      contacts: [],
      modalImportarContatos: false,
      modalContato: false,
      file: [],
      isImportCSV: false,
      filter: null,
      selectedContactId: null,
      params: {
        pageNumber: 1,
        searchParam: null,
        hasMore: true
      },

      tags: [],
      etiquetas: [],
      usuarios: [],
      pagination: {
        rowsPerPage: 100,
        rowsNumber: 0,
        lastIndex: 0
      },
      loading: false,
      columns: [
        { name: 'profilePicUrl', label: '', field: 'profilePicUrl', style: 'width: 50px', align: 'center' },
        {
          name: 'name',
          label: 'Nome',
          field: 'name',
          align: 'left',
          style: 'width: 300px',
          format: (v, r) => {
            if (r.number && r.name == r.number && r.pushname) {
              return r.pushname
            }
            return r.name
          }
        },
        { name: 'number', label: 'WhatsApp', field: 'number', align: 'center', style: 'width: 300px' },
        {
          name: 'instagramPK',
          label: 'Instagram',
          field: 'instagramPK',
          align: 'center',
          style: 'width: 300px',
          format: (v, r) => {
            return r.instagramPK ? r.pushname : ''
          }
        },
        {
          name: 'telegramId',
          label: 'Id Telegram',
          field: 'telegramId',
          align: 'center',
          style: 'width: 300px',
          format: (v, r) => {
            return r.telegramId ? r.pushname : ''
          }
        },
        { name: 'email', label: 'Email', field: 'email', style: 'width: 500px', align: 'left' },
        { name: 'acoes', label: 'Ações', field: 'acoes', align: 'center' }
      ]
    }
  },
  methods: {
    abrirEnvioArquivo (event) {
      this.isImportCSV = true
      this.$refs.PickerFileMessage.pickFiles(event)
    },
    async handleImportCSV () {
      try {
        this.$q.notify({
          type: 'warning',
          message: 'Isso pode demorar um pouco.',
          caption: 'Após finalizar, a página será atualizada.',
          position: 'bottom-right'
        })
        const formData = new FormData()
        formData.append('file', this.file)
        if (this.tags.length > 0) {
          formData.append('tags', this.tags)
        }

        await ImportarArquivoContato(formData)
        this.$notificarSucesso('Contatos importados com sucesso!')
        await this.listarContatos()
      } catch (err) {
        this.$notificarErro(err)
      }
    },
    async listarUsuarios () {
      try {
        const { data } = await ListarUsuarios()
        this.usuarios = data.users
      } catch (error) {
        console.error(error)
        this.$notificarErro('Problema ao carregar usuários', error)
      }
    },
    async listarEtiquetas () {
      const { data } = await ListarEtiquetas(true)
      this.etiquetas = data
    },
    downloadFile (downloadLink) {
      const link = document.createElement('a')
      link.href = downloadLink
      link.setAttribute('download', 'contatos.xlsx')
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    },
    handleExportContacts () {
      ExportarArquivoContato()
        .then(res => {
          const downloadLink = res.data.downloadLink
          this.downloadFile(downloadLink)
        })
        .catch(error => {
          console.error('Erro ao exportar contatos:', error)
        })
    },
    LOAD_CONTACTS (contacts) {
      const newContacts = []
      contacts.forEach(contact => {
        const contactIndex = this.contacts.findIndex(c => c.id === contact.id)
        if (contactIndex !== -1) {
          this.contacts[contactIndex] = contact
        } else {
          newContacts.push(contact)
        }
      })
      const contactsObj = [...this.contacts, ...newContacts]
      this.contacts = contactsObj
    },
    UPDATE_CONTACTS (contact) {
      const newContacts = [...this.contacts]
      const contactIndex = newContacts.findIndex(c => c.id === contact.id)
      if (contactIndex !== -1) {
        newContacts[contactIndex] = contact
      } else {
        newContacts.unshift(contact)
      }
      this.contacts = [...newContacts]
    },
    DELETE_CONTACT (contactId) {
      const newContacts = [...this.contacts]
      const contactIndex = newContacts.findIndex(c => c.id === contactId)
      if (contactIndex !== -1) {
        newContacts.splice(contactIndex, 1)
      }
      this.contacts = [...newContacts]
    },
    filtrarContato (data) {
      this.contacts = []
      this.params.pageNumber = 1
      this.params.searchParam = data
      this.loading = true
      this.listarContatos()
    },
    async listarContatos () {
      this.loading = true
      const { data } = await ListarContatos(this.params)
      this.params.hasMore = data.hasMore
      this.LOAD_CONTACTS(data.contacts)
      this.loading = false
      this.pagination.lastIndex = this.contacts.length - 1
      this.pagination.rowsNumber = data.count
    },
    onScroll ({ to, ref, ...all }) {
      if (this.loading !== true && this.params.hasMore === true && to === this.pagination.lastIndex) {
        this.loading = true
        this.params.pageNumber++
        this.listarContatos()
      }
    },
    async handleSaveTicket (contact, channel) {
      if (!contact.id) return

      const itens = []
      const channelId = null
      this.whatsapps.forEach(w => {
        if (w.type === channel) {
          itens.push({ label: w.name, value: w.id })
        }
      })

      this.$q.dialog({
        title: `Contato: ${contact.name}`,
        message: 'Selecione o canal para iniciar o atendimento.',
        options: {
          type: 'radio',
          model: channelId,
          // inline: true
          isValid: v => !!v,
          items: itens
        },
        ok: {
          push: true,
          rounded: true,
          color: 'positive',
          label: 'Iniciar'
        },
        cancel: {
          push: true,
          rounded: true,
          label: 'Cancelar',
          color: 'negative'
        },
        persistent: true
      }).onOk(async channelId => {
        if (!channelId) return
        this.loading = true
        try {
          const { data: ticket } = await CriarTicket({
            contactId: contact.id,
            isActiveDemand: true,
            userId: userId,
            channel,
            channelId,
            status: 'open'
          })
          await this.$store.commit('SET_HAS_MORE', true)
          await this.$store.dispatch('AbrirChatMensagens', ticket)
          // Notificação removida conforme solicitado
          /*
          this.$q.notify({
            message: `Atendimento Iniciado || ${ticket.contact.name} - Ticket: ${ticket.id}`,
            type: 'positive',
            position: 'bottom-right',
            progress: true,
            actions: [{
              icon: 'close',
              round: true,
              color: 'white'
            }]
          })
          */
          this.$router.push({ name: 'chat', params: { ticketId: ticket.id } })
        } catch (error) {
          if (error.status === 409) {
            const ticketAtual = JSON.parse(error.data.error)
            this.abrirAtendimentoExistente(contact, ticketAtual)
            return
          }
          this.$notificarErro('Ocorreu um erro!', error)
        }
        this.loading = false
      })
    },
    editContact (contactId) {
      this.selectedContactId = contactId
      this.modalContato = true
    },
    deleteContact (contactId) {
      this.$q.dialog({
        title: 'Atenção!! Deseja realmente deletar o contato? ',
        // message: 'Mensagens antigas não serão apagadas no whatsapp.',
        cancel: {
          label: 'Não',
          color: 'primary',
          rounded: true,
          push: true
        },
        ok: {
          label: 'Sim',
          color: 'negative',
          rounded: true,
          push: true
        },
        persistent: true
      }).onOk(() => {
        this.loading = true
        DeletarContato(contactId)
          .then(res => {
            this.DELETE_CONTACT(contactId)
            this.$q.notify({
              type: 'positive',
              progress: true,
              position: 'bottom-right',
              message: 'Contato deletado!',
              actions: [{
                icon: 'close',
                round: true,
                color: 'white'
              }]
            })
          })
          .catch(error => {
            console.error(error)
            this.$notificarErro('Não é possível deletar o contato', error)
          })
        this.loading = false
      })
    },
    abrirChatContato (ticket) {
      // caso esteja em um tamanho mobile, fechar a drawer dos contatos
      if (this.$q.screen.lt.md && ticket.status !== 'pending') {
        this.$eventBus.emit('infor-cabecalo-chat:acao-menu')
      }
      if (!(ticket.status !== 'pending' && (ticket.id !== this.$store.getters.ticketFocado.id || this.$route.name !== 'chat'))) return
      this.$store.commit('SET_HAS_MORE', true)
      this.$store.dispatch('AbrirChatMensagens', ticket)
    },
    abrirAtendimentoExistente (contato, ticket) {
      this.$q.dialog({
        title: 'Atenção!!',
        message: `${contato.name} possui um atendimento em curso (Atendimento: ${ticket.id}). Deseja abrir o atendimento?`,
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
      }).onOk(async () => {
        try {
          this.abrirChatContato(ticket)
        } catch (error) {
          this.$notificarErro(
            'Não foi possível atualizar o token',
            error
          )
        }
      })
    }

  },
  mounted () {
    this.usuario = JSON.parse(localStorage.getItem('usuario'))
    this.userProfile = localStorage.getItem('profile')
    this.listarContatos()
    this.listarUsuarios()
    this.listarEtiquetas()
  }
}
</script>

<style lang="sass" >
.my-sticky-dynamic
  /* height or max-height is important */
  height: 85vh

  .q-table__top,
  .q-table__bottom,
  thead tr:first-child th /* bg color is important for th; just specify one */
    background-color: var(--background-color-paper)

  /* Dark mode styles */
  body.body--dark .q-table__top,
  body.body--dark .q-table__bottom,
  body.body--dark thead tr:first-child th
    background-color: $dark-secondary !important
    color: $dark-text-primary !important

  thead tr th
    position: sticky
    z-index: 1
  /* this will be the loading indicator */
  thead tr:last-child th
    /* height of all previous header rows */
    top: 63px
  thead tr:first-child th
    top: 0

.heightChat
  height: calc(100vh - 0px)
  .q-table__top
    padding: 8px

#tabela-contatos-atendimento
  thead
    th
      height: 55px
</style>
