import axios from 'axios'

const api = axios.create({
  baseURL: process.env.VUE_URL_API,
  timeout: 60000
})

// Adiciona o token de autenticação em todas as requisições
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Adiciona tratamento de erros
api.interceptors.response.use(
  response => response,
  error => {
    // Verificar se a notificação deve ser silenciada
    const config = error.config || {}
    const silentError = config.silentError || false

    if (silentError) {
      // Não mostrar notificação automática, deixar o código da página tratar
      return Promise.reject(error)
    }

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

    // Notifica o erro
    const { Notify } = require('quasar')
    Notify.create({
      message,
      type: 'negative',
      progress: true,
      position: 'bottom-right',
      actions: [{
        icon: 'close',
        color: 'white'
      }]
    })

    return Promise.reject(error)
  }
)

import { boot } from 'quasar/wrappers'

export default boot(({ app }) => {
  app.config.globalProperties.$axios = api
})
