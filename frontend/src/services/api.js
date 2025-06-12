import axios from 'axios'
import { Notify } from 'quasar'
import { url } from '../utils/index'
import router from '../router'

const api = axios.create({
  baseURL: url,
  timeout: 60000
})

function notificarErro (error) {
  let message = 'Problemas internos do servidor'
  if (error.response) {
    if (error.response.status === 400) {
      if (error.response.data?.error) {
        message = `${error.response.data.error}`
      }
    }
    if (error.response.status === 403) {
      message = 'Acesso negado'
    }
    if (error.response.status === 404) {
      message = 'Não encontrado'
    }
  }
  if (error.code === 'ECONNABORTED') {
    message = 'Tempo limite de resposta excedido'
  }
  if (error.message === 'Network Error') {
    message = 'Problemas de conexão'
  }
  Notify.create({
    message,
    type: 'negative',
    progress: true,
    position: 'top',
    actions: [{
      icon: 'close',
      color: 'white'
    }]
  })
}

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// response interceptor
api.interceptors.response.use(
  response => {
    return response
  },
  async error => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem('token')
          localStorage.removeItem('usuario')
          // Use router navigation instead of window.location
          router.push('/login')
          notificarErro({ message: 'Sua sessão expirou. Por favor, faça login novamente.' })
          break
        case 403:
          notificarErro({ message: 'Você não tem permissão para realizar esta ação' })
          break
        case 404:
          notificarErro({ message: 'Recurso não encontrado' })
          break
        default:
          notificarErro(error)
      }
    } else {
      notificarErro(error)
    }
    return Promise.reject(error)
  }
)

export default api
