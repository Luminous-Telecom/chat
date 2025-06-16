import request from 'src/service/request'

export function ConsultarTicketsQueuesService (params) {
  return request({
    url: '/api/statistics/dash-tickets-queues',
    method: 'get',
    params
  })
}

export function RelatorioContatos (params) {
  return request({
    url: '/api/statistics/contacts-report',
    method: 'get',
    params
  })
}

export function RelatorioResumoAtendimentosUsuarios (params) {
  return request({
    url: '/api/statistics-per-users',
    method: 'get',
    params
  })
}

export function GetDashTicketsAndTimes (params) {
  return request({
    url: '/api/statistics/statistics-tickets-times',
    method: 'get',
    params
  })
}

export function GetDashTicketsChannels (params) {
  return request({
    url: '/api/statistics/statistics-tickets-channels',
    method: 'get',
    params
  })
}

export function GetDashTicketsEvolutionChannels (params) {
  return request({
    url: '/api/statistics/statistics-tickets-evolution-channels',
    method: 'get',
    params
  })
}

export function GetDashTicketsEvolutionByPeriod (params) {
  return request({
    url: '/api/statistics/statistics-tickets-evolution-by-period',
    method: 'get',
    params
  })
}

export function GetDashTicketsPerUsersDetail (params) {
  return request({
    url: '/api/statistics/statistics-tickets-per-users-detail',
    method: 'get',
    params
  })
}

export function GetDashTicketsQueue (params) {
  return request({
    url: '/api/statistics/statistics-tickets-queue',
    method: 'get',
    params
  })
}

export function GetDashTicketsEvolutionByQueue (params) {
  return request({
    url: '/api/statistics/statistics-tickets-evolution-by-queue',
    method: 'get',
    params
  })
}

export function GetDashTicketsInstances (params) {
  console.log('Parâmetros enviados para instâncias:', params)
  return request({
    url: '/api/statistics/statistics-tickets-instances',
    method: 'get',
    params
  }).then(response => {
    console.log('Resposta completa das instâncias:', response)
    return response.data
  }).catch(error => {
    console.error('Erro ao buscar dados das instâncias:', error)
    throw error
  })
}
