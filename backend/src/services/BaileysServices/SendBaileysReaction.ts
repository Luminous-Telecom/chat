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
  messageId: string;
  reaction: string;
}

const SendBaileysReaction = async ({
  ticket,
  userId,
  messageId,
  reaction
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Preparar mensagem de reação
    const reactionMessage = {
      react: {
        text: reaction,
        key: {
          remoteJid: `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          fromMe: false,
          id: messageId
        }
      }
    };

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      reactionMessage
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Atualizar ticket
    await ticket.update({
      lastMessage: `Reação: ${reaction}`,
      lastMessageAt: new Date().getTime()
    });

    // Criar log da mensagem
    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sentMessage.key?.id || `reaction_${Date.now()}`,
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error creating message log: ${error}`);
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key?.id || `reaction_${Date.now()}`,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: `Reação: ${reaction}`,
      fromMe: true,
      read: true,
      mediaType: "reaction",
      timestamp: Date.now(),
      status: "sending",
      data: {
        reaction,
        messageId
      }
    };

    const message = await Message.create(messageData);

    // Emitir evento de nova mensagem
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:appMessage`,
      {
        action: "create",
        message,
        ticket,
        contact: ticket.contact
      }
    );

    return message;
  } catch (err) {
    logger.error(`SendBaileysReaction | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysReaction;