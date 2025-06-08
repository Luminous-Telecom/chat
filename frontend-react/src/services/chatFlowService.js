import api from './api';

export const chatFlowService = {
  // Criar novo chat flow
  create(data) {
    return api.post('/chat-flow', data);
  },

  // Listar chat flows
  list(params) {
    return api.get('/chat-flow', { params });
  },

  // Atualizar chat flow
  update(data) {
    return api.put(`/chat-flow/${data.id}`, data);
  },

  // Excluir chat flow
  delete(data) {
    return api.delete(`/chat-flow/${data.id}`);
  },

  // Obter chat flow específico
  get(id) {
    return api.get(`/chat-flow/${id}`);
  }
};

export default chatFlowService;