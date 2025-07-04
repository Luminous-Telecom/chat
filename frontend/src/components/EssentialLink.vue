<template>
  <q-item
    clickable
    v-ripple
    :active="isActive"
    active-class="bg-blue-1 text-grey-8 text-bold menu-link-active-item-top"
    @click="handleNavigation"
    class="houverList icon-only-item"
    :class="{'text-negative text-bolder': color === 'negative'}"
  >
    <q-tooltip anchor="center right" self="center left" :offset="[10, 0]">
      {{ title }}
    </q-tooltip>
    <q-item-section
      v-if="icon"
      avatar
      class="icon-centered"
    >
      <q-icon :name="color === 'negative' ? 'mdi-cellphone-nfc-off' : icon" />
      <q-badge
        v-if="badge !== null && badge !== undefined && (badge > 0 || (badge === 0 && query && (query.status === 'open' || query.status === 'pending')))"
        :color="badgeColor || 'red'"
        text-color="white"
        floating
      >
        {{ badge }}
      </q-badge>
    </q-item-section>
  </q-item>
</template>

<script>
export default {
  name: 'EssentialLink',
  data () {
    return {
      menuAtivo: 'dashboard'
    }
  },
  props: {
    title: {
      type: String,
      required: true
    },

    caption: {
      type: String,
      default: ''
    },

    color: {
      type: String,
      default: ''
    },

    routeName: {
      type: String,
      default: 'dashboard'
    },

    icon: {
      type: String,
      default: ''
    },

    query: {
      type: Object,
      default: () => ({})
    },

    badge: {
      type: Number,
      default: 0
    },

    badgeColor: {
      type: String,
      default: 'red'
    }
  },
  computed: {
    cRouterName () {
      return this.$route.name
    },
    isActive () {
      // Para rotas de atendimento, considerar ativo se estivermos em 'atendimento', 'chat-empty' ou 'chat'
      if (this.routeName === 'atendimento') {
        const atendimentoRoutes = ['atendimento', 'chat-empty', 'chat']
        if (!atendimentoRoutes.includes(this.$route.name)) {
          return false
        }
      } else if (this.routeName !== this.$route.name) {
        return false
      }

      // Se não há query definida, considera ativo apenas se a rota atual também não tem query relevante
      if (!this.query || Object.keys(this.query).length === 0) {
        return !this.$route.query || Object.keys(this.$route.query).length === 0
      }

      // Compara cada propriedade da query individualmente
      for (const key in this.query) {
        if (this.query[key] !== this.$route.query[key]) {
          return false
        }
      }

      return true
    }
  },
  methods: {
    handleNavigation () {
      // Se for navegação para atendimento, ir diretamente para chat-empty
      if (this.routeName === 'atendimento') {
        this.$router.push({
          name: 'chat-empty',
          query: this.query
        }).catch(err => {
          if (err.name !== 'NavigationDuplicated') throw err
        })
      } else {
        // Para outras rotas, navegação normal
        this.$router.push({
          name: this.routeName,
          query: this.query
        }).catch(err => {
          if (err.name !== 'NavigationDuplicated') throw err
        })
      }
    }
  }
}
</script>
<style lang="sass">
.menu-link-active-item-top
  border-radius: 0 8px 8px 0
  background: rgba(189, 189, 189, 0.1)

.houverList
  border-radius: 0 8px 8px 0
  padding: 6px 12px
  min-height: 36px
  &:hover
    background: rgba(189, 189, 189, 0.1)

.q-item__section--avatar
  min-width: 32px
  padding-right: 8px
  .q-icon
    font-size: 20px

.q-item__label
  font-size: 0.8125rem
  line-height: 1rem
</style>
