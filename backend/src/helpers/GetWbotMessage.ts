import { proto, WASocket } from "@whiskeysockets/baileys";
import Ticket from "../models/Ticket";
import GetTicketWbot from "./GetTicketWbot";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { isSessionClosedError } from "./HandleSessionError";
import Message from "../models/Message";
import { Op } from "sequelize";

// Cache para mensagens encontradas (válido por 5 minutos)
const messageCache = new Map<string, { message: proto.IWebMessageInfo; timestamp: number }>();

// Função para verificar se a sessão está saudável
const isSessionHealthy = (wbot: WASocket): boolean => {
  try {
    return !!(wbot && wbot.user && wbot.user.id);
  } catch (error) {
    return false;
  }
};

// Função para verificar se o erro é recuperável
const isRecoverableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  const recoverablePatterns = [
    'evaluation failed',
    'minified invariant',
    'protocol error',
    'target closed',
    'navigation',
    'timeout',
    'cannot read properties of undefined',
    'execution context was destroyed'
  ];
  
  return recoverablePatterns.some(pattern => message.includes(pattern));
};

// Função para converter Message do banco para proto.IWebMessageInfo
const convertToWebMessageInfo = (message: Message): proto.IWebMessageInfo => {
  // Construir o remoteJid usando o número do contato
  const remoteJid = message.contact?.number 
    ? `${message.contact.number}@${message.ticket?.isGroup ? "g" : "s"}.whatsapp.net`
    : undefined;

  return {
    key: {
      id: message.messageId || '',
      remoteJid: remoteJid || '',
      fromMe: message.fromMe
    },
    message: {
      conversation: message.body || undefined,
      imageMessage: message.mediaType === 'image' ? {} : undefined,
      videoMessage: message.mediaType === 'video' ? {} : undefined,
      audioMessage: message.mediaType === 'audio' ? {} : undefined,
      documentMessage: message.mediaType === 'document' ? {} : undefined,
      stickerMessage: message.mediaType === 'sticker' ? {} : undefined,
      extendedTextMessage: message.quotedMsgId ? {
        text: message.body || '',
        contextInfo: {
          quotedMessage: {
            conversation: message.quotedMsg?.body || ''
          },
          stanzaId: message.quotedMsgId
        }
      } : undefined
    },
    messageTimestamp: message.createdAt ? Math.floor(message.createdAt.getTime() / 1000) : undefined,
    pushName: message.contact?.name || undefined
  };
};

export const GetWbotMessage = async (
  ticket: Ticket,
  messageId: string,
  totalMessages = 100
): Promise<proto.IWebMessageInfo | undefined> => {
  const startTime = Date.now();
  
  try {
    // Validar parâmetros
    if (!ticket || !messageId) {
      logger.warn('Invalid parameters provided to GetWbotMessage');
      return undefined;
    }

    if (!ticket.contact || !ticket.contact.number) {
      logger.warn(`Invalid contact data for ticket ${ticket.id}`);
      return undefined;
    }

    // Verificar cache de mensagem primeiro
    const cacheKey = `${ticket.id}-${messageId}`;
    const cached = messageCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 5 * 60 * 1000) {
      logger.debug(`Using cached message for ${messageId}`);
      return cached.message;
    }

    logger.info(`Searching for message ${messageId} in ticket ${ticket.id}`);

    // Buscar mensagem no banco de dados
    const message = await Message.findOne({
      where: {
        messageId: messageId,
        ticketId: ticket.id
      },
      include: [
        {
          model: Message,
          as: 'quotedMsg',
          include: ['contact']
        },
        'contact'
      ]
    });

    if (!message) {
      logger.warn(`Message ${messageId} not found in database for ticket ${ticket.id}`);
      return undefined;
    }

    // Converter para formato do Baileys
    const webMessageInfo = convertToWebMessageInfo(message);
    
    // Armazenar no cache
    messageCache.set(cacheKey, { message: webMessageInfo, timestamp: Date.now() });
    
    const duration = Date.now() - startTime;
    logger.info(`Message search completed for ticket ${ticket.id} in ${duration}ms`);
    
    return webMessageInfo;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    if (isSessionClosedError(error)) {
      logger.warn(`Session closed during message search for ticket ${ticket.id} after ${duration}ms`);
      return undefined;
    }
    
    if (isRecoverableError(error)) {
      logger.warn(`Recoverable error in GetWbotMessage for ticket ${ticket.id} after ${duration}ms: ${error.message}`);
      return undefined;
    }
    
    logger.error(`Critical error in GetWbotMessage for ticket ${ticket.id} after ${duration}ms: ${error.message}`);
    throw new AppError("ERR_FETCH_WAPP_MSG");
  }
};

// Função para limpeza periódica do cache
export const cleanupMessageCache = (): void => {
  const now = Date.now();
  const messageMaxAge = 5 * 60 * 1000; // 5 minutos
  
  let messagesCleaned = 0;
  
  // Limpar cache de mensagens
  for (const [key, cached] of messageCache.entries()) {
    if (now - cached.timestamp > messageMaxAge) {
      messageCache.delete(key);
      messagesCleaned++;
    }
  }
  
  if (messagesCleaned > 0) {
    logger.debug(`Cleaned up ${messagesCleaned} cached messages`);
  }
};

// Executar limpeza a cada 3 minutos
setInterval(cleanupMessageCache, 3 * 60 * 1000);

export default GetWbotMessage;