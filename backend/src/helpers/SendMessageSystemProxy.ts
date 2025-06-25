import { getInstaBot } from "../libs/InstaBot";
import { getTbot } from "../libs/tbot";
import InstagramSendMessagesSystem from "../services/InstagramBotServices/InstagramSendMessagesSystem";
import TelegramSendMessagesSystem from "../services/TbotServices/TelegramSendMessagesSystem";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import Contact from "../models/Contact";
import { logger } from "../utils/logger";
import Message from "../models/Message";

type Payload = {
  ticket: any;
  messageData: any;
  media: any;
  userId: any;
};

const SendMessageSystemProxy = async ({
  ticket,
  messageData,
  media,
  userId,
}: Payload): Promise<any> => {
  let message;

  // Buscar o contato para garantir que temos todos os dados necessários
  const contact = await Contact.findByPk(ticket.contactId);
  if (!contact) {
    logger.error(
      `[SendMessageSystemProxy] Contact not found for ticket ${ticket.id}`
    );
    throw new Error("ERR_CONTACT_NOT_FOUND");
  }

  if (messageData.mediaName) {
    switch (ticket.channel) {
      case "instagram":
        message = await InstagramSendMessagesSystem(
          getInstaBot(ticket.whatsappId),
          ticket,
          { ...messageData, media }
        );
        break;

      case "telegram":
        message = await TelegramSendMessagesSystem(
          getTbot(ticket.whatsappId),
          ticket,
          { ...messageData, media }
        );
        break;

      default:
        message = await SendWhatsAppMedia(
          media,
          contact.number,
          ticket,
          messageData.body
        );
        break;
    }
  }

  if (!media) {
    switch (ticket.channel) {
      case "instagram":
        message = await InstagramSendMessagesSystem(
          getInstaBot(ticket.whatsappId),
          ticket,
          messageData
        );
        break;

      case "telegram":
        message = await TelegramSendMessagesSystem(
          getTbot(ticket.whatsappId),
          ticket,
          messageData
        );
        break;

      default:
        const quotedMessage = messageData?.quotedMsg?.id
          ? await Message.findByPk(messageData.quotedMsg.id)
          : undefined;
        message = await SendWhatsAppMessage(
          contact,
          ticket,
          messageData.body,
          quotedMessage || undefined,
          undefined, // media parameter
          userId // userId parameter para adicionar assinatura
        );
        break;
    }
  }

  return message;
};

export default SendMessageSystemProxy;
