import { Notify } from 'quasar'
import audioNotificationService from 'src/services/audioNotificationService'

export const notificarErro = (error) => {
  const errorMessage = error?.response?.data?.error || error?.message || 'Ocorreu um erro inesperado'
  const errorTitle = error?.response?.data?.title || 'Erro'

  Notify.create({
    type: 'negative',
    message: errorMessage,
    caption: errorTitle,
    position: 'bottom-right',
    timeout: 5000,
    actions: [
      { label: 'OK', color: 'white' }
    ]
  })

  // Erro de notificação
}

export const notificarSucesso = (message, title = 'Sucesso') => {
  Notify.create({
    type: 'positive',
    message: message,
    caption: title,
    position: 'bottom-right',
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
    position: 'bottom-right',
    timeout: 4000,
    actions: [
      { label: 'OK', color: 'white' }
    ]
  })
}

// Funções de notificação de áudio
export const tocarSomNotificacao = async () => {
  await audioNotificationService.playNotificationSound()
}

export const tocarSomNotificacaoComVolume = async (volume = 1.0) => {
  await audioNotificationService.playNotificationSoundWithVolume(volume)
}

export const pararSomNotificacao = () => {
  audioNotificationService.stopNotificationSound()
}

export const solicitarPermissaoAudio = async () => {
  return await audioNotificationService.requestAudioPermission()
}

export const temPermissaoAudio = () => {
  return audioNotificationService.hasAudioPermission()
}

export const definirVolumeNotificacao = (volume) => {
  audioNotificationService.setVolume(volume)
}

export const definirIntervaloMinimoNotificacao = (interval) => {
  audioNotificationService.setMinInterval(interval)
}

export const inicializarServicoAudio = () => {
  audioNotificationService.initAudioElement()
}

export const destruirServicoAudio = () => {
  audioNotificationService.destroy()
}

// Função para atualizar o título da guia com notificações
export const atualizarTituloGuia = (notifications, notifications_p) => {
  // Calcular total de conversas não lidas dos tickets em andamento (open)
  const ticketsOpen = notifications?.tickets || []
  const totalUnreadConversations = ticketsOpen.filter(ticket => ticket.unreadMessages > 0).length

  // Calcular total de tickets pendentes (pending)
  const ticketsPending = notifications_p?.tickets || []
  const totalPending = ticketsPending.length

  // Total geral de notificações
  const totalNotificacoes = totalUnreadConversations + totalPending

  if (totalNotificacoes > 0) {
    document.title = `(${totalNotificacoes}) Lumis Suite`
  } else {
    document.title = 'Lumis Suite'
  }
}
