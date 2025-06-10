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
  mediaUrl?: string;
  mediaType?: string;
}

const SendBaileysStatus = async ({
  ticket,
  userId,
  body,
  mediaUrl,
  mediaType
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Preparar mensagem de status
    let statusMessage: any = {};

    if (mediaUrl && mediaType) {
      switch (mediaType) {
        case "image":
          statusMessage = {
            image: {
              url: mediaUrl
            },
            caption: body
          };
          break;
        case "video":
          statusMessage = {
            video: {
              url: mediaUrl
            },
            caption: body
          };
          break;
        default:
          statusMessage = { text: body };
      }
    } else {
      statusMessage = { text: body };
    }

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      "status@broadcast",
      statusMessage
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
      mediaType: mediaType || "chat",
      timestamp: Date.now(),
      status: "sending",
      mediaUrl
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
    logger.error(`SendBaileysStatus | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysStatus;