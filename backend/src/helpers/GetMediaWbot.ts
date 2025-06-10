import { proto, downloadMediaMessage, WASocket } from "@whiskeysockets/baileys";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { getBaileys } from "../libs/baileys";
import { logger } from "../utils/logger";

interface Media {
  type: "image" | "video" | "audio" | "document";
  url: string;
  mimetype: string;
}

const GetMediaWbot = async (message: Message, ticket: Ticket): Promise<Media | null> => {
  try {
    const wbot = await getBaileys(ticket.whatsappId);

    if (!wbot) {
      throw new Error("ERR_NO_WBOT_FOUND");
    }

    if (!message.messageId) {
      throw new Error("ERR_NO_MESSAGE_ID");
    }

    // Create a mock message object with the required structure
    const mockMessage: proto.IWebMessageInfo = {
      key: {
        id: message.messageId,
        remoteJid: `${ticket.contact.number}@s.whatsapp.net`,
        fromMe: message.fromMe
      },
      message: {
        imageMessage: message.mediaType === "image" ? {} : undefined,
        videoMessage: message.mediaType === "video" ? {} : undefined,
        audioMessage: message.mediaType === "audio" ? {} : undefined,
        documentMessage: message.mediaType === "document" ? {} : undefined
      }
    };

    // Download media
    const buffer = await downloadMediaMessage(mockMessage, 'buffer', wbot as any);
    if (!buffer || typeof buffer === "string") {
      throw new Error("ERR_NO_MEDIA_FOUND");
    }

    const media: Media = {
      type: message.mediaType as "image" | "video" | "audio" | "document",
      url: buffer.toString('base64'),
      mimetype: message.mediaType === "image" ? "image/jpeg" :
                message.mediaType === "video" ? "video/mp4" :
                message.mediaType === "audio" ? "audio/ogg" :
                "application/octet-stream"
    };

    return media;
  } catch (err) {
    logger.error("Error getting media from WhatsApp:", err);
    return null;
  }
};

export default GetMediaWbot; 