import Vue from 'vue'

const whatsapp = {
  state: {
    whatsApps: []
  },
  mutations: {
    LOAD_WHATSAPPS (state, payload) {
      state.whatsApps = payload
    },
    UPDATE_WHATSAPPS (state, payload) {
      const whatsApp = payload
      let newWhats = [...state.whatsApps]
      const whatsAppIndex = newWhats.findIndex(s => s.id === whatsApp.id)
      if (whatsAppIndex !== -1) {
        newWhats[whatsAppIndex] = whatsApp
      } else {
        newWhats = [whatsApp, ...newWhats]
      }
      state.whatsApps = [...newWhats]
    },
    UPDATE_SESSION (state, payload) {
      const whatsApp = payload
      const whatsAppIndex = state.whatsApps.findIndex(s => s.id === whatsApp.id)

      if (whatsAppIndex !== -1) {
        // Use Vue.set to ensure reactivity for each property
        Vue.set(state.whatsApps[whatsAppIndex], 'status', whatsApp.status)
        Vue.set(state.whatsApps[whatsAppIndex], 'qrcode', whatsApp.qrcode)
        if (whatsApp.updatedAt) {
          Vue.set(state.whatsApps[whatsAppIndex], 'updatedAt', whatsApp.updatedAt)
        }
        if (whatsApp.retries !== undefined) {
          Vue.set(state.whatsApps[whatsAppIndex], 'retries', whatsApp.retries)
        }
        // Force reactivity by creating a new array reference
        state.whatsApps = [...state.whatsApps]
        return state.whatsApps
      } else {
        return state.whatsApps
      }
    },
    DELETE_WHATSAPPS (state, payload) {
      const whatsAppId = payload
      const whatsAppIndex = state.whatsApps.findIndex(s => s.id === whatsAppId)
      if (whatsAppIndex !== -1) {
        state.whatsApps.splice(whatsAppIndex, 1)
      }
      return state.whatsApps
    },
    RESET_WHATSAPPS (state) {
      state.whatsApps = []
    }
  }
}

export default whatsapp
