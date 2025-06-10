import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface Request {
  ticket: Ticket;
  message: Message;
}

const SendBaileysRead = async ({
  ticket,
  message
}: Request): Promise<void> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Marcar mensagem como lida usando readMessages
    await wbot.readMessages([{
      remoteJid: `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      fromMe: false,
      id: message.messageId
    }]);

    // Atualizar mensagem
    await message.update({
      read: true,
      readAt: new Date()
    });

    // Emitir evento de atualização da mensagem
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:appMessage`,
      {
        action: "update",
        message,
        ticket,
        contact: ticket.contact
      }
    );
  } catch (err) {
    logger.error(`SendBaileysRead | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysRead;