import request from './request.js'

export function ConsultarTickets (params) {
  return request({
    url: '/tickets',
    method: 'get',
    params
  })
}

export function ConsultarDadosTicket (params) {
  return request({
    url: `/tickets/${params.id}`,
    method: 'get',
    params
  })
}

export function ConsultarLogsTicket (params) {
  return request({
    url: `/tickets/${params.ticketId}/logs`,
    method: 'get',
    params
  })
}

export function AtualizarStatusTicket (ticketId, status, userId) {
  return request({
    url: `/tickets/${ticketId}`,
    method: 'put',
    data: {
      status,
      userId
    }
  })
}

export function AtualizarTicket (ticketId, data) {
  return request({
    url: `/tickets/${ticketId}`,
    method: 'put',
    data
  })
}

export function LocalizarMensagens (params) {
  return request({
    url: `/messages/${params.ticketId}`,
    method: 'get',
    params
  })
}

export function EnviarMensagemTexto (ticketId, data) {
  return request({
    url: `/messages/${ticketId}`,
    method: 'post',
    data
  })
}

export function EncaminharMensagem (messages, contato) {
  const data = {
    messages,
    contact: contato
  }
  return request({
    url: '/forward-messages/',
    method: 'post',
    data
  })
}

export function DeletarMensagem (mensagem) {
  return request({
    url: `/messages/${mensagem.messageId}`,
    method: 'delete',
    data: mensagem
  })
}

export function ListarMensagensContato (contactId) {
  return request({
    url: `/messages/contact/${contactId}`,
    method: 'get'
  })
}

export function CriarTicket (data) {
  return request({
    url: '/tickets',
    method: 'post',
    data
  })
}

export const EnviarRespostaBotao = async (data) => {
  const { data: response } = await request.post('/messages/button-response', data)
  return response
}

export function EditarMensagemAgendada (messageId, data) {
  return request({
    url: `/messages/${messageId}`,
    method: 'put',
    data
  })
}

export function CancelarMensagemAgendada (messageId) {
  return request({
    url: `/messages/${messageId}/cancel`,
    method: 'patch'
  })
}

export function EntrarNaConversa (ticketId) {
  return request({
    url: `/tickets/${ticketId}/join`,
    method: 'post'
  })
}

export function SairDaConversa (ticketId) {
  return request({
    url: `/tickets/${ticketId}/leave`,
    method: 'post'
  })
}

export function ListarParticipantes (ticketId) {
  return request({
    url: `/tickets/${ticketId}/participants`,
    method: 'get'
  })
}
