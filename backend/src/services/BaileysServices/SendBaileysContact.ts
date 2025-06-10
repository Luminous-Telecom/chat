import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";
import { getBaileys } from "./BaileysService";

interface Request {
  ticket: Ticket;
  userId?: number | string | undefined;
  name: string;
  number: string;
}

const SendBaileysContact = async ({
  ticket,
  userId,
  name,
  number
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    
    if (!wbot) {
      throw new AppError("ERR_WBOT_NOT_FOUND");
    }
    const io = getIO();

    // Preparar mensagem de contato
    const contactMessage = {
      contacts: {
        displayName: name,
        contacts: [
          {
            displayName: name,
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${number}\nEND:VCARD`
          } as proto.Message.IContactMessage
        ]
      }
    };

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.whatsapp.net`,
      contactMessage
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Atualizar ticket
    await ticket.update({
      lastMessage: `👤 Contato: ${name}`,
      lastMessageAt: new Date().getTime()
    });

    // Criar log da mensagem
    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sentMessage.key?.id || "",
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error creating message log: ${error}`);
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key?.id || "",
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: `👤 Contato: ${name}`,
      fromMe: true,
      read: true,
      mediaType: "contact",
      timestamp: Date.now(),
      status: "sending",
      data: {
        name,
        number
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
    logger.error(`SendBaileysContact | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysContact;