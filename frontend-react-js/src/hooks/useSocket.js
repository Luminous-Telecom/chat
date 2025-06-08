import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { setQueueTicketCounts, updateQueueCount, addNotification } from '../store/notificationSlice';

// SINGLETON para prevenir múltiplas conexões
let globalSocket = null;
let globalSocketPromise = null;
let connectingInProgress = false;

const useSocket = () => {
  const dispatch = useDispatch();
  const { token, user } = useSelector((state) => state.auth);
  const isMountedRef = useRef(true);
  const hasSetupListeners = useRef(false);

  // Cleanup quando componente desmonta
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      hasSetupListeners.current = false;
    };
  }, []);

  // Função para criar conexão única
  const createConnection = useCallback(async (socketToken, socketUser) => {
    if (connectingInProgress) {
      return globalSocketPromise;
    }

    if (globalSocket?.connected) {
      return globalSocket;
    }

    connectingInProgress = true;
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

    globalSocketPromise = new Promise((resolve, reject) => {
      // Limpa socket anterior se existir
      if (globalSocket) {
        globalSocket.removeAllListeners();
        globalSocket.disconnect();
        globalSocket = null;
      }

      try {
        globalSocket = io(socketUrl, {
          auth: { token: socketToken },
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          reconnectionAttempts: 5,
          timeout: 15000,
          upgrade: true,
          rememberUpgrade: true,
          autoConnect: true
        });

        globalSocket.on('connect', () => {
          connectingInProgress = false;
          
          // Join nas salas do usuário
          if (socketUser.queues?.length > 0) {
            socketUser.queues.forEach(queue => {
              globalSocket.emit('joinQueue', queue.id);
            });
          }
          
          globalSocket.emit('joinNotification');
          resolve(globalSocket);
        });

        globalSocket.on('connect_error', (error) => {
          connectingInProgress = false;
          reject(error);
        });

        globalSocket.on('disconnect', (reason) => {
          connectingInProgress = false;
        });

      } catch (error) {
        connectingInProgress = false;
        reject(error);
      }
    });

    return globalSocketPromise;
  }, []);

  // Setup dos event listeners (apenas uma vez por componente)
  const setupListeners = useCallback((socket) => {
    if (hasSetupListeners.current || !socket) return;
    
    hasSetupListeners.current = true;

    // Event listeners locais (não conflitam com outros componentes)
    const handleTicketCount = (data) => {
      if (!isMountedRef.current) return;
      dispatch(setQueueTicketCounts(data));
    };

    const handleTicketUpdate = (data) => {
      if (!isMountedRef.current) return;
      if (data.queueId && typeof data.count === 'number') {
        dispatch(updateQueueCount({ queueId: data.queueId, count: data.count }));
      }
    };

    const handleNotification = (data) => {
      if (!isMountedRef.current) return;
      dispatch(addNotification({
        type: data.type || 'info',
        message: data.message,
        title: data.title,
      }));
    };

    const handleTicketNew = (ticket) => {
      if (!isMountedRef.current) return;
      dispatch(addNotification({
        type: 'info',
        title: 'Novo Ticket',
        message: `Ticket #${ticket.id} criado`,
      }));
    };

    const handleWhatsappSession = (data) => {
      if (!isMountedRef.current) return;
      // Emite evento customizado para componentes que precisam escutar mudanças de sessão
      window.dispatchEvent(new CustomEvent('whatsappSessionUpdate', { detail: data }));
    };

    // Adiciona listeners
    socket.on('ticket:count', handleTicketCount);
    socket.on('ticket:update', handleTicketUpdate);
    socket.on('notification', handleNotification);
    socket.on('ticket:new', handleTicketNew);
    
    // Listener para eventos de sessão WhatsApp específicos do tenant
    if (user?.tenantId) {
      socket.on(`${user.tenantId}:whatsappSession`, handleWhatsappSession);
    }

    // Cleanup quando componente desmonta
    return () => {
      if (socket) {
        socket.off('ticket:count', handleTicketCount);
        socket.off('ticket:update', handleTicketUpdate);
        socket.off('notification', handleNotification);
        socket.off('ticket:new', handleTicketNew);
        
        // Remove listener específico do tenant
        if (user?.tenantId) {
          socket.off(`${user.tenantId}:whatsappSession`, handleWhatsappSession);
        }
      }
    };
  }, [dispatch]);

  // Effect principal
  useEffect(() => {
    if (!token || !user) {
      return;
    }

    const initializeSocket = async () => {
      try {
        const socket = await createConnection(token, user);
        if (isMountedRef.current) {
          const cleanup = setupListeners(socket);
          return cleanup;
        }
      } catch (error) {
        console.error('Erro ao inicializar socket:', error);
      }
    };

    const cleanup = initializeSocket();
    
    return () => {
      // Executa cleanup dos listeners se retornado
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [token, user, createConnection, setupListeners]);

  // Funções públicas
  const emit = useCallback((event, data) => {
    if (globalSocket?.connected) {
      globalSocket.emit(event, data);
      return true;
    }
    return false;
  }, []);

  const isConnected = useCallback(() => {
    return globalSocket?.connected || false;
  }, []);

  const getSocket = useCallback(() => {
    return globalSocket;
  }, []);

  const reconnect = useCallback(() => {
    if (globalSocket) {
      globalSocket.removeAllListeners();
      globalSocket.disconnect();
      globalSocket = null;
    }
    globalSocketPromise = null;
    connectingInProgress = false;
    
    if (token && user) {
      createConnection(token, user);
    }
  }, [token, user, createConnection]);

  return {
    socket: globalSocket,
    emit,
    isConnected,
    getSocket,
    reconnect,
  };
};

export default useSocket;