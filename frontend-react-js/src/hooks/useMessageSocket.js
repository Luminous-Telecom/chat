import { useEffect, useCallback } from 'react';
import useSocket from './useSocket';

/**
 * Hook para gerenciar eventos de mensagens via socket
 * @param {Object} ticket - Ticket atual
 * @param {Function} onNewMessage - Callback para nova mensagem
 * @param {Function} onMessageUpdate - Callback para atualização de mensagem
 * @param {Function} onTypingIndicator - Callback para indicador de digitação
 */
const useMessageSocket = (ticket, onNewMessage, onMessageUpdate, onTypingIndicator) => {
  const { socket, emit } = useSocket();

  // Função para entrar na sala do ticket
  const joinTicketRoom = useCallback((ticketId) => {
    if (socket && ticketId) {
      emit('ticket:join', ticketId);
    }
  }, [socket, emit]);

  // Função para sair da sala do ticket
  const leaveTicketRoom = useCallback((ticketId) => {
    if (socket && ticketId) {
      emit('ticket:leave', ticketId);
    }
  }, [socket, emit]);

  // Função para enviar indicador de digitação
  const sendTypingIndicator = useCallback((ticketId, isTyping) => {
    if (socket && ticketId) {
      emit('message:typing', {
        ticketId,
        isTyping,
        fromMe: true
      });
    }
  }, [socket, emit]);

  // Função para marcar mensagem como lida
  const markMessageAsRead = useCallback((messageId, ticketId) => {
    if (socket && messageId && ticketId) {
      emit('message:read', {
        messageId,
        ticketId
      });
    }
  }, [socket, emit]);

  // Função para enviar nova mensagem via socket
  const sendMessage = useCallback((ticketId, message) => {
    if (socket && ticketId && message) {
      emit('message:send', {
        ticketId,
        message
      });
    }
  }, [socket, emit]);

  // Setup dos event listeners
  useEffect(() => {
    if (!socket || !ticket?.id) return;

    const handleNewMessage = (message) => {
      if (message.ticketId === ticket.id && onNewMessage) {
        onNewMessage(message);
      }
    };

    const handleMessageUpdate = (updatedMessage) => {
      if (updatedMessage.ticketId === ticket.id && onMessageUpdate) {
        onMessageUpdate(updatedMessage);
      }
    };

    const handleTypingIndicator = (data) => {
      if (data.ticketId === ticket.id && onTypingIndicator) {
        onTypingIndicator(data);
      }
    };

    // Registrar event listeners
    socket.on('message:new', handleNewMessage);
    socket.on('message:update', handleMessageUpdate);
    socket.on('message:typing', handleTypingIndicator);

    // Join na sala do ticket
    joinTicketRoom(ticket.id);

    // Cleanup
    return () => {
      if (socket) {
        socket.off('message:new', handleNewMessage);
        socket.off('message:update', handleMessageUpdate);
        socket.off('message:typing', handleTypingIndicator);
        leaveTicketRoom(ticket.id);
      }
    };
  }, [socket, ticket?.id, onNewMessage, onMessageUpdate, onTypingIndicator, joinTicketRoom, leaveTicketRoom]);

  return {
    socket,
    joinTicketRoom,
    leaveTicketRoom,
    sendTypingIndicator,
    markMessageAsRead,
    sendMessage,
    isConnected: socket?.connected || false
  };
};

export default useMessageSocket;