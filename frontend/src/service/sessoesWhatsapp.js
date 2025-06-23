import request from 'src/service/request'

export function ListarWhatsapps (whatsAppId) {
  return request({
    url: '/api/whatsapp/',
    method: 'get'
  })
}

export function StartWhatsappSession (whatsAppId) {
  return request({
    url: `/api/whatsappsession/${whatsAppId}`,
    method: 'post'
  })
}

export const DeleteWhatsappSession = async (whatsAppId) => {
  const { data } = await request({
    url: `/api/whatsappsession/${whatsAppId}`,
    method: 'DELETE'
  })

  return data
}

export function RequestNewQrCode (data) {
  return request({
    url: `/api/whatsappsession/${data.id}`,
    method: 'put',
    data
  })
}

export function GetWhatSession (whatsAppId) {
  return request({
    url: `/api/whatsapp/${whatsAppId}`,
    method: 'get'
  })
}

export function UpdateWhatsapp (whatsAppId, data) {
  return request({
    url: `/api/whatsapp/${whatsAppId}`,
    method: 'put',
    data
  })
}

export function CriarWhatsapp (data) {
  return request({
    url: '/api/whatsapp',
    method: 'post',
    data
  })
}

export function DeletarWhatsapp (whatsAppId) {
  return request({
    url: `/api/whatsapp/${whatsAppId}`,
    method: 'delete'
  })
}

// api.put(`/whatsapp/${whatsAppId}`, {
//   name: values.name,
//   isDefault: values.isDefault,
// });
