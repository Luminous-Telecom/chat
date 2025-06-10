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
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

const SendBaileysLocation = async ({
  ticket,
  userId,
  latitude,
  longitude,
  name,
  address
}: Request): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);
    const io = getIO();

    // Preparar mensagem de localização
    const locationMessage = {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: name || "Localização",
        address: address || ""
      }
    };

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.whatsapp.net`,
      locationMessage
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Atualizar ticket
    await ticket.update({
      lastMessage: "📍 Localização",
      lastMessageAt: new Date().getTime()
    });

    // Criar log da mensagem
    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sentMessage.key?.id || `location_${Date.now()}`,
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error creating message log: ${error}`);
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key?.id || `location_${Date.now()}`,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: "📍 Localização",
      fromMe: true,
      read: true,
      mediaType: "location",
      timestamp: Date.now(),
      status: "sending",
      data: {
        latitude,
        longitude,
        name,
        address
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
    logger.error(`SendBaileysLocation | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysLocation;