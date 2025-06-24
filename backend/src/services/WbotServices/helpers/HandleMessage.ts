import Contact from "../../../models/Contact";
import { logger } from "../../../utils/logger";
import FindOrCreateTicketService from "../../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../../WhatsappService/ShowWhatsAppService";
import IsValidMsg from "./IsValidMsg";
// import VerifyAutoReplyActionTicket from "./VerifyAutoReplyActionTicket";
import VerifyContact from "./VerifyContact";
import VerifyMediaMessage from "./VerifyMediaMessage";
import VerifyMessage from "./VerifyMessage";
import verifyBusinessHours from "./VerifyBusinessHours";
import VerifyStepsChatFlowTicket from "../../ChatFlowServices/VerifyStepsChatFlowTicket";
import Queue from "../../../libs/Queue";
// import isMessageExistsService from "../../MessageServices/isMessageExistsService";

const HandleMessage = async (
  msg: WbotMessage,
  wbot: Session
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    (async () => {
      if (!IsValidMsg(msg)) {
        return;
      }

      const whatsapp = await ShowWhatsAppService({ id: wbot.id });

      const { tenantId } = whatsapp;
      const chat = await msg.getChat();

      // SEMPRE IGNORAR MENSAGENS DE GRUPO E STATUS
      if (chat.isGroup || msg.from === "status@broadcast") {
        // Ignorar totalmente mensagens de grupos - não processa nem loga
        resolve();
        return;
      }

      // Verificar se é mensagem de canal/newsletter do WhatsApp
      if (
        msg.from &&
        (msg.from.includes("@newsletter") || msg.from.includes("newsletter"))
      ) {
        resolve();
        return;
      }
      // IGNORAR MENSAGENS DE GRUPO

      try {
        let msgContact: WbotContact;
        let groupContact: Contact | undefined;

        // Logs para debug
        logger.debug(
          `[HandleMessage] Processing message - fromMe: ${msg.fromMe}, type: ${msg.type}, hasMedia: ${msg.hasMedia}`
        );
        logger.debug(
          `[HandleMessage] Message IDs - from: ${msg.from}, to: ${msg.to}`
        );

        if (msg.fromMe) {
          // media messages sent from me from cell phone, first comes with "hasMedia = false" and type = "image/ptt/etc"
          // the media itself comes on body of message, as base64
          // if this is the case, return and let this media be handled by media_uploaded event
          // it should be improoved to handle the base64 media here in future versions
          if (!msg.hasMedia && msg.type !== "chat" && msg.type !== "vcard")
            return;

          // CORREÇÃO: Quando a mensagem é enviada por mim, preciso identificar corretamente o destinatário
          if (chat.isGroup) {
            // Em grupos, o destinatário é sempre o grupo
            msgContact = (wbot as any).getContactById(msg.to);
          } else {
            // Em conversas individuais, buscar o contato através do chat
            try {
              // Usar o ID do destinatário diretamente
              msgContact = (wbot as any).getContactById(msg.to);
            } catch (err) {
              logger.warn(
                `[HandleMessage] Error getting contact by ID: ${err}`
              );
              // Fallback: criar contato básico a partir do número
              const number = msg.to.split("@")[0];
              msgContact = {
                id: { user: number, _serialized: msg.to },
                name: number,
                number,
                isGroup: false,
                isMe: false,
                isWAContact: true,
                isMyContact: false,
                getProfilePicUrl: async () => "",
              };
            }
          }

          // Verificação adicional para evitar usar próprio contato
          if (msgContact && msgContact.id && msgContact.isMe) {
            logger.warn(
              "[HandleMessage] Detected own contact, trying alternative method"
            );
            // Tentar extrair o número do destinatário da conversa
            const chatId = chat.id._serialized;
            if (chatId && !chatId.endsWith("@g.us")) {
              msgContact = (wbot as any).getContactById(chatId);
            }
          }
        } else {
          // Quando a mensagem é recebida, o contato da conversa é o remetente
          msgContact = await msg.getContact();
        }

        // Log do contato identificado
        logger.debug(
          `[HandleMessage] Identified contact - ID: ${
            msgContact?.id?._serialized
          }, Name: ${msgContact?.name || "N/A"}`
        );

        if (chat.isGroup) {
          let msgGroupContact;

          if (msg.fromMe) {
            // Em grupos, quando envio uma mensagem, o grupo é o destinatário (msg.to)
            try {
              msgGroupContact = (wbot as any).getContactById(msg.to);
            } catch (err) {
              logger.warn(
                `[HandleMessage] Error getting group contact (to): ${err}`
              );
              const number = msg.to.split("@")[0];
              msgGroupContact = {
                id: { user: number, _serialized: msg.to },
                name: number,
                number,
                isGroup: true,
                isMe: false,
                isWAContact: true,
                isMyContact: false,
                getProfilePicUrl: async () => "",
              };
            }
          } else {
            // Em grupos, quando recebo uma mensagem, o grupo é o remetente (msg.from)
            try {
              msgGroupContact = (wbot as any).getContactById(msg.from);
            } catch (err) {
              logger.warn(
                `[HandleMessage] Error getting group contact (from): ${err}`
              );
              const number = msg.from.split("@")[0];
              msgGroupContact = {
                id: { user: number, _serialized: msg.from },
                name: number,
                number,
                isGroup: true,
                isMe: false,
                isWAContact: true,
                isMyContact: false,
                getProfilePicUrl: async () => "",
              };
            }
          }

          groupContact = await VerifyContact(msgGroupContact, tenantId);
        }

        const unreadMessages = msg.fromMe ? 0 : chat.unreadCount;

        // const profilePicUrl = await msgContact.getProfilePicUrl();
        const contact = await VerifyContact(msgContact, tenantId);

        logger.debug(
          `[HandleMessage] Created/found contact in DB - ID: ${contact.id}, Name: ${contact.name}, Number: ${contact.number}`
        );

        const ticket = await FindOrCreateTicketService({
          contact,
          whatsappId: wbot.id!,
          unreadMessages,
          tenantId,
          groupContact,
          msg,
          channel: "whatsapp",
        });

        if (ticket?.isCampaignMessage) {
          resolve();
          return;
        }

        if (ticket?.isFarewellMessage) {
          resolve();
          return;
        }

        if (msg.hasMedia) {
          await VerifyMediaMessage(msg, ticket, contact);
        } else {
          await VerifyMessage(msg, ticket, contact);
        }

        const isBusinessHours = await verifyBusinessHours(msg, ticket);

        // await VerifyAutoReplyActionTicket(msg, ticket);
        if (isBusinessHours) await VerifyStepsChatFlowTicket(msg, ticket);

        const apiConfig: any = ticket.apiConfig || {};
        if (
          !msg.fromMe &&
          !ticket.isGroup &&
          !ticket.answered &&
          apiConfig?.externalKey &&
          apiConfig?.urlMessageStatus
        ) {
          const payload = {
            timestamp: Date.now(),
            msg,
            messageId: msg.id.id,
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

        resolve();
      } catch (err) {
        logger.error(`[HandleMessage] Error processing message: ${err}`);
        logger.error(`[HandleMessage] Error stack: ${err.stack}`);
        reject(err);
      }
    })();
  });
};

export default HandleMessage;
