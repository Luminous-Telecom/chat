import { io } from 'socket.io-client'

export const socketIO = () => {
  return io(process.env.VUE_URL_API, {
    reconnection: true,
    autoConnect: true,
    transports: ['websocket'],
    auth: (cb) => {
      const token = localStorage.getItem('token')

      if (!token) {
        console.warn('[Socket] Token não encontrado no localStorage')
        // Usar null no primeiro parâmetro para indicar erro
        return cb(null, { token: null })
      }

      console.log('[Socket] Enviando token para autenticação')
      // eslint-disable-next-line standard/no-callback-literal
      return cb({ token })
    }
  })
}

const socket = socketIO()

socket.io.on('error', (error) => {
  console.error('[Socket] Erro de conexão:', error)
})

socket.on('disconnect', (reason) => {
  console.info('[Socket] Desconectado:', reason)
})

socket.on('connect', () => {
  console.info('[Socket] Conectado com sucesso')
})

socket.on('connect_error', (error) => {
  console.error('[Socket] Erro de conexão:', error.message)
})

// Listener para token inválido
socket.onAny((event, ...args) => {
  if (event.startsWith('tokenInvalid:')) {
    console.warn('[Socket] Token inválido, redirecionando para login')
    // Limpar localStorage e redirecionar para login
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    window.location.href = '/login'
  }
})

export default socket
