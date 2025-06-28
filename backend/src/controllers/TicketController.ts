import { Request, Response } from "express";
import { Op } from "sequelize";
// import GetWbotMessage from "../helpers/GetWbotMessage";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import CreateLogTicketService from "../services/TicketServices/CreateLogTicketService";
import User from "../models/User";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowLogTicketService from "../services/TicketServices/ShowLogTicketService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import TicketParticipantService from "../services/TicketServices/TicketParticipantService";
import CreateMessageSystemService from "../services/MessageServices/CreateMessageSystemService";
import { pupa } from "../utils/pupa";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { logger } from "../utils/logger";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string[];
  date: string;
  showAll: string;
  withUnreadMessages: string;
  queuesIds: string[];
  isNotAssignedUser: string;
  includeNotQueueDefined: string;
  onlyUserTickets: string;
};

interface TicketData {
  contactId: number;
  status: string;
  userId: number;
  isActiveDemand: boolean;
  tenantId: string | number;
  channel: string;
  channelId?: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId, profile } = req.user;
  const {
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    withUnreadMessages,
    queuesIds,
    isNotAssignedUser,
    includeNotQueueDefined,
    onlyUserTickets,
  } = req.query as IndexQuery;

  const userId = req.user.id;

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    userId,
    withUnreadMessages,
    queuesIds,
    isNotAssignedUser,
    includeNotQueueDefined,
    onlyUserTickets,
    tenantId,
    profile,
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const {
    contactId,
    status,
    userId,
    channel,
    channelId
  }: TicketData = req.body;

  const ticket = await CreateTicketService({
    contactId,
    status,
    userId,
    tenantId,
    channel,
    channelId,
  });

  // se ticket criado pelo próprio usuário, não emitir socket.
  if (!userId) {
    const io = getIO();
    io.to(`${tenantId}:${ticket.status}`).emit(`${tenantId}:ticket`, {
      action: "create",
      ticket,
    });
  }

  return res.status(200).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { tenantId } = req.user;
  const userId = req.user.id;

  // Executar consultas em paralelo para melhorar performance
  const [ticket, scheduledMessages] = await Promise.all([
    ShowTicketService({ id: ticketId, tenantId }),
    Message.findAll({
      where: {
        scheduleDate: { [Op.not]: null },
        status: "pending",
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"]
        }
      ]
    })
  ]);

  // Atualizar o contactId na consulta de mensagens agendadas
  if (ticket && scheduledMessages.length > 0) {
    scheduledMessages.forEach(msg => {
      msg.setDataValue('contactId', ticket.contactId);
    });
  }

  // Filtrar apenas mensagens agendadas do contato atual
  const filteredScheduledMessages = scheduledMessages.filter(
    msg => msg.getDataValue('contactId') === ticket?.contactId
  );

  ticket.setDataValue("scheduledMessages", filteredScheduledMessages);

  // Executar log em paralelo para não bloquear a resposta
  CreateLogTicketService({
    userId,
    ticketId,
    type: "access",
  }).catch(err => {
    logger.error(`[TicketController.show] Erro ao criar log: ${err}`);
  });

  return res.status(200).json(ticket);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { tenantId } = req.user;
  const userIdRequest = req.user.id;
  const { isTransference } = req.body;

  const ticketData: TicketData = { ...req.body, tenantId };

  const { ticket } = await UpdateTicketService({
    ticketData,
    ticketId,
    isTransference,
    userIdRequest,
  });

  if (ticket.status === "closed") {
    const whatsapp = await Whatsapp.findOne({
      where: { id: ticket.whatsappId, tenantId },
    });
    if (whatsapp?.farewellMessage) {
      const body = pupa(whatsapp.farewellMessage || "", {
        protocol: ticket.protocol,
        name: ticket.contact.name,
      });
      const messageData = {
        msg: { body, fromMe: true, read: true },
        tenantId,
        ticket,
        userId: req.user.id,
        sendType: "bot",
        status: "pending",
        isTransfer: false,
        note: false,
      };
      await CreateMessageSystemService(messageData);
      ticket.update({ isFarewellMessage: true });
    }
  }

  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { tenantId } = req.user;
  const userId = req.user.id;

  const ticket = await DeleteTicketService({ id: ticketId, tenantId, userId });

  const io = getIO();
  io.to(`${tenantId}:${ticket.status}`)
    .to(`${tenantId}:${ticketId}`)
    .to(`${tenantId}:notification`)
    .emit(`${tenantId}:ticket`, {
      action: "delete",
      ticketId: parseInt(ticketId, 10),
    });

  return res.status(200).json({ message: "ticket deleted" });
};

export const showLogsTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  const logsTicket = await ShowLogTicketService({ ticketId });

  return res.status(200).json(logsTicket);
};

export const markAllAsRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { tenantId } = req.user;

  try {
    const ticket = await ShowTicketService({ id: ticketId, tenantId });
    if (!ticket) {
      logger.warn(
        `[markAllAsRead] Ticket não encontrado. TicketId: ${ticketId}`
      );
      return res.status(404).json({ error: "Ticket not found" });
    }


    await SetTicketMessagesAsRead(ticket, true);

    return res.status(200).json({ message: "All messages marked as read" });
  } catch (error) {
    logger.error("[markAllAsRead] Erro ao marcar mensagens como lidas:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const joinConversation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { tenantId } = req.user;
  const userId = req.user.id;

  try {
    logger.info(`[joinConversation] Iniciando - TicketId: ${ticketId}, UserId: ${userId}, TenantId: ${tenantId}`);

    const participantService = new TicketParticipantService();

    // Verificar se o ticket existe
    const ticket = await ShowTicketService({ id: ticketId, tenantId });
    if (!ticket) {
      logger.warn(`[joinConversation] Ticket não encontrado - TicketId: ${ticketId}`);
      return res.status(404).json({ error: "Ticket not found" });
    }

    logger.info(`[joinConversation] Ticket encontrado - Owner: ${ticket.userId}, Current User: ${userId}`);

    // Verificar se o usuário já é o dono do ticket
    if (ticket.userId === parseInt(userId, 10)) {
      logger.warn(`[joinConversation] Usuário já é o dono do ticket - TicketId: ${ticketId}, UserId: ${userId}`);
      return res.status(400).json({ error: "User is already the ticket owner" });
    }

    // Verificar se o usuário já é participante
    const isParticipant = await participantService.isUserParticipant(
      parseInt(ticketId, 10),
      parseInt(userId, 10),
      parseInt(String(tenantId), 10)
    );

    logger.info(`[joinConversation] Verificação de participante - IsParticipant: ${isParticipant}`);

    if (isParticipant) {
      logger.warn(`[joinConversation] Usuário já é participante - TicketId: ${ticketId}, UserId: ${userId}`);
      return res.status(400).json({ error: "User is already a participant" });
    }

    // Adicionar como participante
    logger.info(`[joinConversation] Adicionando participante - TicketId: ${ticketId}, UserId: ${userId}`);
    const participant = await participantService.addParticipant({
      ticketId: parseInt(ticketId, 10),
      userId: parseInt(userId, 10),
      tenantId: parseInt(String(tenantId), 10),
    });

    logger.info(`[joinConversation] Participante adicionado com sucesso - ParticipantId: ${participant.id}`);

    // Log da ação
    await CreateLogTicketService({
      userId: parseInt(userId, 10),
      ticketId: parseInt(ticketId, 10),
      type: "access",
    });

    // Emitir socket para notificar outros usuários
    const io = getIO();
    const participants = await participantService.getTicketParticipants(
      parseInt(ticketId, 10),
      parseInt(String(tenantId), 10)
    );

    io.to(`${tenantId}:${ticket.status}`)
      .to(`${tenantId}:${ticketId}`)
      .emit(`${tenantId}:ticket`, {
        action: "participant_joined",
        ticket: {
          ...ticket.toJSON(),
          participants: participants.map((p) => (p.toJSON ? p.toJSON() : p)),
        },
        participant: participant.toJSON ? participant.toJSON() : participant,
      });

    return res.status(200).json({
      message: "Successfully joined conversation",
      participant
    });
  } catch (error) {
    logger.error("[joinConversation] Erro ao entrar na conversa:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const leaveConversation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { tenantId } = req.user;
  const userId = req.user.id;

  try {
    const participantService = new TicketParticipantService();

    // Verificar se o ticket existe
    const ticket = await ShowTicketService({ id: ticketId, tenantId });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Não permitir que o dono saia da conversa
    if (ticket.userId === parseInt(userId, 10)) {
      return res.status(400).json({ error: "Ticket owner cannot leave conversation" });
    }

    // Remover da conversa
    await participantService.removeParticipant({
      ticketId: parseInt(ticketId, 10),
      userId: parseInt(userId, 10),
      tenantId: parseInt(String(tenantId), 10),
    });

    // Log da ação
    await CreateLogTicketService({
      userId: parseInt(userId, 10),
      ticketId: parseInt(ticketId, 10),
      type: "access",
    });

    // Emitir socket para notificar outros usuários
    const io = getIO();
    const participants = await participantService.getTicketParticipants(
      parseInt(ticketId, 10),
      parseInt(String(tenantId), 10)
    );

    io.to(`${tenantId}:${ticket.status}`)
      .to(`${tenantId}:${ticketId}`)
      .emit(`${tenantId}:ticket`, {
        action: "participant_left",
        ticket: {
          ...ticket.toJSON(),
          participants: participants.map((p) => (p.toJSON ? p.toJSON() : p)),
        },
        userId,
      });

    return res.status(200).json({
      message: "Successfully left conversation"
    });
  } catch (error) {
    logger.error("[leaveConversation] Erro ao sair da conversa:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getParticipants = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { tenantId } = req.user;

  try {
    const participantService = new TicketParticipantService();

    const participants = await participantService.getTicketParticipants(
      parseInt(ticketId, 10),
      parseInt(String(tenantId), 10)
    );

    return res.status(200).json(participants);
  } catch (error) {
    logger.error("[getParticipants] Erro ao buscar participantes:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
