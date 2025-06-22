import request from 'src/service/request'

export function FetchFacebookPages (data) {
  return request({
    url: '/api/fb/register-pages',
    method: 'post',
    data
  })
}

export function LogoutFacebookPages (data) {
  return request({
    url: '/api/fb/logout-pages',
    method: 'post',
    data
  })
}
