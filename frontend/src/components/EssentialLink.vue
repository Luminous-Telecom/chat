<template>
  <q-item
    clickable
    v-ripple
    :active="isActive"
    active-class="bg-blue-1 text-grey-8 text-bold menu-link-active-item-top"
    @click="$router.push({ name: routeName, query: query }).catch(err => { if (err.name !== 'NavigationDuplicated') throw err })"
    class="houverList"
    :class="{'text-negative text-bolder': color === 'negative'}"
  >
    <q-item-section
      v-if="icon"
      avatar
    >
      <q-icon :name="color === 'negative' ? 'mdi-cellphone-nfc-off' : icon" />
      <q-badge
        v-if="badge && badge > 0"
        color="red"
        text-color="white"
        floating
      >
        {{ badge }}
      </q-badge>
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ title }}</q-item-label>
      <q-item-label caption>
      </q-item-label>
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
    }
  },
  computed: {
    cRouterName () {
      return this.$route.name
    },
    isActive () {
      if (this.routeName !== this.$route.name) {
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
  }
}
</script>
<style lang="sass">
.menu-link-active-item-top
  border-radius: 0 8px 8px 0
  background: linear-gradient(98deg, rgba(189, 189, 189, 0.1) 0%, rgba(189, 189, 189, 0.1) 100%)

.houverList
  border-radius: 0 8px 8px 0
  padding: 6px 12px
  min-height: 36px
  &:hover
    background: linear-gradient(98deg, rgba(189, 189, 189, 0.1) 0%, rgba(189, 189, 189, 0.1) 100%)

.q-item__section--avatar
  min-width: 32px
  padding-right: 8px
  .q-icon
    font-size: 20px

.q-item__label
  font-size: 0.8125rem
  line-height: 1rem
</style>
