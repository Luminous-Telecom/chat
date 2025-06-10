import { proto } from "@whiskeysockets/baileys";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";

interface BaileysCall {
  id: string;
  status: "offer" | "ringing" | "timeout" | "reject" | "accept" | "end";
  from: string;
  timestamp: number;
}

const VerifyCall = async (call: BaileysCall, ticket: Ticket): Promise<void> => {
  try {
    const messageData = {
      ticketId: ticket.id,
      body: `Call ${call.status}`,
      contactId: ticket.contactId,
      fromMe: false,
      read: true,
      mediaType: "call",
      timestamp: call.timestamp,
      messageId: call.id,
      status: "RECEIVED"
    };

    await Message.create(messageData);

    await ticket.update({
      lastMessage: messageData.body,
      lastMessageAt: new Date().getTime(),
      answered: false
    });

    logger.info(`Call ${call.id} from ${call.from} ${call.status}`);
  } catch (err) {
    logger.error("Error verifying call:", err);
  }
};

export default VerifyCall; 