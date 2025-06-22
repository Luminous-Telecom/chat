import request from 'src/service/request'

export function CriarFila (data) {
  return request({
    url: '/api/queue/',
    method: 'post',
    data
  })
}

export function ListarFilas () {
  return request({
    url: '/api/queue/',
    method: 'get'
  })
}

export function AlterarFila (data) {
  return request({
    url: `/api/queue/${data.id}`,
    method: 'put',
    data
  })
}

export function DeletarFila (data) {
  return request({
    url: `/api/queue/${data.id}`,
    method: 'delete'
  })
}

export function ContarTicketsPendentesPorFila () {
  return request({
    url: '/api/queue/unread-count',
    method: 'get'
  })
}
