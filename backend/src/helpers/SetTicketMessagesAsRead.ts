import { getMessengerBot } from "../libs/messengerBot";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import socketEmit from "./socketEmit";
import Whatsapp from "../models/Whatsapp";
import { StartWhatsAppSessionVerify } from "../services/WbotServices/StartWhatsAppSessionVerify";
import { getIO } from "../libs/socket";

const SetTicketMessagesAsRead = async (ticket: Ticket, force = false): Promise<void> => {
  try {
    logger.info(`[SetTicketMessagesAsRead] Starting process for ticket ${ticket.id}, tenantId: ${ticket.tenantId}, force: ${force}`);

    // Verificar se há mensagens não lidas
    const unreadCount = await Message.count({
      where: {
        ticketId: ticket.id,
        read: false,
        fromMe: false
      }
    });

    logger.info(`[SetTicketMessagesAsRead] Found ${unreadCount} unread messages for ticket ${ticket.id}`);

    if (unreadCount === 0 && !force) {
      logger.info(`[SetTicketMessagesAsRead] No unread messages and force=false, skipping ticket ${ticket.id}`);
      return;
    }

    // Buscar mensagens não lidas com messageId válido
    const unreadMessages = await Message.findAll({
      where: {
        ticketId: ticket.id,
        read: false,
        fromMe: false,
        messageId: {
          [require('sequelize').Op.ne]: null
        }
      },
      order: [["createdAt", "ASC"]], // Ordem cronológica
      limit: 20 // Aumentar limite
    });

    logger.info(`[SetTicketMessagesAsRead] Processing ${unreadMessages.length} messages with valid messageId for ticket ${ticket.id}`);

    // Atualizar mensagens no banco primeiro
    const [updatedCount] = await Message.update(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false,
          fromMe: false
        }
      }
    );

    logger.info(`[SetTicketMessagesAsRead] Updated ${updatedCount} messages in database for ticket ${ticket.id}`);

    // Atualizar contador do ticket
    await ticket.update({ unreadMessages: 0 });
    logger.info(`[SetTicketMessagesAsRead] Updated ticket unreadMessages counter to 0 for ticket ${ticket.id}`);

    // Processar por canal
    logger.info(`[SetTicketMessagesAsRead] Processing channel ${ticket.channel} for ticket ${ticket.id}`);
    if (ticket.channel === "whatsapp") {
      await handleWhatsAppReadReceipt(ticket, unreadMessages);
    } else if (ticket.channel === "messenger") {
      await handleMessengerReadReceipt(ticket);
    } else {
      logger.info(`[SetTicketMessagesAsRead] Channel ${ticket.channel} does not require read receipt processing for ticket ${ticket.id}`);
    }

    // Notificar frontend
    logger.info(`[SetTicketMessagesAsRead] Notifying frontend for ticket ${ticket.id}`);
    await notifyFrontend(ticket);

    logger.info(`[SetTicketMessagesAsRead] Successfully completed for ticket ${ticket.id}`);

  } catch (err: any) {
    logger.error(`[SetTicketMessagesAsRead] Error for ticket ${ticket.id}: ${err?.message || err}`);
    logger.error(`[SetTicketMessagesAsRead] Error stack: ${err?.stack}`);
    throw err;
  }
};

const handleWhatsAppReadReceipt = async (ticket: Ticket, unreadMessages: Message[]): Promise<void> => {
  try {
    const wbot = await GetTicketWbot(ticket);
    
    if (!wbot) {
      logger.warn(`[SetTicketMessagesAsRead] No WhatsApp bot found for ticket ${ticket.id}`);
      return;
    }

    // Verificar estado da sessão
    const sessionState = (wbot as any)?.connection;
    const wsExists = !!(wbot as any)?.ws;
    

    if (sessionState !== 'open') {
      logger.warn(`[SetTicketMessagesAsRead] WhatsApp session not open (${sessionState}) for ticket ${ticket.id}`);
      await attemptReconnection(ticket.whatsappId, 'ERR_WAPP_NOT_INITIALIZED');
      return;
    }

    if (!wsExists) {
      logger.warn(`[SetTicketMessagesAsRead] WhatsApp WS not available for ticket ${ticket.id}`);
      await attemptReconnection(ticket.whatsappId, 'ERR_WAPP_NOT_INITIALIZED');
      return;
    }

    const chatId = ticket.isGroup 
      ? `${ticket.contact.number}@g.us`
      : `${ticket.contact.number}@s.whatsapp.net`;
    

    if (unreadMessages.length === 0) {
      return;
    }

    // Tentar múltiplas estratégias
    const success = await tryReadMessageStrategies(wbot, chatId, unreadMessages);
    
    if (success) {
      logger.info(`[SetTicketMessagesAsRead] Successfully marked messages as read for ${chatId}`);
    } else {
      logger.warn(`[SetTicketMessagesAsRead] All strategies failed for ${chatId}`);
    }

  } catch (err: any) {
    logger.error(`[SetTicketMessagesAsRead] WhatsApp error: ${err?.message || err}`);
    
    // Tentar reconectar se erro de sessão
    if (isSessionError(err)) {
      await attemptReconnection(ticket.whatsappId, err.message);
    }
  }
};

const tryReadMessageStrategies = async (wbot: any, chatId: string, messages: Message[]): Promise<boolean> => {
  // Estratégia 1: readMessages em lotes
  try {
    const messageKeys = messages
      .filter(msg => msg.messageId)
      .map(msg => ({
        remoteJid: chatId,
        id: msg.messageId,
        fromMe: false
      }));

    if (messageKeys.length > 0) {
      // Processar em lotes de 5
      for (let i = 0; i < messageKeys.length; i += 5) {
        const batch = messageKeys.slice(i, i + 5);
        await wbot.readMessages(batch);
        
        // Pequeno delay entre lotes
        if (i + 5 < messageKeys.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      return true;
    }
  } catch (err) {
    logger.warn(`[SetTicketMessagesAsRead] readMessages strategy failed: ${err}`);
  }

  // Estratégia 2: Presença atualizada
  try {
    await wbot.sendPresenceUpdate('available', chatId);
    await new Promise(resolve => setTimeout(resolve, 200));
    await wbot.sendPresenceUpdate('composing', chatId);
    await new Promise(resolve => setTimeout(resolve, 200));
    await wbot.sendPresenceUpdate('paused', chatId);
    logger.info(`[SetTicketMessagesAsRead] Presence strategy completed for ${chatId}`);
    return true;
  } catch (err) {
    logger.warn(`[SetTicketMessagesAsRead] Presence strategy failed: ${err}`);
  }

  // Estratégia 3: Marcar individual
  try {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.messageId) {
      await wbot.readMessages([{
        remoteJid: chatId,
        id: lastMessage.messageId,
        fromMe: false
      }]);
      logger.info(`[SetTicketMessagesAsRead] Individual strategy completed for ${chatId}`);
      return true;
    }
  } catch (err) {
    logger.warn(`[SetTicketMessagesAsRead] Individual strategy failed: ${err}`);
  }

  return false;
};

const handleMessengerReadReceipt = async (ticket: Ticket): Promise<void> => {
  try {
    const messengerBot = getMessengerBot(ticket.whatsappId);
    if (messengerBot && ticket.contact.messengerId) {
      await messengerBot.markSeen(ticket.contact.messengerId);
      logger.info(`[SetTicketMessagesAsRead] Messenger messages marked as seen for ticket ${ticket.id}`);
    }
  } catch (err: any) {
    logger.warn(`[SetTicketMessagesAsRead] Messenger error: ${err?.message || err}`);
  }
};

const attemptReconnection = async (whatsappId: number, reason: string): Promise<void> => {
  try {
    logger.info(`[SetTicketMessagesAsRead] Attempting reconnection for WhatsApp ${whatsappId}`);
    await StartWhatsAppSessionVerify(whatsappId, reason);
    // Aguardar reconexão
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (err) {
    logger.error(`[SetTicketMessagesAsRead] Reconnection failed: ${err}`);
  }
};

const notifyFrontend = async (ticket: Ticket): Promise<void> => {
  try {
    logger.info(`[SetTicketMessagesAsRead] Starting frontend notification for ticket ${ticket.id}, tenantId: ${ticket.tenantId}`);
    
    const ticketReload = await ShowTicketService({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    
    logger.info(`[SetTicketMessagesAsRead] Ticket reloaded successfully for notification, ticket ${ticket.id}`);

    // Emitir múltiplos eventos para garantir atualização
    logger.info(`[SetTicketMessagesAsRead] Emitting ticket:update event for ticket ${ticket.id}`);
    socketEmit({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });

    // Emitir evento chat:messagesRead no canal ticketList
    logger.info(`[SetTicketMessagesAsRead] Emitting chat:messagesRead event for ticket ${ticket.id}`);
    const io = getIO();
    io.to(ticket.tenantId.toString()).emit(`${ticket.tenantId}:ticketList`, {
      type: "chat:messagesRead",
      payload: {
        ticketId: ticket.id,
        unreadMessages: 0
      }
    });
    
    logger.info(`[SetTicketMessagesAsRead] Frontend notification completed successfully for ticket ${ticket.id}`);

  } catch (err: any) {
    logger.error(`[SetTicketMessagesAsRead] Frontend notification error for ticket ${ticket.id}: ${err?.message || err}`);
    logger.error(`[SetTicketMessagesAsRead] Frontend notification error stack: ${err?.stack}`);
  }
};

const isSessionError = (err: any): boolean => {
  const errorMessage = err?.message || err?.toString() || '';
  return errorMessage.includes('ERR_WAPP_NOT_INITIALIZED') ||
         errorMessage.includes('Connection Closed') ||
         errorMessage.includes('session') ||
         errorMessage.includes('disconnected');
};

export default SetTicketMessagesAsRead;