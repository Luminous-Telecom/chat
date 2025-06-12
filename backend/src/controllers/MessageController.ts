/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { Request, Response } from "express";
import AppError from "../errors/AppError";
import DeleteMessageSystem from "../helpers/DeleteMessageSystem";
// import GetTicketWbot from "../helpers/GetTicketWbot";

import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import Message from "../models/Message";
import CreateForwardMessageService from "../services/MessageServices/CreateForwardMessageService";
// import CreateMessageOffilineService from "../services/MessageServices/CreateMessageOfflineService";
import CreateMessageSystemService from "../services/MessageServices/CreateMessageSystemService";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import { logger } from "../utils/logger";
import { getIO } from "../libs/socket";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import { Op } from "sequelize";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";

type IndexQuery = {
  pageNumber: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  sendType?: string;
  scheduleDate?: string | Date;
  quotedMsg?: Message;
  idFront?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber } = req.query as IndexQuery;
  const { tenantId } = req.user;

  const { count, messages, messagesOffLine, ticket, hasMore } =
    await ListMessagesService({
      pageNumber,
      ticketId,
      tenantId
    });

  return res.json({ count, messages, messagesOffLine, ticket, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { tenantId, id: userId } = req.user;
  const messageData: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  const ticket = await ShowTicketService({ id: ticketId, tenantId });

  // Removido para evitar marcação automática como lida no WhatsApp
  // try {
  //   SetTicketMessagesAsRead(ticket);
  // } catch (error) {
  //   console.log("SetTicketMessagesAsRead", error);
  // }

  await CreateMessageSystemService({
    msg: messageData,
    tenantId,
    medias,
    ticket,
    userId,
    scheduleDate: messageData.scheduleDate,
    sendType: messageData.sendType || "chat",
    status: "pending",
    idFront: messageData.idFront
  });

  return res.send();
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { tenantId } = req.user;
  try {
    await DeleteMessageSystem(req.body.id, messageId, tenantId);
  } catch (error) {
    logger.error(`ERR_DELETE_SYSTEM_MSG: ${error}`);
    throw new AppError("ERR_DELETE_SYSTEM_MSG");
  }

  return res.send();
};

export const forward = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body;
  const { user } = req;

  for (const message of data.messages) {
    await CreateForwardMessageService({
      userId: user.id,
      tenantId: user.tenantId,
      message,
      contact: data.contact,
      ticketIdOrigin: message.ticketId
    });
  }

  return res.send();
};

export const markAsRead = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { tenantId } = req.user;

  logger.info(`[markAsRead] Iniciando marcação de mensagem como lida. MessageId: ${messageId}, TenantId: ${tenantId}`);

  try {
    const message = await Message.findOne({
      where: { 
        id: messageId,
        tenantId
      },
      include: [
        {
          model: Ticket,
          include: [{ model: Contact }]
        }
      ]
    });

    if (!message) {
      logger.warn(`[markAsRead] Mensagem não encontrada. MessageId: ${messageId}`);
      return res.status(404).json({ error: "Message not found" });
    }

    logger.info(`[markAsRead] Mensagem encontrada:`, {
      messageId: message.id,
      ticketId: message.ticketId,
      read: message.read
    });

    // Marcar mensagem como lida
    await message.update({ read: true });
    logger.info(`[markAsRead] Mensagem marcada como lida`);

    // Atualizar contador de mensagens não lidas no ticket
    const unreadCount = await Message.count({
      where: { 
        ticketId: message.ticketId, 
        read: false,
        fromMe: false
      }
    });

    logger.info(`[markAsRead] Novo contador de mensagens não lidas: ${unreadCount}`);

    await message.ticket.update({ unreadMessages: unreadCount });
    logger.info(`[markAsRead] Ticket atualizado com novo contador`);

    // Notificar frontend
    const io = getIO();
    io.to(tenantId.toString()).emit(`${tenantId}:ticketList`, {
      type: "chat:update",
      payload: {
        ticketId: message.ticketId,
        messageId: message.id,
        read: true,
        ticket: {
          id: message.ticket.id,
          unreadMessages: unreadCount
        }
      }
    });
    logger.info(`[markAsRead] Evento emitido para o frontend`);

    return res.status(200).json({ message: "Message marked as read" });
  } catch (err) {
    logger.error(`[markAsRead] Erro ao marcar mensagem como lida:`, err);
    logger.error(`[markAsRead] Stack do erro:`, err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
};
