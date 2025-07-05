import { Notify } from 'quasar'
import Errors from 'src/utils/errors'

export const notificarErro = (msg, error = null) => {
  // Não exibir erro se for 409 (ticket já existente) ou mensagem simples já tratada
  if (
    (error && error.response && error.response.status === 409) ||
    (typeof msg === 'string' && msg.includes('Já existe um atendimento em andamento para este contato'))
  ) {
    return
  }
  let erro = ''
  if (error) {
    erro = error?.data?.error || error?.data?.msg || error?.data?.message || error?.response?.data.error || 'Não identificado'
  }
  const findErro = Errors.find(e => e.error == erro)
  let message = ''

  if (error && findErro && findErro.error) {
    message = `
      <p class="text-bold">
      <span class="text-bold">${findErro.description}.</span>
      </p>
      <p>${findErro.detail}</p>
    `
  } else {
    message = `
    <p class="text-bold">
      <span class="text-bold">${msg}</span>
    </p>
    <p>Detail: ${erro}</p>
    `
  }

  Notify.create({
    type: 'negative',
    progress: true,
    position: 'bottom-right',
    timeout: 500,
    message,
    actions: [{
      icon: 'close',
      round: true,
      color: 'white'
    }],
    html: true
  })
}

export const notificarSucesso = (msg) => {
  const message = `Tudo certo... <br>${msg}.`
  Notify.create({
    type: 'positive',
    progress: true,
    position: 'bottom-right',
    message,
    timeout: 500,
    actions: [{
      icon: 'close',
      round: true,
      color: 'white'
    }],
    html: true
  })
}
