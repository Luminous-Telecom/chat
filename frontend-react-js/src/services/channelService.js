import api from './api';

export const channelService = {
  // Listar todos os canais
  list() {
    return api.get('/whatsapp/');
  },

  // Criar novo canal
  create(data) {
    return api.post('/whatsapp', data);
  },

  // Atualizar canal
  update(id, data) {
    return api.put(`/whatsapp/${id}`, data);
  },

  // Excluir canal
  delete(id) {
    return api.delete(`/whatsapp/${id}`);
  },

  // Obter canal específico
  get(id) {
    return api.get(`/whatsapp/${id}`);
  },

  // Iniciar sessão do canal
  startSession(id) {
    return api.post(`/whatsappsession/${id}`);
  },

  // Parar sessão do canal
  stopSession(id) {
    return api.delete(`/whatsappsession/${id}`);
  },

  // Solicitar novo QR Code
  requestNewQrCode(id, data) {
    return api.put(`/whatsappsession/${id}`, data);
  },

  // Obter sessão do WhatsApp
  getSession(id) {
    return api.get(`/whatsapp/${id}`);
  },

  // Desconectar sessão
  disconnectSession(id) {
    return api.delete(`/whatsappsession/${id}`);
  },

  // Reiniciar sessão
  restartSession(id) {
    return api.put(`/whatsappsession/${id}`);
  },

  // Listar canais administrativos
  listAdminChannels() {
    return api.get('/admin/channels');
  },

  // Criar canal administrativo
  createAdminChannel(data) {
    return api.post('/admin/channels', data);
  }
};

export default channelService;