import request from 'src/service/request'

export function ListarUsuarios (params) {
  return request({
    url: '/api/users/',
    method: 'get',
    params
  })
}

export function CriarUsuario (data) {
  return request({
    url: '/api/users',
    method: 'post',
    data
  })
}

export function UpdateUsuarios (userId, data) {
  return request({
    url: `/api/users/${userId}`,
    method: 'put',
    data
  })
}

export function UpdateConfiguracoesUsuarios (userId, data) {
  return request({
    url: `/api/users/${userId}/configs`,
    method: 'put',
    data
  })
}

export function DadosUsuario (userId) {
  return request({
    url: `/api/users/${userId}`,
    method: 'get'
  })
}

export function DeleteUsuario (userId) {
  return request({
    url: `/api/users/${userId}`,
    method: 'delete'
  })
}
