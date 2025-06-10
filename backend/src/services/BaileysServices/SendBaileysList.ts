import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface ListItem {
  id: string;
  title: string;
  description?: string;
}

interface ListSection {
  title: string;
  rows: ListItem[];
}

interface Request {
  ticket: Ticket;
  userId?: number | string | undefined;
  body: string;
  buttonText: string;
  sections: ListSection[];
  footer?: string;
}

const SendBaileysList = async ({
  ticket,
  userId,
  body,
  buttonText,
  sections,
  footer
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Preparar mensagem de lista
    const listMessage = {
      text: body,
      footer: footer || "",
      title: buttonText,
      buttonText: buttonText,
      body: body,
      sections: sections.map(section => ({
        title: section.title,
        rows: section.rows.map(row => ({
          id: row.id,
          title: row.title,
          description: row.description || ""
        }))
      }))
    };

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.whatsapp.net`,
      listMessage
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
          messageId: sentMessage.key?.id || `list_${Date.now()}`,
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error creating message log: ${error}`);
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key?.id || `list_${Date.now()}`,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body,
      fromMe: true,
      read: true,
      mediaType: "list",
      timestamp: Date.now(),
      status: "sending",
      data: {
        buttonText,
        sections,
        footer
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
    logger.error(`SendBaileysList | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysList;