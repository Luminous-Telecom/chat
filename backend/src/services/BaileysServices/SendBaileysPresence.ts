import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

interface Request {
  ticket: Ticket;
  isOnline: boolean;
}

const SendBaileysPresence = async ({
  ticket,
  isOnline
}: Request): Promise<void> => {
  try {
    const wbot = await GetTicketBaileys(ticket);

    // Enviar presença diretamente usando sendPresenceUpdate
    await wbot.sendPresenceUpdate(
      isOnline ? 'available' : 'unavailable',
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`
    );

    const sentMessage = true;

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }
  } catch (err) {
    logger.error(`SendBaileysPresence | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysPresence;