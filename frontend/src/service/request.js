import axios from 'axios'
import loading from '../utils/loading.js'
import { Notify, Loading } from 'quasar'

import backendErrors from './erros.js'

const service = axios.create({
  baseURL: process.env.VUE_URL_API,
  timeout: 20000
})

const handlerError = err => {
  const errorMsg = err?.response?.data?.error
  let error = 'Ocorreu um erro não identificado.'
  if (errorMsg) {
    if (backendErrors[errorMsg]) {
      error = backendErrors[errorMsg]
    } else {
      error = err.response.data.error
    }
  }
  try {
    Notify.create({
      position: 'top',
      type: 'negative',
      html: true,
      progress: true,
      message: error.toString()
    })
  } catch (notifyError) {
    // Error showing notification
  }
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

// Interceptor de requisição
service.interceptors.request.use(
  config => {
    try {
      Loading.show()
    } catch (error) {
      // Error showing loading
    }

    const token = localStorage.getItem('token')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  error => {
    // handlerError(error)
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  response => {
    loading.hide(response.config)
    return response
  },
  error => {
    loading.hide(error.config)

    if (error.response?.status === 403 || error.response?.status === 401) {
      const isLogged = localStorage.getItem('token')

      if (isLogged) {
        localStorage.removeItem('token')
        localStorage.removeItem('username')
        localStorage.removeItem('profile')
        localStorage.removeItem('userId')
        localStorage.removeItem('usuario')

        window.location.href = '/login'
      }
    } else {
      handlerError(error)
    }
    return Promise.reject(error)
  }
)

export default service
