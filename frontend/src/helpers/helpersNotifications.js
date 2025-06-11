import { Notify } from 'quasar'

export const notificarErro = (error) => {
  const errorMessage = error?.response?.data?.error || error?.message || 'Ocorreu um erro inesperado'
  const errorTitle = error?.response?.data?.title || 'Erro'

  Notify.create({
    type: 'negative',
    message: errorMessage,
    caption: errorTitle,
    position: 'top',
    timeout: 5000,
    actions: [
      { label: 'OK', color: 'white' }
    ]
  })

  console.error('Erro:', { errorMessage, errorTitle, originalError: error })
}

export const notificarSucesso = (message, title = 'Sucesso') => {
  Notify.create({
    type: 'positive',
    message: message,
    caption: title,
    position: 'top',
    timeout: 3000,
    actions: [
      { label: 'OK', color: 'white' }
    ]
  })
}

export const notificarAviso = (message, title = 'Aviso') => {
  Notify.create({
    type: 'warning',
    message: message,
    caption: title,
    position: 'top',
    timeout: 4000,
    actions: [
      { label: 'OK', color: 'white' }
    ]
  })
}
