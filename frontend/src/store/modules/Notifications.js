// import { Notify } from 'quasar'
// import $router from 'src/router'
// import { orderBy } from 'lodash'
// import { parseISO } from 'date-fns'

const Notifications = {
  state: {
    notifications: [],
    notifications_p: [],
    errorNotifications: []
  },
  mutations: {
    // OK
    UPDATE_NOTIFICATIONS (state, payload) {
      state.notifications = payload
    },
    UPDATE_NOTIFICATIONS_P (state, payload) {
      state.notifications_p = payload
    },
    ADD_ERROR_NOTIFICATION (state, errorNotification) {
      state.errorNotifications.push(errorNotification)
    },
    REMOVE_ERROR_NOTIFICATION (state, errorId) {
      state.errorNotifications = state.errorNotifications.filter(
        notification => notification.id !== errorId
      )
    },
    CLEAR_ERROR_NOTIFICATIONS (state) {
      state.errorNotifications = []
    }
  },
  getters: {
    errorNotificationsCount: (state) => {
      return state.errorNotifications.length
    },
    hasErrorNotifications: (state) => {
      return state.errorNotifications.length > 0
    }
  }
}

export default Notifications
