import { WASocket } from "@whiskeysockets/baileys";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import { logger } from "../utils/logger";
import { Op } from "sequelize";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

interface InternalMessage {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  body: string;
  ack: number;
  deviceType: string;
  isStatus: boolean;
  broadcast: boolean;
  fromMe: boolean;
  hasMedia: boolean;
  mediaType?: "image" | "video" | "audio" | "document";
  mediaUrl?: string;
  mediaName?: string;
  timestamp: number;
}

const HandleMessage = async (msg: InternalMessage, wbot: Session): Promise<void> => {
  try {
    const number = msg.key.remoteJid.split("@")[0];
    const contact = await Contact.findOne({
      where: { number, tenantId: wbot.tenantId }
    });

    if (!contact) {
      logger.info(`Contact not found for number: ${number}`);
      return;
    }

    const ticket = await Ticket.findOne({
      where: { contactId: contact.id, status: { [Op.ne]: "closed" } }
    });

    if (!ticket) {
      logger.info(`No open ticket found for contact: ${contact.id}`);
      return;
    }

    const messageData = {
      messageId: msg.key.id,
      ticketId: ticket.id,
      contactId: contact.id,
      body: msg.body,
      fromMe: msg.fromMe,
      read: msg.fromMe,
      mediaType: msg.mediaType,
      mediaUrl: msg.mediaUrl,
      mediaName: msg.mediaName,
      ack: msg.ack,
      deviceType: msg.deviceType,
      timestamp: msg.timestamp
    };

    await Message.create(messageData);

  } catch (err) {
    logger.error(`Error handling message: ${err}`);
  }
};

export default HandleMessage; 