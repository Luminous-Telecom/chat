import { WASocket, proto } from "@whiskeysockets/baileys";
import { logger } from "../../utils/logger";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import { getWbot } from "../../libs/wbot";
import AppError from "../../errors/AppError";
import { isSessionClosedError } from "../../helpers/HandleSessionError";
import Contact from "../../models/Contact";
import { getMessageBody } from "../../utils/messages";
import { Op } from "sequelize";
import Queue from "../../libs/Queue";
import VerifyStepsChatFlowTicket from "../ChatFlowServices/VerifyStepsChatFlowTicket";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import VerifyContact from "./helpers/VerifyContact";
import VerifyMediaMessage from "./helpers/VerifyMediaMessage";
import VerifyMessage from "./helpers/VerifyMessage";
import socketEmit from "../../helpers/socketEmit";
import { getBaileys } from "../../libs/baileys";
import Whatsapp from "../../models/Whatsapp";

// Definir o tipo personalizado para a sessão do WhatsApp
type WhatsAppSession = WASocket & {
  id: number;
  tenantId: number;
  lastHeartbeat?: number;
  info?: {
    pushname?: string;
    wid?: string;
  };
  store?: {
    contacts: { [key: string]: any };
    chats: { [key: string]: any };
    messages: { [key: string]: { [key: string]: proto.IWebMessageInfo } };
  };
};

interface MessageStatus {
  read: boolean;
  fromMe: boolean;
}

// Cache para evitar processamento desnecessário
const processingCache = new Map<string, number>();
// Cache para rastrear tentativas consecutivas de erro
const errorAttempts = new Map<string, number>();
// Cache para rastrear últimos erros críticos
const lastCriticalError = new Map<string, number>();

// Função para processar mensagens não lidas
const processUnreadMessages = async (wbot: WhatsAppSession, messages: proto.IWebMessageInfo[]): Promise<void> => {
  for (const msg of messages) {
    if (!msg || !msg.key || !msg.key.remoteJid) continue;
    
    try {
      // ... rest of the code using msg ...
    } catch (error) {
      logger.error(`Error processing message: ${error}`);
    }
  }
};

const SyncUnreadMessagesWbot = async (whatsapp: Whatsapp): Promise<void> => {
  const wbot = await getBaileys(whatsapp.id);
  
  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  const session = wbot as WhatsAppSession;
  session.tenantId = whatsapp.tenantId;

  // Verificar se a sessão está ativa
  if (!session.store?.chats) {
    logger.error(`Session not initialized for whatsapp ${whatsapp.id}`);
    return;
  }

  try {
    // Obter todas as conversas do armazenamento local
    const chats = session.store?.chats || {};
    
    for (const [chatId, chat] of Object.entries(chats)) {
      // Ignorar chats de status e grupos
      if (chatId === "status@broadcast" || chatId.endsWith("@g.us")) {
        continue;
      }

      // Obter mensagens não lidas do armazenamento local
      const messages = session.store?.messages[chatId] || {};
      const unreadMessages = Object.values(messages).filter((msg: proto.IWebMessageInfo) => {
        const status = msg.messageStubParameters?.[0] as unknown as MessageStatus;
        return !msg.key.fromMe && 
               !status?.read && 
               msg.message && 
               msg.message.conversation !== undefined;
      });

      for (const msg of unreadMessages) {
        const chatContact = {
          name: msg.pushName || msg.key.remoteJid?.split("@")[0] || "",
          number: msg.key.remoteJid?.split("@")[0] || "",
          isGroup: msg.key.remoteJid?.endsWith("@g.us") || false,
          tenantId: session.tenantId,
          pushname: msg.pushName || "",
          isUser: false,
          isWAContact: true,
          origem: "whatsapp"
        };

        const contact = await VerifyContact(chatContact);

        if (!contact) {
          logger.error(`Contact not found for number ${chatId}`);
          continue;
        }

        const ticketData = {
          contact,
          whatsappId: session.id,
          unreadMessages: 1,
          tenantId: session.tenantId,
          msg,
          channel: "whatsapp"
        };

        const ticket = await FindOrCreateTicketService(ticketData);

        if (!ticket) {
          logger.error(`Ticket not found for contact ${contact.id}`);
          continue;
        }

        // Verificar se a mensagem já existe
        if (msg.key.id) {
          const messageExists = await Message.findOne({
            where: { messageId: msg.key.id }
          });

          if (messageExists) {
            continue;
          }
        }

        // Processar a mensagem
        const messageData = {
          messageId: msg.key.id || "",
          ticketId: ticket.id,
          contactId: contact.id,
          body: getMessageBody(msg),
          fromMe: msg.key.fromMe || false,
          read: msg.key.fromMe || false,
          mediaType: msg.message?.imageMessage ? "image" :
                    msg.message?.videoMessage ? "video" :
                    msg.message?.audioMessage ? "audio" :
                    msg.message?.documentMessage ? "document" : "chat",
          ack: msg.status,
          tenantId: session.tenantId
        };

        if (msg.message?.imageMessage || 
            msg.message?.videoMessage || 
            msg.message?.audioMessage || 
            msg.message?.documentMessage) {
          await VerifyMediaMessage({ msg, ticket, contact });
        } else {
          await VerifyMessage({ msg, ticket, contact });
        }

        // Marcar mensagem como lida
        if (msg.key.id) {
          await session.readMessages([msg.key]);
        }
      }
    }

    // Atualizar tickets pendentes
    const pendingTickets = await Ticket.findAll({
      where: {
        status: "pending",
        tenantId: session.tenantId,
        whatsappId: whatsapp.id
      },
      include: [
        {
          model: Contact,
          as: "contact",
          where: {
            number: {
              [Op.not]: ""
            }
          }
        }
      ]
    });

    for (const ticket of pendingTickets) {
      if (ticket.contact.number) {
        const chatId = `${ticket.contact.number}@s.whatsapp.net`;
        const chat = session.store?.chats[chatId];
        
        if (chat) {
          const messages = session.store?.messages[chatId] || {};
          const unreadCount = Object.values(messages).filter((msg: proto.IWebMessageInfo) => {
            const status = msg.messageStubParameters?.[0] as unknown as MessageStatus;
            return !msg.key.fromMe && !status?.read;
          }).length;

          if (unreadCount > 0) {
            await ticket.update({
              unreadMessages: unreadCount
            });

            socketEmit({
              tenantId: session.tenantId,
              type: "ticket:update",
              payload: ticket
            });
          }
        }
      }
    }

  } catch (err) {
    logger.error(`Error syncing unread messages: ${err}`);
  }
};

// Função para processar mensagens de cada chat com melhorias
const processChatMessages = async (
  chat: any,
  wbot: WhatsAppSession,
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

    // Verificar se a sessão está ativa
    if (!wbot.store?.chats) {
      logger.error(`Session not initialized for whatsapp ${wbot.id}`);
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
      
      contact = await VerifyContact(chatContact);
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
      
      try {
        if (msg.hasMedia) {
          await VerifyMediaMessage({ msg, ticket, contact });
        } else {
          await VerifyMessage({ msg, ticket, contact });
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

const StartWhatsAppSession = async (whatsapp: Whatsapp): Promise<void> => {
  const wbot = await getBaileys(whatsapp.id);
  
  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  const session = wbot as WhatsAppSession;
  session.tenantId = whatsapp.tenantId;

  // Verificar se a sessão está ativa
  if (!session.store?.chats) {
    logger.error(`Session not initialized for whatsapp ${whatsapp.id}`);
    return;
  }

  try {
    // ... rest of the code ...
  } catch (err) {
    logger.error(`Error starting whatsapp session: ${err}`);
  }
};

const StopWhatsAppSession = async (whatsapp: Whatsapp): Promise<void> => {
  const wbot = await getBaileys(whatsapp.id);
  
  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  const session = wbot as WhatsAppSession;
  session.tenantId = whatsapp.tenantId;

  // Verificar se a sessão está ativa
  if (!session.store?.chats) {
    logger.error(`Session not initialized for whatsapp ${whatsapp.id}`);
    return;
  }

  try {
    // ... rest of the code ...
  } catch (err) {
    logger.error(`Error stopping whatsapp session: ${err}`);
  }
};

export default SyncUnreadMessagesWbot;