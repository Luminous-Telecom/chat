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
// import SetTicketMessagesAsRead from '../../helpers/SetTicketMessagesAsRead'; // Removido - não usado mais

const HandleBaileysMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: BaileysClient
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    (async () => {
      try {
        // Verificar se mensagem é válida
        if (!msg.key.fromMe && !msg.message) {
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

        // Verificar configuração de grupos
        const Settingdb = await Setting.findOne({
          where: { key: "ignoreGroupMsg", tenantId },
        });

        const isGroup = msg.key.remoteJid?.endsWith("@g.us");
        if (Settingdb?.value === "enabled" && isGroup) {
          resolve();
          return;
        }

        // Verificar estado da sessão
        const sessionState = (wbot as any)?.connection;
        const wsExists = !!(wbot as any)?.ws;

        if (sessionState !== "open" || !wsExists) {
          logger.warn(
            `[HandleBaileysMessage] Session not ready (state: ${sessionState}, ws: ${wsExists})`
          );

          if (sessionState === "open" && !wsExists) {
            await attemptSessionReconnect(whatsapp, msg, wbot);
            resolve();
            return;
          }
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
          logger.warn(
            `[HandleBaileysMessage] Failed to create message for ticket ${ticket.id}`
          );
          resolve();
          return;
        }

        // Marcar como lida se não for própria mensagem
        if (!msg.key.fromMe) {
          // Usar setTimeout para não bloquear o processamento principal
          setTimeout(async () => {
            try {
              await handleMessageReadReceipt(msg, ticket, message, wbot);
            } catch (err) {
              logger.error(
                `[HandleBaileysMessage] Error in read receipt: ${err}`
              );
            }
          }, 1000);
        }

        // Verificar horário comercial e chat flow
        const adaptedMessage = BaileysMessageAdapter.convertMessage(msg, wbot);
        const isBusinessHours = await verifyBusinessHours(
          adaptedMessage,
          ticket
        );
        if (isBusinessHours) {
          await VerifyStepsChatFlowTicket(adaptedMessage, ticket);
        }

        // Webhook para API externa
        await handleExternalWebhook(msg, ticket);

        resolve();
      } catch (err) {
        logger.error(`[HandleBaileysMessage] Error processing message: ${err}`);
        logger.error(`[HandleBaileysMessage] Error stack: ${err.stack}`);
        reject(err);
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
    logger.warn(
      `[HandleBaileysMessage] Attempting reconnect for session ${whatsapp.name}`
    );
    await StartWhatsAppSessionVerify(whatsapp.id, "ERR_WAPP_NOT_INITIALIZED");

    // Aguardar reconexão
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Tentar processar mensagem novamente
    const newWbot = getBaileysSession(whatsapp.id);
    if (newWbot) {
      logger.info("[HandleBaileysMessage] Retrying with new session");
      return HandleBaileysMessage(msg, newWbot);
    }
  } catch (reconnectErr) {
    logger.error(`[HandleBaileysMessage] Reconnect failed: ${reconnectErr}`);
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
  } else {
    // Mensagem recebida - o contato é o remetente
    if (isGroup) {
      // Em grupos, o remetente individual é o participant
      contactJid = msg.key.participant || msg.key.remoteJid || "";
      contactNumber = contactJid.split("@")[0].replace(/\D/g, "");
    } else {
      // Em conversas individuais, o remetente é o remoteJid
      contactJid = msg.key.remoteJid || "";
      contactNumber = contactJid.split("@")[0].replace(/\D/g, "");
    }
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
    if (adaptedMessage.hasMedia) {
      message = await VerifyMediaMessage(adaptedMessage, ticket, contact);
    } else {
      message = await VerifyMessage(adaptedMessage, ticket, contact);
    }

    if (message) {
      logger.info(
        `[HandleBaileysMessage] Successfully created message ${message.id} for ticket ${ticket.id}`
      );
    } else {
      logger.warn(
        `[HandleBaileysMessage] Failed to create message for ticket ${ticket.id} - message type: ${messageType}`
      );
    }

    return message;
  } catch (err) {
    logger.error(
      `[HandleBaileysMessage] Error creating message for ticket ${ticket.id}: ${err}`
    );
    logger.error(`[HandleBaileysMessage] Error stack: ${err.stack}`);
    return null;
  }
};

const handleMessageReadReceipt = async (
  msg: proto.IWebMessageInfo,
  ticket: any,
  message: any,
  wbot: BaileysClient
): Promise<void> => {
  try {
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

      Queue.add("WebHooksAPI", {
        url: apiConfig.urlMessageStatus,
        type: payload.type,
        payload,
      });
    }
  } catch (err) {
    logger.error(`[HandleBaileysMessage] Webhook error: ${err}`);
  }
};

export default HandleBaileysMessage;
