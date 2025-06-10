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
  body: string;
  quotedMsg: Message;
}

const SendBaileysReply = async ({
  ticket,
  userId,
  body,
  quotedMsg
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Preparar opções da mensagem
    const messageOptions = {
      quoted: {
        key: {
          remoteJid: `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          fromMe: quotedMsg.fromMe,
          id: quotedMsg.messageId
        },
        message: proto.Message.fromObject({
          conversation: quotedMsg.body
        })
      }
    };

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      { text: body },
      messageOptions
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Atualizar ticket
    await ticket.update({
      lastMessage: body,
      lastMessageAt: new Date().getTime()
    });

    // Criar log da mensagem
    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sentMessage.key?.id || "unknown",
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error creating message log: ${error}`);
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key?.id || "unknown",
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body,
      fromMe: true,
      read: true,
      mediaType: "chat",
      timestamp: Date.now(),
      status: "sending",
      quotedMsgId: quotedMsg.id
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
    logger.error(`SendBaileysReply | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysReply;