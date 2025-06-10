import { proto, WASocket } from "@whiskeysockets/baileys";
import fs from "fs";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  userId?: number | string | undefined;
}

const SendBaileysMedia = async ({
  media,
  ticket,
  userId
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Determinar tipo de mídia
    const mimeType = media.mimetype;
    let mediaType = 'document';
    let messageContent: any = {};

    if (mimeType.startsWith('image/')) {
      mediaType = 'image';
      messageContent = { 
        image: { 
          url: media.path,
          mimetype: mimeType
        }
      };
    } else if (mimeType.startsWith('video/')) {
      mediaType = 'video';
      messageContent = { 
        video: { 
          url: media.path,
          mimetype: mimeType
        }
      };
    } else if (mimeType.startsWith('audio/')) {
      mediaType = 'audio';
      messageContent = { 
        audio: { 
          url: media.path,
          mimetype: mimeType,
          ptt: false
        }
      };
    } else {
      messageContent = { 
        document: { 
          url: media.path,
          fileName: media.originalname,
          mimetype: mimeType
        }
      };
    }

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.whatsapp.net`,
      messageContent
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Atualizar ticket
    await ticket.update({
      lastMessage: media.filename,
      lastMessageAt: new Date().getTime()
    });

    // Criar log da mensagem
    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sentMessage.key?.id || `media_${Date.now()}`,
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error creating message log: ${error}`);
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key?.id || `media_${Date.now()}`,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: media.originalname,
      fromMe: true,
      read: true,
      mediaType,
      mediaUrl: media.path,
      mediaName: media.filename,
      timestamp: Date.now(),
      status: "sending"
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

    // Remover arquivo temporário
    try {
      fs.unlinkSync(media.path);
    } catch (error) {
      logger.error(`Error removing temporary file: ${error}`);
    }

    return message;
  } catch (err) {
    logger.error(`SendBaileysMedia | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysMedia;