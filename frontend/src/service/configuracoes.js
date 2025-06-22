import request from 'src/service/request'

export function ListarConfiguracoes (params) {
  return request({
    url: '/api/settings/',
    method: 'get',
    params
  })
}

export function AlterarConfiguracao (data) {
  return request({
    url: `/api/settings/${data.Key}/`,
    method: 'put',
    data
  })
}
