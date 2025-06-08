import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  queueTicketCounts: {},
  totalUnreadCount: 0,
  notifications: [],
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
  },
});

export const {
  setQueueTicketCounts,
  updateQueueCount,
  addNotification,
  removeNotification,
  clearNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;