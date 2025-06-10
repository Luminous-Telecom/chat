import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

interface Request {
  ticket: Ticket;
  isTyping: boolean;
}

const SendBaileysTyping = async ({
  ticket,
  isTyping
}: Request): Promise<void> => {
  try {
    const wbot = await GetTicketBaileys(ticket);

    // Enviar indicador de digitação
    const jid = `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
    
    if (isTyping) {
      await wbot.sendPresenceUpdate('composing', jid);
    } else {
      await wbot.sendPresenceUpdate('paused', jid);
    }

    const sentMessage = true; // Presence updates don't return a message object

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }
  } catch (err) {
    logger.error(`SendBaileysTyping | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysTyping;