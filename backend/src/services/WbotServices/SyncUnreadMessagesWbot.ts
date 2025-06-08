import { Client } from "whatsapp-web.js";
import Queue from "../../libs/Queue";
import { logger } from "../../utils/logger";
import { isSessionClosedError } from "../../helpers/HandleSessionError";
import VerifyStepsChatFlowTicket from "../ChatFlowServices/VerifyStepsChatFlowTicket";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import VerifyContact from "./helpers/VerifyContact";
import VerifyMediaMessage from "./helpers/VerifyMediaMessage";
import VerifyMessage from "./helpers/VerifyMessage";
import AppError from "../../errors/AppError";
import { getIO } from "../../libs/socket";

interface Session extends Client {
  id?: number;
}

// Cache para evitar processamento desnecessário
const processingCache = new Map<string, number>();
// Cache para rastrear tentativas consecutivas de erro
const errorAttempts = new Map<string, number>();
// Cache para rastrear últimos erros críticos
const lastCriticalError = new Map<string, number>();

// Função para verificar se a sessão está saudável
const isSessionHealthy = async (wbot: Session): Promise<boolean> => {
  try {
    if (!wbot || !wbot.pupPage || wbot.pupPage.isClosed()) {
      return false;
    }

    if (!wbot.info || !wbot.info.wid) {
      return false;
    }

    // Verificar se a página está responsiva testando elementos básicos do WhatsApp Web
    const isResponsive = await Promise.race([
      wbot.pupPage.evaluate(() => {
        // Verificar se elementos básicos do WhatsApp Web estão presentes
        return document.querySelector('[data-testid="app"]') !== null ||
               document.querySelector('#app') !== null ||
               document.querySelector('.app') !== null ||
               typeof (window as any).Store !== 'undefined';
      }),
      new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('Page not responsive')), 3000)
      )
    ]).catch(() => false);

    return isResponsive;
  } catch (error) {
    return false;
  }
};

// Função para aguardar com verificação de saúde da sessão
const safeDelay = async (ms: number, wbot: Session): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, ms));
  return await isSessionHealthy(wbot);
};

// Função para verificar se deve pular sincronização devido a erros recentes
const shouldSkipDueToErrors = (wbot: Session): boolean => {
  const cacheKey = `${wbot.id}`;
  const recentErrorTime = lastCriticalError.get(cacheKey);
  const errorCount = errorAttempts.get(cacheKey) || 0;
  
  // Se teve erro crítico nos últimos 5 minutos e já teve 3+ erros, pular
  if (recentErrorTime && (Date.now() - recentErrorTime) < 5 * 60 * 1000 && errorCount >= 3) {
    logger.warn(`Skipping sync for ${wbot.id} due to recent critical errors (${errorCount} attempts)`);
    return true;
  }
  
  // Resetar contador se passou tempo suficiente
  if (recentErrorTime && (Date.now() - recentErrorTime) > 10 * 60 * 1000) {
    errorAttempts.delete(cacheKey);
    lastCriticalError.delete(cacheKey);
  }
  
  return false;
};

// Função para registrar erro crítico
const recordCriticalError = (wbot: Session): void => {
  const cacheKey = `${wbot.id}`;
  const currentCount = errorAttempts.get(cacheKey) || 0;
  errorAttempts.set(cacheKey, currentCount + 1);
  lastCriticalError.set(cacheKey, Date.now());
};

const SyncUnreadMessagesWbot = async (
  wbot: Session,
  tenantId: number | string
): Promise<void> => {
  try {
    // Verificar se deve pular devido a erros recentes
    if (shouldSkipDueToErrors(wbot)) {
      return;
    }

    // Verificações de segurança aprimoradas
    if (!(await isSessionHealthy(wbot))) {
      logger.warn('WhatsApp session is not healthy, skipping message synchronization');
      return;
    }

    // Verificar se já está processando para evitar duplicação
    const cacheKey = `${wbot.id}-${tenantId}`;
    const lastProcessing = processingCache.get(cacheKey);
    if (lastProcessing && (Date.now() - lastProcessing) < 45000) { // Aumentado para 45s
      logger.info(`Skipping sync for ${wbot.id} - already processed recently`);
      return;
    }
    processingCache.set(cacheKey, Date.now());

    logger.info(`Starting message sync for WhatsApp ${wbot.id}`);

    // Aguardar mais tempo para estabilização
    if (!(await safeDelay(4000, wbot))) { // Aumentado para 4s
      logger.warn('Session became unhealthy during initialization delay');
      return;
    }

    // Buscar chats com timeout maior e retry
    let chats: any[] = [];
    let chatAttempts = 0;
    const maxChatAttempts = 2;

    while (chatAttempts < maxChatAttempts && chats.length === 0) {
      try {
        chatAttempts++;
        logger.info(`Attempting to get chats (attempt ${chatAttempts})`);
        
        // Verificar saúde da sessão antes de cada tentativa
        if (!(await isSessionHealthy(wbot))) {
          logger.warn('Session unhealthy before getting chats');
          return;
        }
        
        const chatsPromise = wbot.getChats();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout getting chats')), 45000); // Aumentado para 45s
        });

        chats = await Promise.race([chatsPromise, timeoutPromise]) as any[];
        
        // Validar e filtrar chats de forma mais robusta
        if (chats && Array.isArray(chats)) {
          const originalLength = chats.length;
          chats = chats.filter(chat => {
            try {
              // Verificações mais detalhadas
              if (!chat || typeof chat !== 'object') return false;
              if (!chat.id || !chat.id._serialized) return false;
              if (typeof chat.unreadCount === 'undefined' || chat.unreadCount === null) return false;
              if (typeof chat.isGroup === 'undefined' || chat.isGroup === null) return false;
              
              // Verificar se não é status broadcast
              if (chat.id._serialized === 'status@broadcast') return false;
              
              // Verificar propriedades que podem causar problemas
              if (chat.groupMetadata && typeof chat.groupMetadata !== 'object') return false;
              
              // Verificar se o chat tem estrutura válida
              if (chat.name === null || chat.name === undefined) {
                // Chats válidos podem ter name null, mas devem ter outras propriedades
                if (!chat.id || !chat.id.user) return false;
              }
              
              return true;
            } catch (filterError: any) {
              logger.warn(`Invalid chat object detected and filtered: ${filterError.message}`);
              return false;
            }
          });
          
          if (originalLength !== chats.length) {
            logger.info(`Filtered ${originalLength - chats.length} invalid chats from ${originalLength} total`);
          }
          
          if (chats.length > 0) {
            logger.info(`Successfully retrieved ${chats.length} valid chats`);
            break;
          }
        }
        
        // Delay entre tentativas
        if (chatAttempts < maxChatAttempts) {
          if (!(await safeDelay(3000, wbot))) { // Aumentado para 3s
            logger.warn('Session became unhealthy during retry delay');
            return;
          }
        }
        
      } catch (error: any) {
        // Mudando de warn para debug para erros esperados de participantes
        if (error.message && (
          error.message.includes('participants') || 
          error.message.includes('Cannot read properties of undefined') ||
          error.message.includes('Evaluation failed')
        )) {
          logger.debug(`Expected sync error (skipping): ${error.message}`);
          return;
        }
        
        // Mantendo warn para outros tipos de erro
        logger.warn(`Error getting chats (attempt ${chatAttempts}): ${error.message}`);
        
        if (error.message && (
          error.message.includes('Protocol error') ||
          error.message.includes('Target closed')
        )) {
          logger.error('WhatsApp session error detected - recording critical error and skipping sync');
          recordCriticalError(wbot);
          return;
        }
        
        if (chatAttempts === maxChatAttempts) {
          recordCriticalError(wbot);
          throw error;
        }
        
        // Delay maior entre tentativas em caso de erro
        if (!(await safeDelay(5000, wbot))) { // Aumentado para 5s
          logger.warn('Session became unhealthy during error recovery delay');
          return;
        }
      }
    }
    
    if (!chats || chats.length === 0) {
      logger.info(`No chats found for WhatsApp ${wbot.id}`);
      return;
    }

    // Filtrar chats válidos com verificações adicionais
    const validChats = chats.filter(chat => {
      try {
        return chat && 
               typeof chat.unreadCount === 'number' && 
               chat.unreadCount > 0 && 
               chat.isGroup === false &&
               chat.id &&
               chat.id._serialized &&
               chat.id._serialized !== 'status@broadcast' &&
               !chat.id._serialized.includes('@g.us'); // Extra verificação para grupos
      } catch (error: any) {
        logger.warn(`Invalid chat object found: ${error.message}`);
        return false;
      }
    });
    
    if (validChats.length === 0) {
      logger.info(`No valid unread chats for WhatsApp ${wbot.id}`);
      return;
    }

    // Limitar número de chats processados por ciclo para evitar sobrecarga
    const maxChatsPerCycle = 5;
    const chatsToProcess = validChats.slice(0, maxChatsPerCycle);
    
    if (validChats.length > maxChatsPerCycle) {
      logger.info(`Limiting processing to ${maxChatsPerCycle} chats (${validChats.length} total with unread messages)`);
    } else {
      logger.info(`Processing ${chatsToProcess.length} valid chats with unread messages`);
    }

    // Processar chats sequencialmente para reduzir carga
    for (let i = 0; i < chatsToProcess.length; i++) {
      const chat = chatsToProcess[i];
      
      // Verificar saúde da sessão antes de cada chat
      if (!(await isSessionHealthy(wbot))) {
        logger.warn('Session became unhealthy during chat processing, stopping sync');
        break;
      }
      
      try {
        await processChatMessages(chat, wbot, tenantId);
        
        // Resetar contador de erros em caso de sucesso
        if (i === 0) { // Reset apenas no primeiro sucesso para não fazer muito frequentemente
          const errorKey = `${wbot.id}`;
          if (errorAttempts.get(errorKey)) {
            logger.info(`Resetting error counter for ${wbot.id} after successful processing`);
            errorAttempts.delete(errorKey);
          }
        }
        
      } catch (error: any) {
        logger.error(`Error processing chat ${chat.id?._serialized || 'unknown'}:`, error.message);
        
        // Se for erro crítico, parar o processamento e registrar
        if (error.message && (
          error.message.includes('participants') || 
          error.message.includes('Cannot read properties of undefined') ||
          error.message.includes('Evaluation failed') ||
          error.message.includes('Protocol error') ||
          error.message.includes('Target closed')
        )) {
          logger.error('Critical error detected, stopping sync to preserve session');
          recordCriticalError(wbot);
          break;
        }
      }

      // Pausa maior entre chats para não sobrecarregar
      if (i < chatsToProcess.length - 1) {
        if (!(await safeDelay(2000, wbot))) { // Aumentado para 2s
          logger.warn('Session became unhealthy during inter-chat delay');
          break;
        }
      }
    }

    logger.info(`Message sync completed for WhatsApp ${wbot.id}`);

  } catch (error: any) {
    if (isSessionClosedError(error)) {
      logger.warn('Session closed during message synchronization, ignoring error');
      return;
    }
    
    // Tratar erros que podem danificar a sessão
    if (error.message && (
      error.message.includes('participants') ||
      error.message.includes('Evaluation failed') ||
      error.message.includes('Cannot read properties of undefined') ||
      error.message.includes('Protocol error') ||
      error.message.includes('Target closed')
    )) {
      logger.error('Critical WhatsApp error detected - preserving session stability');
      recordCriticalError(wbot);
      return;
    }
    
    logger.error("Erro ao sincronizar mensagens:", error);
  } finally {
    // Limpar cache após processamento (tempo maior)
    const cacheKey = `${wbot.id}-${tenantId}`;
    setTimeout(() => {
      processingCache.delete(cacheKey);
    }, 90000); // Aumentado para 90s
  }
};

// Função para processar mensagens de cada chat com melhorias
const processChatMessages = async (
  chat: any,
  wbot: Session,
  tenantId: number | string
): Promise<void> => {
  try {
    // Verificações de segurança aprimoradas
    if (!chat || !chat.id || !chat.id._serialized) {
      logger.warn('Invalid chat object provided');
      return;
    }

    if (chat.unreadCount === 0 || chat.isGroup) {
      return;
    }

    // Verificar se não é chat de status
    if (chat.id._serialized === 'status@broadcast') {
      logger.debug('Skipping status broadcast chat');
      return;
    }

    // Verificar saúde da sessão
    if (!(await isSessionHealthy(wbot))) {
      logger.warn('Session unhealthy, skipping chat processing');
      return;
    }

    logger.info(`Processing chat ${chat.id._serialized} with ${chat.unreadCount} unread messages`);

    // Limitar número de mensagens por chat para evitar sobrecarga
    const maxMessagesPerChat = 10;
    const messagesToFetch = Math.min(chat.unreadCount, maxMessagesPerChat);
    
    if (chat.unreadCount > maxMessagesPerChat) {
      logger.info(`Limiting to ${maxMessagesPerChat} messages for chat ${chat.id._serialized} (${chat.unreadCount} total unread)`);
    }

    // Buscar mensagens com timeout maior e menos tentativas
    let unreadMessages: any[] = [];
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts && unreadMessages.length === 0) {
      try {
        attempts++;
        
        // Verificar saúde antes de cada tentativa
        if (!(await isSessionHealthy(wbot))) {
          logger.warn('Session became unhealthy during message fetch');
          return;
        }
        
        const messagesPromise = chat.fetchMessages({
          limit: messagesToFetch
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout fetching messages')), 20000); // Aumentado para 20s
        });

        unreadMessages = await Promise.race([messagesPromise, timeoutPromise]) as any[];
        
        if (unreadMessages && unreadMessages.length > 0) {
          break;
        }
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Aumentado para 3s
        }
        
      } catch (error: any) {
        logger.warn(`Error fetching messages for chat ${chat.id._serialized} (attempt ${attempts}): ${error.message}`);
        
        // Verificar erros críticos
        if (error.message && (
          error.message.includes('participants') || 
          error.message.includes('Cannot read properties of undefined') ||
          error.message.includes('Evaluation failed') ||
          error.message.includes('Protocol error') ||
          error.message.includes('Target closed')
        )) {
          logger.error(`Critical error for chat ${chat.id._serialized} - aborting to protect session`);
          throw error; // Propagar erro crítico
        }
        
        if (attempts === maxAttempts) {
          logger.error(`Max attempts reached for chat ${chat.id._serialized} - skipping`);
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000)); // Aumentado para 3s
      }
    }

    if (!unreadMessages || unreadMessages.length === 0) {
      logger.info(`No messages fetched for chat ${chat.id._serialized}`);
      return;
    }

    // Verificar contato com timeout maior
    let chatContact: any;
    let contact: any;
    
    try {
      const contactPromise = chat.getContact();
      const contactTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout getting contact')), 15000); // Aumentado para 15s
      });
      
      chatContact = await Promise.race([contactPromise, contactTimeout]);
      
      if (!chatContact) {
        logger.warn(`Could not get contact for chat ${chat.id._serialized}`);
        return;
      }
      
      contact = await VerifyContact(chatContact, tenantId);
      if (!contact) {
        logger.warn(`Could not verify contact for chat ${chat.id._serialized}`);
        return;
      }
    } catch (error: any) {
      logger.error(`Error getting contact for chat ${chat.id._serialized}: ${error.message}`);
      return;
    }
    
    const ticket = await FindOrCreateTicketService({
      contact,
      whatsappId: wbot.id!,
      unreadMessages: chat.unreadCount,
      tenantId,
      isSync: true,
      channel: "whatsapp"
    });

    // Pular se for mensagem de campanha ou despedida
    if (ticket?.isCampaignMessage || ticket?.isFarewellMessage) {
      return;
    }

    // Processar mensagens com delay entre elas
    const apiConfig: any = ticket.apiConfig || {};
    const hasWebhook = apiConfig?.externalKey && apiConfig?.urlMessageStatus;

    for (let idx = 0; idx < unreadMessages.length; idx++) {
      const msg = unreadMessages[idx];
      
      // Verificar saúde da sessão durante processamento de mensagens
      if (!(await isSessionHealthy(wbot))) {
        logger.warn('Session became unhealthy during message processing');
        break;
      }
      
      try {
        if (msg.hasMedia) {
          await VerifyMediaMessage(msg, ticket, contact);
        } else {
          await VerifyMessage(msg, ticket, contact);
        }

        // Processar webhook e chatflow apenas na última mensagem
        if (idx === unreadMessages.length - 1) {
          // Processar chatflow de forma assíncrona
          setImmediate(async () => {
            try {
              await VerifyStepsChatFlowTicket(msg, ticket);
            } catch (error: any) {
              logger.error(`Error in chatflow for message ${msg.id?.id}:`, error);
            }
          });

          // Processar webhook se necessário
          if (!msg.fromMe && !ticket.isGroup && !ticket.answered && hasWebhook) {
            const payload = {
              timestamp: Date.now(),
              msg: {
                id: msg.id,
                body: msg.body,
                from: msg.from,
                timestamp: msg.timestamp,
                type: msg.type
              },
              messageId: msg.id.id,
              ticketId: ticket.id,
              externalKey: apiConfig.externalKey,
              authToken: apiConfig.authToken,
              type: "hookMessage"
            };

            // Adicionar à fila de forma assíncrona
            setImmediate(() => {
              Queue.add("WebHooksAPI", {
                url: apiConfig.urlMessageStatus,
                type: payload.type,
                payload
              });
            });
          }
        }

        // Pequeno delay entre mensagens para não sobrecarregar
        if (idx < unreadMessages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Aumentado para 300ms
        }

      } catch (error: any) {
        logger.error(`Error processing message ${msg.id?.id}:`, error);
        // Continuar processando outras mensagens
      }
    }

  } catch (error: any) {
    logger.error(`Error in processChatMessages for chat ${chat.id?._serialized}:`, error);
    throw error;
  }
};

// Função para limpeza periódica de cache (chamar em um cron job)
export const cleanupSyncCache = (): void => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutos
  
  // Limpar cache de processamento antigo
  for (const [key, timestamp] of processingCache.entries()) {
    if (now - timestamp > maxAge) {
      processingCache.delete(key);
    }
  }
  
  // Limpar erros muito antigos (mais de 1 hora)
  const errorMaxAge = 60 * 60 * 1000;
  for (const [key, timestamp] of lastCriticalError.entries()) {
    if (now - timestamp > errorMaxAge) {
      errorAttempts.delete(key);
      lastCriticalError.delete(key);
    }
  }
  
  logger.debug('Sync cache cleanup completed');
};

export default SyncUnreadMessagesWbot;