import { getBaileys } from "../../libs/baileys";
import { logger } from "../../utils/logger";
import { WASocket, proto, AnyMessageContent } from "@whiskeysockets/baileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import socketEmit from "../../helpers/socketEmit";
import GetMessageBody from "../../helpers/GetMessageBody";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

interface Request {
  messageData?: Message;
  ticket: Ticket;
  body?: string;
  userId?: number | string | undefined;
  quotedMsg?: Message;
}

interface MessageSent {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  message?: proto.IMessage;
}

const SendWhatsAppMessage = async ({
  messageData,
  ticket,
  body,
  userId,
  quotedMsg
}: Request): Promise<MessageSent> => {
  try {
    const wbot = await getBaileys(ticket.whatsappId);

    if (!wbot) {
      throw new Error("ERR_NO_WBOT_FOUND");
    }

    const number = `${ticket.contact.number}@s.whatsapp.net`;
    const messageBody = body || (messageData ? GetMessageBody(messageData) : "");

    if (!messageBody) {
      throw new Error("ERR_NO_MESSAGE_BODY");
    }

    const messageContent: AnyMessageContent = {
      text: messageBody,
      ...(quotedMsg?.messageId ? {
        quoted: {
          key: {
            id: quotedMsg.messageId,
            remoteJid: number,
            fromMe: true
          },
          message: {
            conversation: quotedMsg.body || ""
          }
        }
      } : {})
    };

    const messageSent = await wbot.sendMessage(number, messageContent);

    if (!messageSent || !messageSent.key?.id) {
      throw new Error("ERR_SENDING_WAPP_MSG");
    }

    const message = await Message.create({
      ticketId: ticket.id,
      body: messageBody,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      mediaType: "chat",
      timestamp: new Date(),
      messageId: messageSent.key.id,
      status: "SENT",
      userId,
      quotedMsgId: quotedMsg?.id
    });

    await ticket.update({
      lastMessage: messageBody
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
    logger.error("Error sending WhatsApp message:", err);
    throw new Error("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
