import { proto } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { getBaileys } from "./BaileysService";
import { WASocket } from "@whiskeysockets/baileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface Button {
  id: string;
  title: string;
}

interface Request {
  ticket: Ticket;
  userId?: number | string | undefined;
  body: string;
  buttons: Button[];
  footer?: string;
}

const SendBaileysButton = async ({
  ticket,
  userId,
  body,
  buttons,
  footer
}: Request): Promise<Message> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_WAPP_NOT_INITIALIZED");
    }
    const io = getIO();

    // Preparar mensagem de botão usando a estrutura correta do Baileys
    const buttonMessage = {
      text: body,
      footer: footer || "",
      buttons: buttons.map(button => ({
        buttonId: button.id,
        buttonText: {
          displayText: button.title
        },
        type: 1
      })),
      headerType: 1 // TEXT header type
    };

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.whatsapp.net`,
      buttonMessage
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
      if (userId && sentMessage.key?.id) {
        await UserMessagesLog.create({
          messageId: sentMessage.key.id,
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
      body,
      fromMe: true,
      read: true,
      mediaType: "button",
      timestamp: Date.now(),
      status: "sending",
      data: {
        buttons,
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
    logger.error(`SendBaileysButton | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysButton;