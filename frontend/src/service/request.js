import axios from 'axios'
import Router from '../router/index.js'

import loading from '../utils/loading.js'
import { Notify } from 'quasar'

import backendErrors from './erros.js'
import { RefreshToken } from './login.js'

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
    console.error('Error showing notification:', notifyError)
    console.error('Original error:', error)
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

service.interceptors.request.use(
  config => {
    try {
      if (config.loading) {
        loading.show(config.loading)
      }
    } catch (error) {

    }

    // let url = config.url
    // const r = new RegExp('id_conta_cliente', 'g')
    // url = url.replace(r, id_conta_cliente)
    // const u = new RegExp('id_unidade_negocio', 'g')
    // config.url = url.replace(u, id_unidade_negocio)
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = 'Bearer ' + token
    }
    return config
  },
  error => {
    // handlerError(error)
    Promise.reject(error)
  }
)

service.interceptors.response.use(
  response => {
    loading.hide(response.config)
    return response
  },
  error => {
    loading.hide(error.config)
    if (error?.response?.status === 403 && !error.config._retry) {
      error.config._retry = true
      return RefreshToken().then(res => {
        if (res.data) {
          localStorage.setItem('token', res.data.token)
          // Retry the original request with the new token
          error.config.headers.Authorization = `Bearer ${res.data.token}`
          return service(error.config)
        }
        return Promise.reject(error)
      })
    }
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      localStorage.removeItem('profile')
      localStorage.removeItem('userId')
      if (error.config.url.indexOf('logout') === -1) {
        handlerError(error)
        setTimeout(() => {
          Router.push({
            name: 'login'
          })
        }, 2000)
      }
    } else {
      handlerError(error)
    }
    return Promise.reject(error)
  }
)

export default service
