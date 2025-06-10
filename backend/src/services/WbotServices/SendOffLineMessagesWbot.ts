import { join } from "path";
import { WASocket } from "@whiskeysockets/baileys";
import Message from "../../models/Message";
import MessagesOffLine from "../../models/MessageOffLine";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import { getIO } from "../../libs/socket";
import UserMessagesLog from "../../models/UserMessagesLog";
import SendWhatsAppMedia from "./SendWhatsAppMedia";

interface Session extends WASocket {
  id?: number;
}

const SendOffLineMessagesWbot = async (ticket: Ticket): Promise<void> => {
  const messages = await Message.findAll({
    where: {
      ticketId: ticket.id,
      status: "PENDING"
    },
    include: ["quotedMsg"]
  });

  for (const message of messages) {
    try {
      if (message.mediaType) {
        await SendWhatsAppMedia({
          mediaData: message,
          ticket,
          userId: message.userId
        });
      } else {
        await SendWhatsAppMessage({
          messageData: message,
          ticket,
          body: message.body,
          quotedMsg: message.quotedMsg,
          userId: message.userId
        });
      }
    } catch (err) {
      console.error("Error sending offline message:", err);
    }
  }
};

export default SendOffLineMessagesWbot;
