import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  queueTicketCounts: {},
  totalUnreadCount: 0,
  notifications: [],
  pendingNotifications: [],
  disconnectedChannels: [], // Array ao invés de Set
  unreadTicketMessages: {} // Objeto para armazenar contagem de mensagens não lidas por ticket
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setQueueTicketCounts: (state, action) => {
      state.queueTicketCounts = action.payload;
      // Calcula o total de tickets não lidos
      state.totalUnreadCount = Object.values(action.payload).reduce(
        (total, count) => total + count,
        0
      );
    },
    updateQueueCount: (state, action) => {
      const { queueId, count } = action.payload;
      state.queueTicketCounts[queueId] = count;
      // Recalcula o total
      state.totalUnreadCount = Object.values(state.queueTicketCounts).reduce(
        (total, count) => total + count,
        0
      );
    },
    addNotification: (state, action) => {
      state.notifications.push({
        id: Date.now(),
        ...action.payload,
        timestamp: new Date().toISOString(),
      });
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    // Novas actions para gerenciar canais desconectados
    addDisconnectedChannel: (state, action) => {
      const channelId = action.payload;
      if (!state.disconnectedChannels.includes(channelId)) {
        state.disconnectedChannels.push(channelId);
      }
    },
    removeDisconnectedChannel: (state, action) => {
      const channelId = action.payload;
      state.disconnectedChannels = state.disconnectedChannels.filter(id => id !== channelId);
    },
    clearDisconnectedChannels: (state) => {
      state.disconnectedChannels = [];
    },
    // Novas actions para gerenciar mensagens não lidas dos tickets
    setTicketUnreadCount: (state, action) => {
      const { ticketId, count } = action.payload;
      state.unreadTicketMessages[ticketId] = count;
    },
    incrementTicketUnreadCount: (state, action) => {
      const ticketId = action.payload;
      state.unreadTicketMessages[ticketId] = (state.unreadTicketMessages[ticketId] || 0) + 1;
    },
    clearTicketUnreadCount: (state, action) => {
      const ticketId = action.payload;
      delete state.unreadTicketMessages[ticketId];
    },
    clearAllTicketUnreadCounts: (state) => {
      state.unreadTicketMessages = {};
    }
  },
});

export const {
  setQueueTicketCounts,
  updateQueueCount,
  addNotification,
  removeNotification,
  clearNotifications,
  addDisconnectedChannel,
  removeDisconnectedChannel,
  clearDisconnectedChannels,
  setTicketUnreadCount,
  incrementTicketUnreadCount,
  clearTicketUnreadCount,
  clearAllTicketUnreadCounts
} = notificationSlice.actions;

export default notificationSlice.reducer;