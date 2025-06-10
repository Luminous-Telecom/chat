import { getInstaBot } from "../libs/InstaBot";
import { getTbot } from "../libs/tbot";
import InstagramSendMessagesSystem from "../services/InstagramBotServices/InstagramSendMessagesSystem";
import TelegramSendMessagesSystem from "../services/TbotServices/TelegramSendMessagesSystem";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { proto } from "@whiskeysockets/baileys";

interface Request {
  mediaData?: Message;
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

const SendMessageSystemProxy = async ({
  mediaData,
  messageData,
  ticket,
  body,
  userId,
  quotedMsg
}: Request): Promise<MessageSent> => {
  try {
    let messageSent: MessageSent | undefined;

    if (mediaData) {
      messageSent = await SendWhatsAppMedia({
        mediaData,
        ticket,
        userId: userId ? Number(userId) : undefined
      });
    } else {
      messageSent = await SendWhatsAppMessage({
        messageData,
        ticket,
        body,
        userId: userId ? Number(userId) : undefined,
        quotedMsg
      });
    }

    if (!messageSent) {
      throw new Error("ERR_SENDING_WAPP_MSG");
    }

    if (messageData) {
      await Message.update(
        {
          messageId: messageSent.key.id,
          status: "SENT"
        },
        {
          where: { id: messageData.id }
        }
      );
    }

    return messageSent;
  } catch (err) {
    console.error("Error sending message:", err);
    throw err;
  }
};

export default SendMessageSystemProxy;
