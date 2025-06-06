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

const SyncUnreadMessagesWbot = async (
  wbot: Session,
  tenantId: number | string
): Promise<void> => {
  try {
    // Verificações de segurança
    if (!wbot || !wbot.pupPage || wbot.pupPage.isClosed()) {
      logger.warn('WhatsApp session is closed, skipping message synchronization');
      return;
    }

    // Verificar se a sessão está realmente pronta
    if (!wbot.info || !wbot.info.wid) {
      logger.warn('WhatsApp session not fully initialized, skipping sync');
      return;
    }

    // Verificar se já está processando para evitar duplicação
    const cacheKey = `${wbot.id}-${tenantId}`;
    const lastProcessing = processingCache.get(cacheKey);
    if (lastProcessing && (Date.now() - lastProcessing) < 10000) {
      logger.info(`Skipping sync for ${wbot.id} - already processed recently`);
      return;
    }
    processingCache.set(cacheKey, Date.now());

    logger.info(`Starting message sync for WhatsApp ${wbot.id}`);

    // Aguardar um pouco antes de buscar chats
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Buscar chats com múltiplas tentativas
    let chats: any[] = [];
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && chats.length === 0) {
      try {
        attempts++;
        logger.info(`Attempting to get chats (attempt ${attempts}/${maxAttempts})`);
        
        // Aguardar um pouco mais antes de tentar buscar chats
        if (attempts > 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        const chatsPromise = wbot.getChats();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout getting chats')), 15000);
        });

        chats = await Promise.race([chatsPromise, timeoutPromise]) as any[];
        
        // Validar se os chats retornados são válidos
        if (chats && Array.isArray(chats)) {
          // Filtrar chats inválidos que podem causar o erro de participants
          chats = chats.filter(chat => {
            try {
              // Verificar se o chat tem as propriedades básicas necessárias
              return chat && 
                     typeof chat === 'object' &&
                     chat.id &&
                     chat.id._serialized &&
                     typeof chat.unreadCount !== 'undefined' &&
                     typeof chat.isGroup !== 'undefined';
            } catch (filterError: any) {
              logger.warn(`Invalid chat object detected and filtered: ${filterError.message}`);
              return false;
            }
          });
          
          if (chats.length > 0) {
            logger.info(`Successfully retrieved ${chats.length} valid chats`);
            break;
          }
        }
        
        // Aguardar antes da próxima tentativa
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error: any) {
        logger.warn(`Error getting chats (attempt ${attempts}): ${error.message}`);
        
        // Se o erro contém 'participants', é o erro específico que estamos tentando resolver
        if (error.message && error.message.includes('participants')) {
          logger.error('Detected participants error - WhatsApp session may be unstable');
          
          // Aguardar mais tempo antes de tentar novamente
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        } else {
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
        if (attempts === maxAttempts) {
          // Se for erro de participants, não fazer throw para evitar crash
          if (error.message && error.message.includes('participants')) {
            logger.error('Max attempts reached with participants error - skipping chat sync to prevent crash');
            return;
          }
          throw error;
        }
      }
    }
    
    if (!chats || chats.length === 0) {
      logger.info(`No chats found for WhatsApp ${wbot.id} after ${maxAttempts} attempts`);
      return;
    }

    // Validar chats antes de filtrar
    const validChats = chats.filter(chat => {
      try {
        return chat && 
               typeof chat.unreadCount === 'number' && 
               chat.unreadCount > 0 && 
               chat.isGroup === false &&
               chat.id &&
               chat.id._serialized;
      } catch (error: any) {
        logger.warn(`Invalid chat object found: ${error.message}`);
        return false;
      }
    });
    
    if (validChats.length === 0) {
      logger.info(`No valid unread chats for WhatsApp ${wbot.id}`);
      return;
    }

    logger.info(`Processing ${validChats.length} valid chats with unread messages`);

    // Processar chats em lotes menores
    const batchSize = 3;
    for (let i = 0; i < validChats.length; i += batchSize) {
      const batch = validChats.slice(i, i + batchSize);
      
      // Verificar se a sessão ainda está ativa
      if (!wbot.pupPage || wbot.pupPage.isClosed()) {
        logger.warn('Session closed during batch processing, stopping sync');
        break;
      }
      
      await Promise.all(
        batch.map(async (chat) => {
          try {
            await processChatMessages(chat, wbot, tenantId);
          } catch (error: any) {
            logger.error(`Error processing chat ${chat.id?._serialized || 'unknown'}:`, error.message);
          }
        })
      );

      // Pausa entre lotes
      if (i + batchSize < validChats.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    logger.info(`Message sync completed for WhatsApp ${wbot.id}`);

  } catch (error: any) {
    if (isSessionClosedError(error)) {
      logger.warn('Session closed during message synchronization, ignoring error');
      return;
    }
    
    // Tratar especificamente o erro de participants
    if (error.message && error.message.includes('participants')) {
      logger.error('WhatsApp participants error detected - this usually indicates session instability');
      logger.error('Consider restarting the WhatsApp session if this error persists');
      
      // Não fazer throw do erro para evitar crash da aplicação
      return;
    }
    
    // Tratar outros erros de avaliação do Puppeteer
    if (error.message && error.message.includes('Evaluation failed')) {
      logger.error('Puppeteer evaluation failed during chat synchronization');
      logger.error('This may indicate WhatsApp Web interface changes or session issues');
      
      // Não fazer throw do erro para evitar crash da aplicação
      return;
    }
    
    logger.error("Erro ao sincronizar mensagens:", error);
  } finally {
    // Limpar cache após processamento
    const cacheKey = `${wbot.id}-${tenantId}`;
    setTimeout(() => {
      processingCache.delete(cacheKey);
    }, 30000);
  }
};

// Função para processar mensagens de cada chat
const processChatMessages = async (
  chat: any,
  wbot: Session,
  tenantId: number | string
): Promise<void> => {
  try {
    // Verificações de segurança
    if (!chat || !chat.id || !chat.id._serialized) {
      logger.warn('Invalid chat object provided');
      return;
    }

    if (chat.unreadCount === 0 || chat.isGroup) {
      return;
    }

    // Verificar se a sessão ainda está ativa
    if (!wbot.pupPage || wbot.pupPage.isClosed()) {
      logger.warn('Session closed, skipping chat processing');
      return;
    }

    logger.info(`Processing chat ${chat.id._serialized} with ${chat.unreadCount} unread messages`);

    // Buscar mensagens com múltiplas tentativas
    let unreadMessages: any[] = [];
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts && unreadMessages.length === 0) {
      try {
        attempts++;
        
        const messagesPromise = chat.fetchMessages({
          limit: Math.min(chat.unreadCount, 20)
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout fetching messages')), 8000);
        });

        unreadMessages = await Promise.race([messagesPromise, timeoutPromise]) as any[];
        
        if (unreadMessages && unreadMessages.length > 0) {
          break;
        }
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error: any) {
        logger.warn(`Error fetching messages for chat ${chat.id._serialized} (attempt ${attempts}): ${error.message}`);
        if (attempts === maxAttempts) {
          // Se for erro de participants, não fazer throw para evitar crash
          if (error.message && error.message.includes('participants')) {
            logger.error('Max attempts reached with participants error - skipping chat sync to prevent crash');
            return;
          }
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!unreadMessages || unreadMessages.length === 0) {
      logger.info(`No messages fetched for chat ${chat.id._serialized}`);
      return;
    }

    // Verificar contato com retry
    let chatContact: any;
    let contact: any;
    
    try {
      chatContact = await chat.getContact();
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

    // Processar mensagens
    const apiConfig: any = ticket.apiConfig || {};
    const hasWebhook = apiConfig?.externalKey && apiConfig?.urlMessageStatus;

    for (let idx = 0; idx < unreadMessages.length; idx++) {
      const msg = unreadMessages[idx];
      
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

export default SyncUnreadMessagesWbot;