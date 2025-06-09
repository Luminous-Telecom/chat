import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { 
  setQueueTicketCounts, 
  updateQueueCount, 
  addNotification,
  incrementTicketUnreadCount,
  clearTicketUnreadCount
} from '../store/notificationSlice';

// SINGLETON para prevenir múltiplas conexões
let globalSocket = null;
let globalSocketPromise = null;
let connectingInProgress = false;
let socketListeners = new Map(); // Novo: Mapa para controlar listeners registrados

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
    const socketUrl = process.env.REACT_APP_BACKEND_URL;

    if (!socketUrl) {
      throw new Error('REACT_APP_BACKEND_URL não está configurada');
    }

    globalSocketPromise = new Promise((resolve, reject) => {
      // Limpa socket anterior se existir
      if (globalSocket) {
        // Remover todos os listeners antes de desconectar
        socketListeners.forEach((handler, event) => {
          globalSocket.off(event, handler);
        });
        socketListeners.clear();
        
        globalSocket.disconnect();
        globalSocket = null;
      }

      try {
        globalSocket = io(socketUrl, {
          auth: { token: socketToken },
          transports: ['websocket'], // Forçar apenas websocket
          reconnection: true,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          reconnectionAttempts: 5,
          timeout: 15000,
          upgrade: false, // Desabilitar upgrade
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

    // Cache para evitar processamento duplicado de mensagens
    const processedMessages = new Set();

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
      window.dispatchEvent(new CustomEvent('whatsappSessionUpdate', { detail: data }));
    };

    const handleNewMessage = (message) => {
      if (!isMountedRef.current) return;
      
      // Verificar se a mensagem já foi processada
      if (processedMessages.has(message.id)) {
        return;
      }
      
      // Adicionar mensagem ao cache
      processedMessages.add(message.id);
      
      // Limpar cache após 5 segundos
      setTimeout(() => {
        processedMessages.delete(message.id);
      }, 5000);
      
      // Emitir evento customizado para atualizar o ticket
      window.dispatchEvent(new CustomEvent('ticketUpdate', { 
        detail: { 
          ticketId: message.ticketId,
          lastMessage: message.body,
          lastMessageAt: message.createdAt,
          lastMessageFromMe: message.fromMe,
          lastMessageStatus: message.status
        }
      }));

      // Incrementar contador se a mensagem não for do usuário e não estiver lida
      if (!message.fromMe && !message.read) {
        dispatch(incrementTicketUnreadCount(message.ticketId));
      }
    };

    const handleMessageRead = (data) => {
      if (!isMountedRef.current) return;
      
      if (data.ticketId && data.allRead) {
        dispatch(clearTicketUnreadCount(data.ticketId));
      }
    };

    // Registrar listeners no mapa global
    const listeners = {
      'ticket:count': handleTicketCount,
      'ticket:update': handleTicketUpdate,
      'notification': handleNotification,
      'ticket:new': handleTicketNew,
      'message:new': handleNewMessage,
      'message:read': handleMessageRead
    };

    // Adicionar listeners apenas se não existirem
    Object.entries(listeners).forEach(([event, handler]) => {
      if (!socketListeners.has(event)) {
        socket.on(event, handler);
        socketListeners.set(event, handler);
      }
    });

    // Listener específico do tenant
    if (user?.tenantId) {
      const tenantEvent = `${user.tenantId}:whatsappSession`;
      if (!socketListeners.has(tenantEvent)) {
        socket.on(tenantEvent, handleWhatsappSession);
        socketListeners.set(tenantEvent, handleWhatsappSession);
      }
    }

    // Cleanup quando componente desmonta
    return () => {
      if (socket) {
        // Remover apenas os listeners registrados por este componente
        Object.entries(listeners).forEach(([event, handler]) => {
          if (socketListeners.get(event) === handler) {
            socket.off(event, handler);
            socketListeners.delete(event);
          }
        });

        if (user?.tenantId) {
          const tenantEvent = `${user.tenantId}:whatsappSession`;
          if (socketListeners.get(tenantEvent) === handleWhatsappSession) {
            socket.off(tenantEvent, handleWhatsappSession);
            socketListeners.delete(tenantEvent);
          }
        }
      }
    };
  }, [dispatch, user?.tenantId]);

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