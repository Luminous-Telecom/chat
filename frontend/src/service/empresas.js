import request from 'src/service/request'

export function MostrarHorariosAtendiemento () {
  return request({
    url: '/api/tenants/business-hours/',
    method: 'get'
  })
}

export function AtualizarHorariosAtendiemento (data) {
  return request({
    url: '/api/tenants/business-hours/',
    method: 'put',
    data
  })
}

export function AtualizarMensagemHorariosAtendiemento (data) {
  return request({
    url: '/api/tenants/message-business-hours/',
    method: 'put',
    data
  })
}
