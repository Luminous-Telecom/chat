import { WASocket, proto } from "baileys";
import { BaileysClient } from "../../types/baileys";
import { logger } from "../../utils/logger";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import VerifyContact from "../WbotServices/helpers/VerifyContact";
import VerifyMediaMessage from "../WbotServices/helpers/VerifyMediaMessage";
import VerifyMessage from "../WbotServices/helpers/VerifyMessage";
import verifyBusinessHours from "../WbotServices/helpers/VerifyBusinessHours";
import VerifyStepsChatFlowTicket from "../ChatFlowServices/VerifyStepsChatFlowTicket";
import Queue from "../../libs/Queue";
import { StartWhatsAppSessionVerify } from "../WbotServices/StartWhatsAppSessionVerify";
import { getBaileysSession } from "../../libs/baileys";
import socketEmit from "../../helpers/socketEmit";
import Contact from "../../models/Contact";
import { BaileysMessageAdapter } from "./BaileysMessageAdapter";
import Message from "../../models/Message";
import CreateMessageService from "../MessageServices/CreateMessageService";
import Ticket from "../../models/Ticket";
import { Op } from "sequelize";

// Cache para controlar logs repetitivos
const warningCache = new Map<string, number>();
const WARNING_COOLDOWN = 30000; // 30 segundos

// Cache para mensagens com erro de criptografia já processadas
const cryptoErrorProcessedMessages = new Set<string>();
const CRYPTO_ERROR_CACHE_SIZE = 1000; // Limitar tamanho do cache
const CRYPTO_ERROR_CACHE_TTL = 3600000; // 1 hora

// Cache para controlar tentativas de reconexão
const reconnectionAttempts = new Map<number, number>();
const MAX_RECONNECTION_ATTEMPTS = 3;
const RECONNECTION_COOLDOWN = 300000; // 5 minutos

// Função para limpar cache de crypto errors antigos
const cleanupCryptoErrorCache = () => {
  if (cryptoErrorProcessedMessages.size > CRYPTO_ERROR_CACHE_SIZE) {
    // Limpar os primeiros itens (mais antigos)
    const itemsToRemove = cryptoErrorProcessedMessages.size - CRYPTO_ERROR_CACHE_SIZE + 100;
    const iterator = cryptoErrorProcessedMessages.values();
    for (let i = 0; i < itemsToRemove; i++) {
      const item = iterator.next();
      if (!item.done) {
        cryptoErrorProcessedMessages.delete(item.value);
      }
    }
  }
};

// Limpar cache periodicamente
setInterval(cleanupCryptoErrorCache, CRYPTO_ERROR_CACHE_TTL);

const shouldLogWarning = (key: string): boolean => {
  const now = Date.now();
  const lastWarning = warningCache.get(key);
  
  if (!lastWarning || now - lastWarning > WARNING_COOLDOWN) {
    warningCache.set(key, now);
    return true;
  }
  
  return false;
};

const isSessionReady = (wbot: BaileysClient): boolean => {
  try {
    const hasWbot = !!wbot;
    const hasWs = !!(wbot as any).ws;
    const wsReadyState = (wbot as any).ws?.readyState;
    const hasUser = !!(wbot as any).user;
    const connectionState = (wbot as any).connection;
    
    // CORREÇÃO: Verificação mais inteligente
    // Se a conexão está "open", consideramos pronto mesmo com wsState undefined
    if (hasWbot && connectionState === "open" && hasUser) {
      // Verificação adicional: se tem WebSocket mas readyState é undefined,
      // pode ser que esteja funcionando mas não expondo a propriedade
      if (hasWs && (wsReadyState === 1 || wsReadyState === undefined)) {
        return true;
      }
      // Se não tem WebSocket mas conexão está open, ainda pode estar OK
      if (!hasWs) {
        // Log para debug mas ainda considera válido
        const sessionKey = `session-no-ws-${wbot?.id}`;
        if (shouldLogWarning(sessionKey)) {
          logger.warn(
            `[isSessionReady] Session ${wbot?.id} has open connection but no WebSocket - may still work`
          );
        }
        return true; // Tentar processar mesmo assim
      }
    }
    
    // Verificação tradicional para outros casos
    const isBasicReady = hasWbot && hasWs && wsReadyState === 1;
    const isConnectionOpen = connectionState === "open";
    
    // Se tem user e WebSocket com readyState correto, está definitivamente pronto
    if (isBasicReady && hasUser) {
      return true;
    }
    
    // Se não tem user mas a conexão está open e WebSocket ativo, pode estar em processo de inicialização
    if (isBasicReady && isConnectionOpen) {
      // Verificar se tem pelo menos as propriedades básicas da autenticação
      const authState = (wbot as any).authState;
      const creds = authState?.creds;
      
      if (creds && creds.me) {
        // Tem credenciais válidas, mesmo sem user definido ainda
        return true;
      }
    }
    
    // Log detalhado apenas quando realmente não conseguir determinar se está pronto
    const sessionKey = `session-debug-${wbot?.id}`;
    if (shouldLogWarning(sessionKey)) {
      logger.warn(
        `[isSessionReady] Session ${wbot?.id} not ready: ` +
        `hasWbot=${hasWbot}, hasWs=${hasWs}, wsState=${wsReadyState}, ` +
        `hasUser=${hasUser}, connection=${connectionState}`
      );
    }
    
    return false;
  } catch (err) {
    logger.error(`[isSessionReady] Error checking session ${(wbot as any)?.id}: ${err}`);
    return false;
  }
};

// Função para determinar se uma mensagem deve ser processada mesmo com erro de criptografia
const shouldProcessEncryptedMessage = (msg: proto.IWebMessageInfo): boolean => {
  // Processar mensagens próprias mesmo com erro de criptografia
  if (msg.key.fromMe) {
    return true;
  }
  
  // Processar mensagens que tenham pelo menos alguns dados básicos
  const hasBasicData = !!(msg.key.id && msg.key.remoteJid && msg.messageTimestamp);
  
  return hasBasicData;
};

// Função para verificar se uma mensagem com crypto error já foi processada
const isCryptoErrorAlreadyProcessed = async (msgId: string, tenantId: number): Promise<boolean> => {
  // 1. Verificar cache em memória primeiro (mais rápido)
  if (cryptoErrorProcessedMessages.has(msgId)) {
    return true;
  }
  
  // 2. Verificar no banco de dados
  try {
    const existingMessage = await Message.findOne({
      where: { 
        messageId: msgId,
        tenantId: tenantId
      }
    });
    
    if (existingMessage) {
      // Adicionar ao cache para próximas verificações
      cryptoErrorProcessedMessages.add(msgId);
      cleanupCryptoErrorCache();
      return true;
    }
  } catch (dbError) {
    // Em caso de erro no banco, continuar processamento para ser seguro
    logger.error(`[HandleBaileysMessage] Error checking crypto message in DB: ${dbError}`);
  }
  
  return false;
};

const HandleBaileysMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: BaileysClient
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    (async () => {
      try {
        // Verificação se a sessão está realmente pronta
        if (!isSessionReady(wbot)) {
          const sessionKey = `session-not-ready-${wbot.id}`;
          if (shouldLogWarning(sessionKey)) {
            logger.warn(
              `[HandleBaileysMessage] Session ${wbot.id} not ready - skipping message processing`
            );
          }
          resolve();
          return;
        }

        // Verificar se mensagem é válida
        if (!msg || !msg.key) {
          resolve();
          return;
        }

        // NOVO: Verificação precoce para mensagens com erro de criptografia já processadas
        if (!msg.message && msg.key.id) {
          const whatsapp = await ShowWhatsAppService({ id: wbot.id });
          if (whatsapp) {
            const alreadyProcessed = await isCryptoErrorAlreadyProcessed(msg.key.id, whatsapp.tenantId);
            if (alreadyProcessed) {
              // Mensagem com crypto error já foi processada - sair silenciosamente
              resolve();
              return;
            }
          }
        }

        // Verificar se é um erro de criptografia de grupo
        const isGroup = msg.key.remoteJid?.endsWith("@g.us");
        if (isGroup && !msg.message && !msg.key.fromMe) {
          const cryptoKey = `crypto-error-${msg.key.remoteJid}`;
          if (shouldLogWarning(cryptoKey)) {
            logger.warn(
              `[HandleBaileysMessage] Grupo ${msg.key.remoteJid} - possível erro de criptografia`
            );
          }
          
          // CORREÇÃO: Verificar se ainda assim devemos processar a mensagem
          if (!shouldProcessEncryptedMessage(msg)) {
            resolve();
            return;
          }
          
          // Para mensagens com erro de criptografia, criar uma mensagem de sistema
          logger.info(`[HandleBaileysMessage] Processando mensagem com erro de criptografia: ${msg.key.id}`);
        }

        // CORREÇÃO: Verificação mais flexível para mensagens válidas
        // Algumas mensagens podem ter conteúdo em outros campos
        const hasValidContent = msg.message || 
                               msg.key.fromMe || 
                               shouldProcessEncryptedMessage(msg);
        
        if (!msg.key.fromMe && !hasValidContent) {
          resolve();
          return;
        }

        // Ignorar tipos de mensagem especiais que não devem ser processados
        const messageType = msg.message ? Object.keys(msg.message)[0] : "";
        const ignoredMessageTypes = [
          "protocolMessage",
          "ephemeralMessage", 
          "reactionMessage",
          "pollCreationMessage",
          "pollUpdateMessage",
          "senderKeyDistributionMessage",
          "fastRatchetKeySenderKeyDistributionMessage",
        ];

        if (ignoredMessageTypes.includes(messageType)) {
          resolve();
          return;
        }

        const whatsapp = await ShowWhatsAppService({ id: wbot.id });
        if (!whatsapp) {
          logger.error(`[HandleBaileysMessage] WhatsApp instance ${wbot.id} not found`);
          resolve();
          return;
        }

        const { tenantId } = whatsapp;

        // Verificar se é mensagem de canal/newsletter do WhatsApp
        const remoteJid = msg.key.remoteJid || "";
        if (
          remoteJid.includes("@newsletter") ||
          remoteJid.includes("newsletter")
        ) {
          resolve();
          return;
        }

        // Sempre ignorar mensagens de grupos - não processa nem loga
        if (isGroup) {
          resolve();
          return;
        }

        // Dupla verificação do estado da sessão antes de processar
        if (!isSessionReady(wbot)) {
          const sessionKey = `session-not-ready-processing-${wbot.id}`;
          if (shouldLogWarning(sessionKey)) {
            logger.warn(
              `[HandleBaileysMessage] Session ${wbot.id} lost connection during processing`
            );
          }
          resolve();
          return;
        }

        // Processar contato
        const { msgContact, groupContact } = await processMessageContact(msg, tenantId, wbot);

        // Verificar se é uma reação ANTES de criar/buscar ticket
        const msgType = Object.keys(msg.message || {})[0];
        const isReaction = msgType === 'reactionMessage' || 
                          (msg.message && Object.keys(msg.message).includes('reactionMessage'));

        // Se for reação, não incrementar unreadMessages
        let unreadMessages = 0;
        
        if (!msg.key.fromMe && !isReaction) {
          // Para mensagens recebidas, contar mensagens não lidas reais do banco
          const contact = await VerifyContact(msgContact, tenantId);
          
          // Buscar ticket existente para este contato
          const existingTicket = await Ticket.findOne({
            where: {
              status: {
                [Op.or]: ["open", "pending"],
              },
              tenantId,
              whatsappId: wbot.id,
              contactId: groupContact ? groupContact.id : contact.id,
            },
          });

          if (existingTicket) {
            // Se já existe ticket, contar mensagens não lidas + 1 (nova mensagem)
            const unreadCount = await Message.count({
              where: {
                ticketId: existingTicket.id,
                read: false,
                fromMe: false,
              },
            });
            unreadMessages = unreadCount + 1;
            console.log(`[DEBUG] Ticket ${existingTicket.id} - Mensagens não lidas existentes: ${unreadCount}, Nova mensagem: 1, Total: ${unreadMessages}`);
          } else {
            // Se não existe ticket, é a primeira mensagem
            unreadMessages = 1;
            console.log(`[DEBUG] Novo ticket - Primeira mensagem: ${unreadMessages}`);
          }
        }

        const contact = await VerifyContact(msgContact, tenantId);

        const ticket = await FindOrCreateTicketService({
          contact,
          whatsappId: wbot.id,
          unreadMessages,
          tenantId,
          groupContact,
          msg,
          channel: "whatsapp",
        });

        if (ticket?.isCampaignMessage || ticket?.isFarewellMessage) {
          resolve();
          return;
        }

        // Processar mensagem
        const message = await processMessage(msg, ticket, contact, wbot);

        if (!message) {
          // Verificar se foi uma reação ignorada propositalmente
          const msgTypeCheck = Object.keys(msg.message || {})[0];
          const isIgnoredReaction = msgTypeCheck === 'reactionMessage' || 
                                    (msg.message && Object.keys(msg.message).includes('reactionMessage'));
          
          if (!isIgnoredReaction) {
            const messageKey = `failed-message-${ticket.id}`;
            if (shouldLogWarning(messageKey)) {
              logger.warn(
                `[HandleBaileysMessage] Failed to create message for ticket ${ticket.id}`
              );
            }
          }
          resolve();
          return;
        }

        // Marcar como lida se não for própria mensagem (com delay para não bloquear)
        if (!msg.key.fromMe) {
          setImmediate(async () => {
            try {
              await handleMessageReadReceipt(msg, ticket, message, wbot);
            } catch (err) {
              logger.error(
                `[HandleBaileysMessage] Error in read receipt: ${err}`
              );
            }
          });
        }

        // Verificar horário comercial e chat flow (com tratamento de erro)
        try {
          const adaptedMessage = BaileysMessageAdapter.convertMessage(msg, wbot);
          const isBusinessHours = await verifyBusinessHours(
            adaptedMessage,
            ticket
          );
          if (isBusinessHours) {
            await VerifyStepsChatFlowTicket(adaptedMessage, ticket);
          }
        } catch (flowErr) {
          logger.error(`[HandleBaileysMessage] Error in chat flow: ${flowErr}`);
        }

        // Webhook para API externa (com tratamento de erro)
        try {
          await handleExternalWebhook(msg, ticket);
        } catch (webhookErr) {
          logger.error(`[HandleBaileysMessage] Webhook error: ${webhookErr}`);
        }

        resolve();
      } catch (err) {
        logger.error(`[HandleBaileysMessage] Error processing message: ${err}`);
        
        // Não fazer reject para evitar travamento do processo principal
        resolve();
      }
    })();
  });
};

const attemptSessionReconnect = async (
  whatsapp: any,
  msg: proto.IWebMessageInfo,
  wbot: BaileysClient
): Promise<void> => {
  try {
    const whatsappId = whatsapp.id;
    const currentAttempts = reconnectionAttempts.get(whatsappId) || 0;
    
    // Verificar se já excedeu o máximo de tentativas
    if (currentAttempts >= MAX_RECONNECTION_ATTEMPTS) {
      logger.warn(
        `[HandleBaileysMessage] Max reconnection attempts reached for session ${whatsapp.name}`
      );
      return;
    }

    // Incrementar contador de tentativas
    reconnectionAttempts.set(whatsappId, currentAttempts + 1);
    
    logger.warn(
      `[HandleBaileysMessage] Attempting reconnect ${currentAttempts + 1}/${MAX_RECONNECTION_ATTEMPTS} for session ${whatsapp.name}`
    );

    // Tentar reconectar (sem aguardar para não bloquear)
    StartWhatsAppSessionVerify(whatsappId, "ERR_WAPP_NOT_INITIALIZED").catch(err => {
      logger.error(`[HandleBaileysMessage] Reconnect failed: ${err}`);
    });

    // Resetar contador após cooldown
    setTimeout(() => {
      reconnectionAttempts.delete(whatsappId);
    }, RECONNECTION_COOLDOWN);

  } catch (reconnectErr) {
    logger.error(`[HandleBaileysMessage] Reconnect error: ${reconnectErr}`);
  }
};

const processMessageContact = async (
  msg: proto.IWebMessageInfo,
  tenantId: number,
  wbot?: any
) => {
  // CORREÇÃO: Lógica melhorada para identificar corretamente o contato
  let contactJid: string;
  let contactNumber: string;

  const isGroup = (msg.key.remoteJid || "").endsWith("@g.us");

  if (msg.key.fromMe) {
    // Mensagem enviada por mim - o contato da conversa é o destinatário
    contactJid = msg.key.remoteJid || "";
    contactNumber = contactJid.split("@")[0].replace(/\D/g, "");
  } else if (isGroup) {
    // Em grupos, o remetente individual é o participant
    contactJid = msg.key.participant || msg.key.remoteJid || "";
    contactNumber = contactJid.split("@")[0].replace(/\D/g, "");
  } else {
    // Em conversas individuais, o remetente é o remoteJid
    contactJid = msg.key.remoteJid || "";
    contactNumber = contactJid.split("@")[0].replace(/\D/g, "");
  }

  // Validar se temos um número válido
  if (!contactNumber || contactNumber.length < 10) {
    contactNumber = contactJid.split("@")[0] || "unknown";
  }

  // NOVO: Tentar buscar nome do contato no store do WhatsApp
  let contactName = contactNumber;
  let contactPushname = "";
  
  if (!msg.key.fromMe && msg.pushName) {
    // Se a mensagem foi recebida, usar o pushName do remetente
    contactName = msg.pushName;
    contactPushname = msg.pushName;
  } else if (msg.key.fromMe && wbot) {
    // Se a mensagem foi enviada por mim, buscar nome agressivamente
    
    // 1. Verificar no banco primeiro
    try {
      const existingContact = await Contact.findOne({
        where: {
          number: contactNumber,
          tenantId,
        }
      });
      
      if (existingContact && existingContact.name && existingContact.name !== contactNumber) {
        contactName = existingContact.name;
        contactPushname = existingContact.pushname || "";
      }
    } catch (dbErr) {
      // Erro silencioso no banco
    }
    
    // 2. Se não achou no banco, buscar no WhatsApp
    if (contactName === contactNumber) {
      try {
        // Método 1: Tentar getBusinessProfile para contas business
        try {
          const businessProfile = await (wbot as any).getBusinessProfile(contactJid);
          
          if (businessProfile?.name) {
            contactName = businessProfile.name;
            contactPushname = businessProfile.name;
          }
        } catch (businessErr) {
          // Erro silencioso
        }
        
        // Método 2: Se não é business, tentar profilePictureUrl para confirmar existência
        if (contactName === contactNumber) {
          try {
            const profilePic = await (wbot as any).profilePictureUrl(contactJid, 'image');
            
            if (profilePic) {
              // Tentar onWhatsApp para mais informações
              const contactInfo = await (wbot as any).onWhatsApp(contactNumber);
              if (contactInfo && contactInfo.length > 0) {
                const contact = contactInfo[0];
                
                if (contact.notify || contact.name) {
                  contactName = contact.notify || contact.name;
                  contactPushname = contact.notify || "";
                }
              }
            }
          } catch (profileErr) {
            // Erro silencioso
          }
        }
        
        // Método 3: Tentar fetchStatus se ainda não achou
        if (contactName === contactNumber) {
          try {
            const status = await (wbot as any).fetchStatus(contactJid);
            
            if (status?.setBy && status.setBy !== contactNumber) {
              contactName = status.setBy;
              contactPushname = status.setBy;
            }
          } catch (statusErr) {
            // Erro silencioso
          }
        }
        
      } catch (searchErr) {
        // Erro silencioso na busca
      }
    }
  }

  // Buscar ou criar contato no banco de dados
  const [foundContact] = await Contact.findOrCreate({
    where: {
      number: contactNumber,
      tenantId,
    },
    defaults: {
      name: contactName,
      pushname: contactPushname,
      isWAContact: true,
      profilePicUrl: "",
    } as any,
  });

  // Atualizar nome se necessário e se não for grupo
  // CORREÇÃO: Atualizar nome usando a mesma lógica da criação
  if (
    contactName &&
    foundContact.name !== contactName &&
    foundContact.name === contactNumber && // Só atualizar se o nome atual for apenas o número
    !isGroup
  ) {
    await foundContact.update({ 
      name: contactName,
      pushname: contactPushname 
    });
  }

  // NOVO: Adicionar contato ao store personalizado para sincronização
  if (wbot && (wbot as any).store?.contacts) {
    try {
      const contactStore = (wbot as any).store.contacts;
      contactStore.set(contactJid, {
        id: contactJid,
        name: contactName,
        pushname: contactPushname,
        notify: contactPushname,
        number: contactNumber, // CORREÇÃO: Adicionar o número!
        isGroup: false,
        lastSeen: Date.now()
      });
    } catch (storeErr) {
      // Erro silencioso - store é opcional
    }
  }

  // Criar objeto de contato compatível
  const msgContact = {
    id: {
      user: contactNumber,
      _serialized: contactJid,
    },
    name: foundContact.name || contactNumber,
    // CORREÇÃO: Para mensagens fromMe=true, não usar pushName pois representa o remetente (eu)
    pushname: msg.key.fromMe ? "" : msg.pushName || "",
    number: contactNumber,
    isGroup: false, // O contato individual nunca é grupo
    isMe: msg.key.fromMe || false,
    isWAContact: true,
    isMyContact: true,
    getProfilePicUrl: async () => foundContact.profilePicUrl || "",
  };

  // Processar contato do grupo se necessário
  let groupContact;
  if (isGroup) {
    const groupPhoneNumber = msg.key.remoteJid?.split("@")[0];
    if (groupPhoneNumber) {
      // Buscar ou criar o contato do grupo
      const [foundGroupContact] = await Contact.findOrCreate({
        where: {
          number: groupPhoneNumber,
          tenantId,
        },
        defaults: {
          name: `Grupo ${groupPhoneNumber}`,
          isWAContact: true,
          profilePicUrl: "",
        } as any,
      });

      groupContact = foundGroupContact;
    }
  }

  return { msgContact, groupContact };
};

const processMessage = async (
  msg: proto.IWebMessageInfo,
  ticket: any,
  contact: any,
  wbot: BaileysClient
) => {
  try {
    // Tentar converter a mensagem - se for reação, uma exceção será lançada
    let adaptedMessage;
    try {
      adaptedMessage = BaileysMessageAdapter.convertMessage(msg, wbot);
    } catch (err) {
      if (err.message === 'REACTION_MESSAGE_IGNORED') {
        logger.debug(`[HandleBaileysMessage] Reaction message ignored for ticket ${ticket.id}`);
        return null;
      }
      throw err; // Re-lançar outras exceções
    }
    
    const messageType = Object.keys(msg.message || {})[0];

    let message;
    
    // CORREÇÃO: Tratamento especial para mensagens com erro de criptografia
    if (!msg.message && shouldProcessEncryptedMessage(msg)) {
      // Criar uma mensagem de sistema para indicar erro de criptografia
      const systemMessageData = {
        messageId: msg.key.id || `crypto-error-${Date.now()}`,
        ticketId: ticket.id,
        contactId: contact.id,
        body: "⚠️ Mensagem não pôde ser descriptografada",
        fromMe: false,
        read: false,
        mediaUrl: undefined,
        mediaType: undefined,
        quotedMsgId: undefined,
        timestamp: Number(msg.messageTimestamp) || Date.now(),
        status: "received",
        dataPayload: JSON.stringify({
          encryptionError: true,
          originalKey: msg.key,
          messageTimestamp: msg.messageTimestamp
        }),
      };
      
      message = await CreateMessageService({
        messageData: systemMessageData,
        tenantId: ticket.tenantId,
      });
      
      // Marcar no cache que esta mensagem com crypto error foi processada
      if (msg.key.id) {
        cryptoErrorProcessedMessages.add(msg.key.id);
        cleanupCryptoErrorCache();
      }
      
      logger.info(`[HandleBaileysMessage] Created system message for crypto error: ${msg.key.id}`);
    } else if (adaptedMessage.hasMedia) {
      message = await VerifyMediaMessage(adaptedMessage, ticket, contact);
    } else {
      message = await VerifyMessage(adaptedMessage, ticket, contact);
    }

    if (!message) {
      logger.warn(
        `[HandleBaileysMessage] Failed to create message for ticket ${ticket.id} - message type: ${messageType}`
      );
    }

    return message;
  } catch (err) {
    logger.error(
      `[HandleBaileysMessage] Error creating message for ticket ${ticket.id}: ${err}`
    );
    return null;
  }
};

// Função para reinicializar sessão problemática
const handleProblematicSession = async (wbot: BaileysClient): Promise<void> => {
  try {
    const sessionId = wbot.id;
    const sessionKey = `problematic-session-${sessionId}`;
    
    if (!shouldLogWarning(sessionKey)) {
      return; // Já tratamos essa sessão recentemente
    }
    
    logger.warn(`[HandleBaileysMessage] Detectada sessão problemática: ${sessionId}`);
    
    // Tentar verificar e reinicializar a sessão em background
    setImmediate(async () => {
      try {
        await StartWhatsAppSessionVerify(sessionId, "ERR_SESSION_PROBLEMATIC");
      } catch (err) {
        logger.error(`[HandleBaileysMessage] Erro ao reinicializar sessão ${sessionId}: ${err}`);
      }
    });
    
  } catch (err) {
    logger.error(`[HandleBaileysMessage] Erro em handleProblematicSession: ${err}`);
  }
};

const handleMessageReadReceipt = async (
  msg: proto.IWebMessageInfo,
  ticket: any,
  message: any,
  wbot: BaileysClient
): Promise<void> => {
  try {
    // Implementação simplificada para evitar travamentos
    // A marcação como lida será feita apenas quando necessário
  } catch (err) {
    logger.error(
      `[HandleBaileysMessage] Error processing read receipt: ${err}`
    );
  }
};

const handleExternalWebhook = async (
  msg: proto.IWebMessageInfo,
  ticket: any
): Promise<void> => {
  try {
    const apiConfig: any = ticket.apiConfig || {};

    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.answered &&
      apiConfig?.externalKey &&
      apiConfig?.urlMessageStatus
    ) {
      const payload = {
        timestamp: Date.now(),
        msg,
        messageId: msg.key.id,
        ticketId: ticket.id,
        externalKey: apiConfig?.externalKey,
        authToken: apiConfig?.authToken,
        type: "hookMessage",
      };

      // Usar setImmediate para não bloquear o processamento principal
      setImmediate(() => {
        Queue.add("WebHooksAPI", {
          url: apiConfig.urlMessageStatus,
          type: payload.type,
          payload,
        }).catch(err => {
          logger.error(`[HandleBaileysMessage] Webhook queue error: ${err}`);
        });
      });
    }
  } catch (err) {
    logger.error(`[HandleBaileysMessage] Webhook error: ${err}`);
  }
};

export default HandleBaileysMessage;
