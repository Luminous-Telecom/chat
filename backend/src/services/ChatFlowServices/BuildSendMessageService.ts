import { join } from "path";
import { pupa } from "../../utils/pupa";
import { logger } from "../../utils/logger";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import socketEmit from "../../helpers/socketEmit";
import SendMessageSystemProxy from "../../helpers/SendMessageSystemProxy";
import AppError from "../../errors/AppError";
import { MessageErrors } from "../../utils/errorHandler";
import { proto } from "@whiskeysockets/baileys";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";

interface MessageData {
  id?: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  timestamp?: number;
  internalId?: string;
  userId?: string | number;
  tenantId: string | number;
  quotedMsgId?: string;
  // status?: string;
  scheduleDate?: string | Date;
  sendType?: string;
  status?: string;
}

interface MessageRequest {
  data: {
    message?: string;
    values?: string[];
    caption?: string;
    ext?: string;
    mediaUrl?: string;
    name?: string;
    type?: string;
  };
  id: string;
  type: "MessageField" | "MessageOptionsField" | "MediaField";
}

interface Request {
  msg: MessageRequest;
  tenantId: string | number;
  ticket: Ticket;
  userId?: number | string;
}

interface MessageSent {
  key: {
    id: string;
  };
  messageId?: string;
}

// const writeFileAsync = promisify(writeFile);

const BuildSendMessageService = async (
  messageData: Message,
  ticket: Ticket,
  userId?: number
): Promise<Message> => {
  try {
    let messageSent: MessageSent | undefined;

    if (messageData.mediaType) {
      messageSent = await SendWhatsAppMedia({
        mediaData: messageData,
        ticket,
        userId: userId ? Number(userId) : undefined
      });
    } else {
      messageSent = await SendWhatsAppMessage({
        messageData,
        ticket,
        body: messageData.body,
        userId: userId ? Number(userId) : undefined
      });
    }

    if (!messageSent) {
      throw new Error("ERR_SENDING_WAPP_MSG");
    }

    const message = await Message.create({
      ...messageData,
      userId: userId ? Number(userId) : undefined,
      messageId: messageSent.key?.id || messageSent.messageId || null
    });

    return message;
  } catch (err) {
    console.error("Error sending message:", err);
    throw err;
  }
};

export default BuildSendMessageService;
