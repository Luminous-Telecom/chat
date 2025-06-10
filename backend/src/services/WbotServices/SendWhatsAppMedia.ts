import { getBaileys } from "../../libs/baileys";
import { logger } from "../../utils/logger";
import { WASocket, proto, AnyMessageContent } from "@whiskeysockets/baileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import GetMediaWbot from "../../helpers/GetMediaWbot";
import GetMessageBody from "../../helpers/GetMessageBody";
import socketEmit from "../../helpers/socketEmit";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

interface Request {
  mediaData: Message;
  ticket: Ticket;
  userId?: number | string | undefined;
}

interface MessageSent {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  message?: proto.IMessage;
}

const SendWhatsAppMedia = async ({
  mediaData,
  ticket,
  userId
}: Request): Promise<MessageSent> => {
  const wbot = await getBaileys(ticket.whatsappId);

  if (!wbot) {
    throw new Error("ERR_NO_WBOT_FOUND");
  }

  try {
    const number = `${ticket.contact.number}@s.whatsapp.net`;
    const media = await GetMediaWbot(mediaData, ticket);

    if (!media) {
      throw new Error("ERR_NO_MEDIA_FOUND");
    }

    let messageContent: AnyMessageContent;

    switch (media.type) {
      case "image":
        messageContent = {
          image: { url: media.url },
          mimetype: media.mimetype
        };
        break;
      case "video":
        messageContent = {
          video: { url: media.url },
          mimetype: media.mimetype
        };
        break;
      case "audio":
        messageContent = {
          audio: { url: media.url },
          mimetype: media.mimetype
        };
        break;
      case "document":
        messageContent = {
          document: { url: media.url },
          mimetype: media.mimetype,
          caption: mediaData.mediaName || "document"
        };
        break;
      default:
        throw new Error("ERR_INVALID_MEDIA_TYPE");
    }

    const messageSent = await wbot.sendMessage(number, messageContent);

    if (!messageSent || !messageSent.key?.id) {
      throw new Error("ERR_SENDING_WAPP_MSG");
    }

    await Message.create({
      ticketId: ticket.id,
      body: GetMessageBody(mediaData),
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      mediaType: media.type,
      mediaUrl: media.url,
      mediaName: mediaData.mediaName,
      timestamp: new Date(),
      messageId: messageSent.key.id,
      status: "SENT",
      userId
    });

    await ticket.update({
      lastMessage: GetMessageBody(mediaData)
    });

    socketEmit({
      tenantId: ticket.tenantId,
      type: "chat:update",
      payload: {
        messageId: messageSent.key.id,
        status: "SENT"
      }
    });

    return {
      key: {
        id: messageSent.key.id,
        remoteJid: messageSent.key.remoteJid || number,
        fromMe: true
      },
      message: messageSent.message || undefined
    };
  } catch (err) {
    logger.error("Error sending WhatsApp media:", err);
    throw new Error("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
