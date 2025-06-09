import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/authSlice';

// Base API configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
});

// Interceptor para adicionar token nas requisições
api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas e erros
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado ou inválido
      store.dispatch(logout());
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// Serviços de autenticação
export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  refresh: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },
  
  logout: async () => {
    await api.post('/auth/logout');
  },
};

// Serviços de tickets
export const ticketService = {
  getAll: async (params = {}) => {
    const response = await api.get('/tickets', { params });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/tickets/${id}`);
    return response.data;
  },
  
  getMessages: async (ticketId, params = {}) => {
    const response = await api.get(`/messages/${ticketId}`, { params });
    return response.data;
  },
  
  sendMessage: async (ticketId, messageData) => {
    const response = await api.post(`/messages/${ticketId}`, messageData);
    return response.data;
  },
  
  create: async (ticketData) => {
    const response = await api.post('/tickets', ticketData);
    return response.data;
  },
  
  update: async (id, ticketData) => {
    const response = await api.put(`/tickets/${id}`, ticketData);
    return response.data;
  },
  
  delete: async (id) => {
    await api.delete(`/tickets/${id}`);
  },
  
  acceptTicket: async (id) => {
    const response = await api.put(`/tickets/${id}`, {
      status: 'open',
      userId: JSON.parse(localStorage.getItem('usuario'))?.id
    });
    return response.data;
  },
  
  getTicketLogs: async (ticketId) => {
    const response = await api.get(`/tickets/${ticketId}/logs`);
    return response;
  },

  uploadFile: async (ticketId, formData) => {
    const response = await api.post(`/messages/${ticketId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Serviços de filas
export const queueService = {
  getUnreadCount: async () => {
    const response = await api.get('/queue/unread-count');
    return response.data;
  },
  
  getAll: async () => {
    const response = await api.get('/queue');
    return response.data;
  },
};

// Serviços de usuários
export const userService = {
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },
  
  updateProfile: async (userData) => {
    const response = await api.put('/users/profile', userData);
    return response.data;
  },
};

export default api;