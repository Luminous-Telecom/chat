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

const SendBaileysForward = async ({
  ticket,
  userId,
  message
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Preparar mensagem para encaminhamento usando formato correto do Baileys
    const forwardMessage = {
      text: "Mensagem encaminhada",
      forward: {
        remoteJid: `${message.contact?.number || ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.us`,
        fromMe: message.fromMe,
        id: message.messageId
      }
    };

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.us`,
      forwardMessage
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Atualizar ticket
    await ticket.update({
      lastMessage: "Mensagem encaminhada",
      lastMessageAt: new Date().getTime()
    });

    // Criar log da mensagem
    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sentMessage.key?.id || `forward_${Date.now()}`,
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error creating message log: ${error}`);
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key?.id || `forward_${Date.now()}`,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: "Mensagem encaminhada",
      fromMe: true,
      read: true,
      mediaType: "forward",
      timestamp: Date.now(),
      status: "sending",
      data: {
        forwardedMessageId: message.id
      }
    };

    const newMessage = await Message.create(messageData);

    // Emitir evento de nova mensagem
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:appMessage`,
      {
        action: "create",
        message: newMessage,
        ticket,
        contact: ticket.contact
      }
    );

    return newMessage;
  } catch (err) {
    logger.error(`SendBaileysForward | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysForward;