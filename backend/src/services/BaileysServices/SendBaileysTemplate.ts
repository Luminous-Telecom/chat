import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface TemplateComponent {
  type: string;
  parameters: {
    type: string;
    text?: string;
    image?: {
      link: string;
    };
    document?: {
      link: string;
      filename: string;
    };
    video?: {
      link: string;
    };
  }[];
}

interface Request {
  ticket: Ticket;
  userId?: number | string | undefined;
  templateName: string;
  languageCode: string;
  components: TemplateComponent[];
}

const SendBaileysTemplate = async ({
  ticket,
  userId,
  templateName,
  languageCode,
  components
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Preparar mensagem de template como texto simples
    const templateText = `📝 Template: ${templateName} (${languageCode})`;

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      { text: templateText }
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Atualizar ticket
    await ticket.update({
      lastMessage: `📝 Template: ${templateName}`,
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
      body: `📝 Template: ${templateName}`,
      fromMe: true,
      read: true,
      mediaType: "template",
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
    logger.error(`SendBaileysTemplate | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysTemplate;