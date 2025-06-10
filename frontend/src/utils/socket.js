import { io } from 'socket.io-client'

export const socketIO = () => {
  const socket = io(process.env.VUE_URL_API, {
    reconnection: true,
    autoConnect: true,
    transports: ['websocket'],
    auth: (cb) => {
      const tokenItem = localStorage.getItem('token')
      const token = tokenItem ? JSON.parse(tokenItem) : null
      console.log('Socket auth token:', token)
      // eslint-disable-next-line standard/no-callback-literal
      cb({ token: token || null })
    }
  })

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
  })

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error)
  })

  return socket
}

const socket = socketIO()

socket.io.on('error', (error) => {
  // ...
  console.error('socket error', error)
})

socket.on('disconnect', (reason) => {
  console.info('socket disconnect', reason)

  // if (reason === "io server disconnect") {
  //   // the disconnection was initiated by the server, you need to reconnect manually
  //   socket.connect();
  // }
  // else the socket will automatically try to reconnect
})
