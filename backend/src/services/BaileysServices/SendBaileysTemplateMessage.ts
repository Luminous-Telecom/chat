import { proto } from '@whiskeysockets/baileys';
import { logger } from "../../utils/logger";
import { getBaileys } from "../../libs/baileys";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";

interface TemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  parameters: {
    type: 'text' | 'image' | 'document' | 'video';
    text?: string;
    image?: {
      link: string;
    };
    document?: {
      link: string;
      filename?: string;
    };
    video?: {
      link: string;
    };
  }[];
}

interface Request {
  ticket: Ticket;
  templateName: string;
  languageCode: string;
  components?: TemplateComponent[];
  userId?: number | string;
}

const SendBaileysTemplateMessage = async ({
  ticket,
  templateName,
  languageCode,
  components,
  userId
}: Request): Promise<Message> => {
  try {
    const io = getIO();
    const wbot = getBaileys(ticket.whatsappId);

    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Preparar mensagem template usando formato correto do Baileys
    const messageContent = {
      text: templateName,
      footer: components?.find(c => c.type === 'footer')?.parameters[0]?.text,
      templateButtons: components
        ?.filter(c => c.type === 'button')
        .map((button, index) => ({
          index,
          quickReplyButton: {
            displayText: button.parameters[0]?.text || '',
            id: button.parameters[0]?.text || ''
          }
        }))
    };

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      ticket.contact.number + '@s.whatsapp.net',
      messageContent
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key.id!,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: templateName,
      fromMe: true,
      read: true,
      mediaType: 'template',
      timestamp: Date.now(),
      status: "sending"
    };

    const message = await CreateMessageService({
      messageData,
      tenantId: ticket.tenantId
    });

    // Atualizar ticket
    await ticket.update({
      lastMessage: templateName,
      lastMessageAt: Date.now(),
      answered: true,
      userId: userId || null
    });

    // Emitir eventos
    io.emit(`${ticket.tenantId}:ticket`, {
      action: "update",
      ticket,
      contact: ticket.contact
    });

    io.emit(`${ticket.tenantId}:appMessage`, {
      action: "create",
      message,
      ticket,
      contact: ticket.contact
    });

    return message;
  } catch (err) {
    logger.error(`Error sending Baileys template message: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysTemplateMessage;