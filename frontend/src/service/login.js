import request from '../service/request.js'

export function RealizarLogin (user) {
  return request({
    url: '/api/auth/login',
    method: 'post',
    data: user
  })
}

export function RealizarLogout (user) {
  return request({
    url: '/api/auth/logout',
    method: 'post',
    data: user
  })
}

export function RefreshToken () {
  return request({
    url: '/api/auth/refresh_token',
    method: 'post'
  })
}
