import { proto, WASocket } from '@whiskeysockets/baileys';
import { logger } from "../../utils/logger";
import { getBaileys } from "../../libs/baileys";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import UserMessagesLog from "../../models/UserMessagesLog";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  userId?: number | string | undefined;
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
}

const SendBaileysMessage = async ({
  body,
  ticket,
  quotedMsg,
  userId,
  mediaUrl,
  mediaType,
  mediaName
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    let messageOptions: any = {};
    let messageContent: any = {};

    // Processar mensagem citada
    if (quotedMsg) {
      messageOptions.quoted = {
        key: {
          remoteJid: `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
          fromMe: quotedMsg.fromMe,
          id: quotedMsg.messageId
        },
        message: proto.Message.fromObject({
          conversation: quotedMsg.body
        })
      };
    }

    // Processar mídia
    if (mediaUrl) {
      switch (mediaType) {
        case 'image':
          messageContent = { image: { url: mediaUrl } };
          break;
        case 'video':
          messageContent = { video: { url: mediaUrl } };
          break;
        case 'audio':
          messageContent = { audio: { url: mediaUrl } };
          break;
        case 'document':
          messageContent = { 
            document: { 
              url: mediaUrl,
              fileName: mediaName || 'document'
            }
          };
          break;
        default:
          messageContent = { text: body };
      }
    } else {
      messageContent = { text: body };
    }

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      messageContent,
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
          messageId: sentMessage.key?.id || `msg_${Date.now()}`,
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error creating message log: ${error}`);
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key?.id || `msg_${Date.now()}`,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body,
      fromMe: true,
      read: true,
      mediaType: mediaType || 'chat',
      mediaUrl,
      mediaName,
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

    return message;
  } catch (err) {
    logger.error(`SendBaileysMessage | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysMessage;