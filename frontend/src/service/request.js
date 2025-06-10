import axios from 'axios'
import Router from '../router/index'

import loading from 'src/utils/loading'
import { Notify } from 'quasar'

import backendErrors from './erros'
import { RefreshToken } from './login'

const service = axios.create({
  baseURL: process.env.VUE_URL_API,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY = 2000 // 2 segundos

const handlerError = err => {
  const errorMsg = err?.response?.data?.error
  let error = 'Ocorreu um erro não identificado.'
  let details = ''

  if (!err.response) {
    if (err.code === 'ECONNABORTED') {
      error = 'O servidor demorou muito para responder. Por favor, tente novamente.'
      details = 'Timeout da requisição'
    } else if (err.message === 'Network Error') {
      error = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
      details = 'Erro de conexão com o servidor'

      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        setTimeout(() => {
          service.get('/health')
            .then(() => {
              reconnectAttempts = 0
              Notify.create({
                position: 'top',
                type: 'positive',
                message: 'Conexão restaurada com sucesso!'
              })
            })
            .catch(() => {
              Notify.create({
                position: 'top',
                type: 'warning',
                message: 'Não foi possível reconectar automaticamente. Por favor, recarregue a página.',
                timeout: 0,
                actions: [
                  { label: 'Recarregar', color: 'white', handler: () => window.location.reload() }
                ]
              })
            })
        }, RECONNECT_DELAY)
      }
    } else {
      error = `Erro de conexão: ${err.message}`
      details = err.message
    }
  } else if (errorMsg) {
    if (backendErrors[errorMsg]) {
      error = backendErrors[errorMsg]
    } else {
      error = err.response.data.error
    }
    details = err.response.data.details || ''
  }

  Notify.create({
    position: 'top',
    type: 'negative',
    html: true,
    progress: true,
    message: `
      <p class="text-bold">
        <span class="text-bold">Erro: ${error}</span>
      </p>
      ${details ? `<p>Detalhes: ${details}</p>` : ''}
    `
  })
}

// const tokenInicial = url => {
//   const paths = [
//     '/login/'
//   ]
//   let is_init = false
//   paths.forEach(path => {
//     url.indexOf(path) !== -1 ? is_init = true : is_init = false
//   })
//   return is_init
// }

service.interceptors.request.use(
  config => {
    try {
      if (config.loading) {
        loading.show(config.loading)
      }
    } catch (error) {
      console.error('Error showing loading:', error)
    }

    const tokenAuth = JSON.parse(localStorage.getItem('token'))
    if (tokenAuth) {
      config.headers.Authorization = `Bearer ${tokenAuth}`
    }

    if (config.method === 'get') {
      config.params = { ...config.params, _t: Date.now() }
    }

    return config
  },
  error => {
    console.error('Request interceptor error:', error)
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  response => {
    reconnectAttempts = 0
    loading.hide(response.config)
    return response
  },
  async error => {
    loading.hide(error.config)

    if (!error.response) {
      handlerError(error)
      return Promise.reject(error)
    }

    const { status } = error.response

    if (status === 403 && !error.config._retry) {
      error.config._retry = true
      try {
        const res = await RefreshToken()
        if (res.data?.token) {
          localStorage.setItem('token', JSON.stringify(res.data.token))
          error.config.headers.Authorization = `Bearer ${res.data.token}`
          return service(error.config)
        }
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError)
        handlerError(refreshError)
      }
    }

    if (status === 401) {
      if (error.config.url.indexOf('logout') === -1) {
        handlerError(error)
        localStorage.removeItem('token')
        localStorage.removeItem('username')
        localStorage.removeItem('profile')
        localStorage.removeItem('userId')
        setTimeout(() => {
          Router.push({ name: 'login' })
        }, 2000)
      }
    } else {
      handlerError(error)
    }

    return Promise.reject(error)
  }
)

export default service
