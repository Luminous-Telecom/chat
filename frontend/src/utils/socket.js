import { io } from 'socket.io-client'

export const socketIO = () => {
  return io(process.env.VUE_URL_API, {
    reconnection: true,
    autoConnect: true,
    transports: ['websocket'],
    auth: (cb) => {
      const token = localStorage.getItem('token')

      if (!token) {
        // Usar null no primeiro parâmetro para indicar erro
        return cb(null, { token: null })
      }

      // eslint-disable-next-line standard/no-callback-literal
      return cb({ token })
    }
  })
}

const socket = socketIO()

socket.on('connect', () => {
  // Conectado com sucesso
})

export default socket
