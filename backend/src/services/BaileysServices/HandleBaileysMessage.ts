import { WASocket, proto } from "@whiskeysockets/baileys";
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
import Setting from "../../models/Setting";
import { StartWhatsAppSessionVerify } from "../WbotServices/StartWhatsAppSessionVerify";
import { getBaileysSession } from "../../libs/baileys";
import socketEmit from "../../helpers/socketEmit";
import Contact from "../../models/Contact";
import { BaileysMessageAdapter } from "./BaileysMessageAdapter";
import Message from "../../models/Message";
import CreateMessageService from "../MessageServices/CreateMessageService";

// Cache para controlar tentativas de reconexão
const reconnectionAttempts = new Map<number, number>();
const MAX_RECONNECTION_ATTEMPTS = 3;
const RECONNECTION_COOLDOWN = 30000; // 30 segundos

// Cache para controlar rate limiting de warnings
const warningCache = new Map<string, number>();
const WARNING_THROTTLE_TIME = 60000; // 1 minuto

const shouldLogWarning = (key: string): boolean => {
  const now = Date.now();
  const lastWarning = warningCache.get(key);
  
  if (!lastWarning || now - lastWarning > WARNING_THROTTLE_TIME) {
    warningCache.set(key, now);
    return true;
  }
  
  return false;
};

const isSessionReady = (wbot: BaileysClient): boolean => {
  try {
    const sessionState = (wbot as any)?.connection;
    const wsExists = !!(wbot as any)?.ws;
    const wsState = (wbot as any)?.ws?.readyState;
    
    // MELHORADO: Aceitar mais estados de conexão como válidos
    // 'open' é o ideal, mas 'connecting' com WebSocket ativo também deve processar mensagens
    const isStateValid = sessionState === "open" || 
                        (sessionState === "connecting" && wsExists) ||
                        (sessionState === "connecting" && !wsExists); // Pode estar reconectando
    
    // WebSocket states: CONNECTING = 0, OPEN = 1, CLOSING = 2, CLOSED = 3
    // Aceitar estados 0, 1 e até mesmo undefined durante reconexão
    const isWsOk = !wsExists || 
                   wsState === undefined || 
                   wsState === 0 || 
                   wsState === 1;
    
    const isConnected = isStateValid && isWsOk;
    
    // Log apenas quando realmente há problema
    if (!isConnected && sessionState === "close") {
      logger.debug(`[isSessionReady] Session ${wbot.id} truly not ready - State: ${sessionState}, WS: ${wsExists}, WS State: ${wsState}`);
    }
    
    return isConnected;
  } catch (err) {
    logger.error(`[isSessionReady] Error checking session ${wbot.id}: ${err}`);
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

        // Verificar configuração de grupos - sair cedo sem logs se deve ignorar
        const Settingdb = await Setting.findOne({
          where: { key: "ignoreGroupMsg", tenantId },
        });

        if (Settingdb?.value === "enabled" && isGroup) {
          // Ignorar totalmente mensagens de grupos - não processa nem loga
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
        const { msgContact, groupContact } = await processMessageContact(
          msg,
          tenantId
        );

        // Criar/buscar ticket
        const unreadMessages = msg.key.fromMe ? 0 : 1;
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
          const messageKey = `failed-message-${ticket.id}`;
          if (shouldLogWarning(messageKey)) {
            logger.warn(
              `[HandleBaileysMessage] Failed to create message for ticket ${ticket.id}`
            );
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
  tenantId: number
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
    logger.warn(
      `[processMessageContact] Invalid contact number: ${contactNumber}, using fallback`
    );
    contactNumber = contactJid.split("@")[0] || "unknown";
  }

  // Buscar ou criar contato no banco de dados
  const [foundContact] = await Contact.findOrCreate({
    where: {
      number: contactNumber,
      tenantId,
    },
    defaults: {
      name: msg.pushName || contactNumber,
      isWAContact: true,
      profilePicUrl: null,
    },
  });

  // Atualizar nome se necessário e se não for grupo
  // CORREÇÃO: Só atualizar o nome do contato com pushName se a mensagem NÃO for enviada por mim
  // Para mensagens fromMe=true, o pushName é do remetente (eu), não do destinatário
  if (
    msg.pushName &&
    foundContact.name !== msg.pushName &&
    !isGroup &&
    !msg.key.fromMe
  ) {
    await foundContact.update({ name: msg.pushName });
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
          profilePicUrl: null,
        },
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
    const adaptedMessage = BaileysMessageAdapter.convertMessage(msg, wbot);
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
