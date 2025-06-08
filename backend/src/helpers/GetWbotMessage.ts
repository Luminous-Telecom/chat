import { Message as WbotMessage } from "whatsapp-web.js";
import Ticket from "../models/Ticket";
import GetTicketWbot from "./GetTicketWbot";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { isSessionClosedError } from "./HandleSessionError";

// Cache para mensagens encontradas (válido por 5 minutos)
const messageCache = new Map<string, { message: WbotMessage; timestamp: number }>();

// Cache para chats (válido por 2 minutos)
const chatCache = new Map<string, { chat: any; timestamp: number }>();

// Função para verificar se a sessão está saudável
const isSessionHealthy = (wbot: any): boolean => {
  try {
    return !!(wbot && wbot.pupPage && !wbot.pupPage.isClosed() && wbot.info && wbot.info.wid);
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

// Função para buscar chat com cache e timeout
const getChatSafely = async (wbot: any, chatId: string): Promise<any | null> => {
  try {
    // Verificar cache primeiro
    const cached = chatCache.get(chatId);
    if (cached && (Date.now() - cached.timestamp) < 2 * 60 * 1000) {
      logger.debug(`Using cached chat for ${chatId}`);
      return cached.chat;
    }

    // Verificar saúde da sessão
    if (!isSessionHealthy(wbot)) {
      logger.warn(`Session unhealthy, cannot get chat ${chatId}`);
      return null;
    }

    const chatPromise = wbot.getChatById(chatId);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout getting chat')), 15000);
    });

    const chat = await Promise.race([chatPromise, timeoutPromise]);
    
    if (chat) {
      // Armazenar no cache
      chatCache.set(chatId, { chat, timestamp: Date.now() });
      logger.debug(`Chat ${chatId} cached successfully`);
    }

    return chat;
  } catch (error: any) {
    logger.error(`Error getting chat ${chatId}: ${error.message}`);
    return null;
  }
};

// Função para buscar mensagens com retry e timeout
const fetchMessagesWithRetry = async (
  chat: any, 
  limit: number, 
  maxRetries: number = 2
): Promise<WbotMessage[]> => {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      attempts++;
      
      const fetchPromise = chat.fetchMessages({ limit });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout fetching ${limit} messages`)), 20000);
      });

      const messages = await Promise.race([fetchPromise, timeoutPromise]);
      logger.debug(`Successfully fetched ${messages.length} messages (limit: ${limit})`);
      return messages;

    } catch (error: any) {
      logger.warn(`Error fetching messages (attempt ${attempts}/${maxRetries}): ${error.message}`);
      
      if (isRecoverableError(error) && attempts < maxRetries) {
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
        continue;
      }
      
      // Se não é recuperável ou esgotou tentativas, propagar erro
      throw error;
    }
  }

  return [];
};

export const GetWbotMessage = async (
  ticket: Ticket,
  messageId: string,
  totalMessages = 100
): Promise<WbotMessage | undefined> => {
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

    const wbot = await GetTicketWbot(ticket);

    // Verificar se a sessão está saudável
    if (!isSessionHealthy(wbot)) {
      logger.warn(`Session unhealthy for ticket ${ticket.id}, skipping message search`);
      return undefined;
    }

    // Construir ID do chat
    const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
    logger.debug(`Getting chat: ${chatId}`);

    // Buscar chat com segurança
    const wbotChat = await getChatSafely(wbot, chatId);
    
    if (!wbotChat) {
      logger.error(`Could not get chat for ticket ${ticket.id}`);
      return undefined;
    }

    // Configuração da busca gradual
    let limit = 20;
    const maxLimit = Math.min(totalMessages, 200); // Limitar máximo para evitar sobrecarga
    const incrementSize = 20;

    const fetchWbotMessagesGradually = async (): Promise<WbotMessage | undefined> => {
      try {
        // Verificar saúde da sessão antes de cada busca
        if (!isSessionHealthy(wbot)) {
          logger.warn(`Session became unhealthy during message search for ticket ${ticket.id}`);
          return undefined;
        }

        logger.debug(`Fetching ${limit} messages for ticket ${ticket.id}`);
        const chatMessages = await fetchMessagesWithRetry(wbotChat, limit);

        if (!chatMessages || chatMessages.length === 0) {
          logger.warn(`No messages returned for ticket ${ticket.id} with limit ${limit}`);
          return undefined;
        }

        // Buscar a mensagem específica
        const msgFound = chatMessages.find(msg => {
          try {
            return msg && msg.id && msg.id.id === messageId;
          } catch (error) {
            logger.warn(`Error checking message ID: ${error}`);
            return false;
          }
        });

        if (msgFound) {
          logger.info(`Message ${messageId} found in ticket ${ticket.id} (searched ${limit} messages)`);
          
          // Armazenar no cache
          messageCache.set(cacheKey, { message: msgFound, timestamp: Date.now() });
          
          return msgFound;
        }

        // Se não encontrou e ainda há margem para buscar mais
        if (limit < maxLimit) {
          limit = Math.min(limit + incrementSize, maxLimit);
          logger.debug(`Message not found, increasing limit to ${limit} for ticket ${ticket.id}`);
          
          // Pequena pausa para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 500));
          
          return fetchWbotMessagesGradually();
        }

        logger.warn(`Message ${messageId} not found in ${maxLimit} messages for ticket ${ticket.id}`);
        return undefined;

      } catch (error: any) {
        if (isRecoverableError(error)) {
          logger.warn(`Recoverable error during message search for ticket ${ticket.id}: ${error.message}`);
          return undefined;
        }
        
        logger.error(`Error in fetchWbotMessagesGradually for ticket ${ticket.id}: ${error.message}`);
        throw error;
      }
    };

    const msgFound = await fetchWbotMessagesGradually();
    
    const duration = Date.now() - startTime;
    logger.info(`Message search completed for ticket ${ticket.id} in ${duration}ms`);
    
    return msgFound;

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
  const chatMaxAge = 2 * 60 * 1000; // 2 minutos
  
  let messagesCleaned = 0;
  let chatsCleaned = 0;
  
  // Limpar cache de mensagens
  for (const [key, cached] of messageCache.entries()) {
    if (now - cached.timestamp > messageMaxAge) {
      messageCache.delete(key);
      messagesCleaned++;
    }
  }
  
  // Limpar cache de chats
  for (const [key, cached] of chatCache.entries()) {
    if (now - cached.timestamp > chatMaxAge) {
      chatCache.delete(key);
      chatsCleaned++;
    }
  }
  
  if (messagesCleaned > 0 || chatsCleaned > 0) {
    logger.debug(`Cleaned up ${messagesCleaned} cached messages and ${chatsCleaned} cached chats`);
  }
};

// Executar limpeza a cada 3 minutos
setInterval(cleanupMessageCache, 3 * 60 * 1000);

export default GetWbotMessage;