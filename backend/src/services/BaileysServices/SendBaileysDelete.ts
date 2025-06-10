import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface Request {
  ticket: Ticket;
  userId?: number | string | undefined;
  message: Message;
}

const SendBaileysDelete = async ({
  ticket,
  userId,
  message
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Preparar mensagem de exclusão
    const deleteMessage = {
      delete: {
        id: message.messageId,
        fromMe: true
      }
    };

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.whatsapp.net`,
      deleteMessage
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Atualizar ticket
    await ticket.update({
      lastMessage: "Mensagem excluída",
      lastMessageAt: new Date().getTime()
    });

    // Criar log da mensagem
    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sentMessage.key.id!,
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error creating message log: ${error}`);
    }

    // Atualizar mensagem original
    await message.update({
      deleted: true,
      deletedAt: new Date()
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

    return message;
  } catch (err) {
    logger.error(`SendBaileysDelete | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysDelete;