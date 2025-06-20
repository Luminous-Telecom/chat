/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import { Request, Response } from "express";
import { Op } from "sequelize";
import AppError from "../errors/AppError";
import DeleteMessageSystem from "../helpers/DeleteMessageSystem";
// import GetTicketWbot from "../helpers/GetTicketWbot";

import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import Message from "../models/Message";
import CreateForwardMessageService from "../services/MessageServices/CreateForwardMessageService";
// import CreateMessageOffilineService from "../services/MessageServices/CreateMessageOfflineService";
import CreateMessageSystemService from "../services/MessageServices/CreateMessageSystemService";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ListContactMessagesService from "../services/MessageServices/ListContactMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import { logger } from "../utils/logger";
import { getIO } from "../libs/socket";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import User from "../models/User";

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
      tenantId,
    });

  // Serialização manual para garantir que todos os campos venham completos
  const serializedMessages = messages.map(msg => {
    const plain = msg.get({ plain: true }) as any;
    if (plain.quotedMsg) {
      if (typeof plain.quotedMsg.get === "function") {
        plain.quotedMsg = plain.quotedMsg.get({ plain: true });
      }
      if (
        plain.quotedMsg.contact &&
        typeof plain.quotedMsg.contact.get === "function"
      ) {
        plain.quotedMsg.contact = plain.quotedMsg.contact.get({ plain: true });
      }
    }
    return plain;
  });

  return res.json({
    count,
    messages: serializedMessages,
    messagesOffLine,
    ticket,
    hasMore,
  });
};

export const getContactMessages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { tenantId } = req.user;

  const messages = await ListContactMessagesService({
    contactId,
    tenantId,
  });

  return res.json(messages);
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
    idFront: messageData.idFront,
  });

  return res.send();
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  console.log("[DEBUG DELETE CONTROLLER] Remove function called");
  const { messageId } = req.params;
  const { tenantId } = req.user;

  // Debug logs para investigar o erro 400
  console.log("[DEBUG DELETE CONTROLLER] messageId from params:", messageId);
  console.log(
    "[DEBUG DELETE CONTROLLER] req.body:",
    JSON.stringify(req.body, null, 2)
  );
  console.log("[DEBUG DELETE CONTROLLER] tenantId:", tenantId);
  console.log("[DEBUG DELETE CONTROLLER] req.method:", req.method);
  console.log("[DEBUG DELETE CONTROLLER] req.url:", req.url);

  try {
    console.log(
      "[DEBUG DELETE CONTROLLER] Calling DeleteMessageSystem with params:",
      {
        id: req.body.id,
        messageId,
        tenantId,
      }
    );
    await DeleteMessageSystem(req.body.id, messageId, tenantId);
    console.log(
      "[DEBUG DELETE CONTROLLER] DeleteMessageSystem completed successfully"
    );
  } catch (error) {
    console.log("[DEBUG DELETE CONTROLLER] Error details:", error);
    logger.error(`ERR_DELETE_SYSTEM_MSG: ${error}`);
    throw new AppError("ERR_DELETE_SYSTEM_MSG");
  }

  console.log("[DEBUG DELETE CONTROLLER] Sending response");
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
      ticketIdOrigin: message.ticketId,
    });
  }

  return res.send();
};

export const markAsRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { tenantId } = req.user;

  logger.info(
    `[markAsRead] Iniciando marcação de mensagem como lida. MessageId: ${messageId}, TenantId: ${tenantId}`
  );

  try {
    const message = await Message.findOne({
      where: {
        id: messageId,
        tenantId,
      },
      include: [
        {
          model: Ticket,
          include: [{ model: Contact }],
        },
      ],
    });

    if (!message) {
      logger.warn(
        `[markAsRead] Mensagem não encontrada. MessageId: ${messageId}`
      );
      return res.status(404).json({ error: "Message not found" });
    }

    logger.info("[markAsRead] Mensagem encontrada:", {
      messageId: message.id,
      ticketId: message.ticketId,
      read: message.read,
    });

    // Marcar mensagem como lida
    await message.update({ read: true });
    logger.info("[markAsRead] Mensagem marcada como lida");

    // Atualizar contador de mensagens não lidas no ticket
    const unreadCount = await Message.count({
      where: {
        ticketId: message.ticketId,
        read: false,
        fromMe: false,
      },
    });

    logger.info(
      `[markAsRead] Novo contador de mensagens não lidas: ${unreadCount}`
    );

    await message.ticket.update({ unreadMessages: unreadCount });
    logger.info("[markAsRead] Ticket atualizado com novo contador");

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
          unreadMessages: unreadCount,
        },
      },
    });
    logger.info("[markAsRead] Evento emitido para o frontend");

    return res.status(200).json({ message: "Message marked as read" });
  } catch (err) {
    logger.error("[markAsRead] Erro ao marcar mensagem como lida:", err);
    logger.error("[markAsRead] Stack do erro:", err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const buttonResponse = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId, messageId, buttonText, buttonId } = req.body;

  try {
    logger.info(`[buttonResponse] Processando resposta do botão:`, {
      ticketId,
      messageId,
      buttonText,
      buttonId,
    });

    // Validar e converter ticketId
    const parsedTicketId = parseInt(ticketId as string, 10);
    if (isNaN(parsedTicketId)) {
      return res.status(400).json({ error: "ticketId inválido" });
    }

    // Buscar o ticket
    const ticket = await Ticket.findByPk(parsedTicketId, {
      include: [
        {
          model: Contact,
          as: "contact",
        },
        {
          model: User,
          as: "user",
        },
      ],
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    // Buscar a mensagem original que contém os botões
    const originalMessage = await Message.findByPk(messageId);
    if (!originalMessage) {
      return res.status(404).json({ error: "Mensagem original não encontrada" });
    }

    // Buscar o contato
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contato não encontrado" });
    }

    // Enviar a mensagem via Baileys como resposta ao botão
    const sentMessage = await SendWhatsAppMessage(
      contact,
      ticket,
      buttonText,
      originalMessage
    );

    logger.info(`[buttonResponse] Mensagem enviada via Baileys:`, {
      messageId: sentMessage.id,
      body: sentMessage.body,
    });

    // Atualizar os metadados da mensagem para indicar que é uma resposta de botão
    await sentMessage.update({
      dataPayload: JSON.stringify({
        isButtonResponse: true,
        originalMessageId: messageId,
        buttonId: buttonId,
        buttonText: buttonText,
      }),
    });

    // Atualizar o ticket com a nova mensagem
    await ticket.update({
      lastMessage: buttonText,
      lastMessageAt: new Date().getTime(),
      answered: true,
    });

    // Recarregar a mensagem com os relacionamentos para emitir via WebSocket
    const messageWithRelations = await Message.findByPk(sentMessage.id, {
      include: [
        {
          model: Ticket,
          as: 'ticket',
          include: [{ model: Contact, as: 'contact' }]
        },
        {
          model: Message,
          as: 'quotedMsg',
          include: [{ model: Contact, as: 'contact' }]
        }
      ]
    })

    // Emitir evento via WebSocket para atualizar o frontend em tempo real
    const io = getIO()
    const channel = `tenant:${ticket.tenantId}:appMessage`
    const eventData = {
      action: 'update',
      message: messageWithRelations,
      ticket
    }
    io.emit(channel, eventData)

    logger.info(
      `[buttonResponse] Resposta do botão enviada com sucesso: ${buttonText}`
    )

    return res.json({
      success: true,
      message: "Resposta do botão enviada com sucesso",
      data: {
        messageId: sentMessage.id,
        body: sentMessage.body,
      },
    });
  } catch (error) {
    logger.error(`[buttonResponse] Erro:`, error);
    return res.status(500).json({
      error: "Erro interno do servidor",
      details: error.message,
    });
  }
};
