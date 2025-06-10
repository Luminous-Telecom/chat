import axios from 'axios';
import { notificarErro } from '../helpers/helpersNotifications';
import { LocalStorage } from 'quasar';

// Validar se a URL da API está definida
if (!process.env.VUE_URL_API) {
  console.error('VUE_URL_API não está definida nas variáveis de ambiente!');
  notificarErro({ message: 'Configuração inválida: URL da API não definida' });
}

const api = axios.create({
  baseURL: process.env.VUE_URL_API,
  timeout: 30000,
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(
  config => {
    const token = LocalStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Interceptor para tratamento de respostas
api.interceptors.response.use(
  response => response,
  error => {
    // Log do erro para debug
    console.error('API Error:', error);
    
    if (error.response) {
      // O servidor respondeu com um status de erro
      switch (error.response.status) {
        case 401:
          // Não autorizado - limpar dados e redirecionar para login
          LocalStorage.remove('token');
          LocalStorage.remove('usuario');
          window.location.href = '/login';
          notificarErro({ message: 'Sua sessão expirou. Por favor, faça login novamente.' });
          break;
        case 403:
          notificarErro({ message: 'Você não tem permissão para realizar esta ação' });
          break;
        case 404:
          notificarErro({ message: 'Recurso não encontrado' });
          break;
        case 500:
          notificarErro({ 
            message: 'Erro interno do servidor. Por favor, tente novamente mais tarde.',
            response: { data: error.response.data }
          });
          break;
        default:
          notificarErro(error);
      }
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      notificarErro({ message: 'Não foi possível conectar ao servidor. Verifique sua conexão.' });
    } else {
      // Erro na configuração da requisição
      notificarErro(error);
    }
    
    return Promise.reject(error);
  }
);

// Serviços da API
export const userService = {
  list: () => api.get('/users/'),
  getProfile: () => api.get('/users/profile'),
  updateProfile: (userData) => api.put('/users/profile', userData)
};

export const tagService = {
  list: (params) => api.get('/tags/', { params }),
  create: (tagData) => api.post('/tags/', tagData),
  update: (id, tagData) => api.put(`/tags/${id}`, tagData),
  delete: (id) => api.delete(`/tags/${id}`)
};

export const whatsappService = {
  list: () => api.get('/whatsapp/'),
  create: (whatsappData) => api.post('/whatsapp/', whatsappData),
  update: (id, whatsappData) => api.put(`/whatsapp/${id}`, whatsappData),
  delete: (id) => api.delete(`/whatsapp/${id}`)
};

export const contactService = {
  list: (params) => api.get('/contacts', { params }),
  create: (contactData) => api.post('/contacts', contactData),
  update: (id, contactData) => api.put(`/contacts/${id}`, contactData),
  delete: (id) => api.delete(`/contacts/${id}`)
};

export default api; 