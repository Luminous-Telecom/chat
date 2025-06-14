import { Request, Response } from "express";
import CreateTicketObservationService from "../services/TicketObservationService";
import TicketObservation from "../models/TicketObservation";
import Ticket from "../models/Ticket";
import User from "../models/User";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { tenantId } = req.user;

  const ticket = await Ticket.findOne({
    where: { id: ticketId, tenantId }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const observations = await TicketObservation.findAll({
    where: { ticketId, tenantId },
    include: [
      {
        model: User,
        attributes: ["id", "name"]
      }
    ],
    order: [["createdAt", "DESC"]]
  });

  return res.json(observations);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  logger.info("[TicketObservationController] Request completo:", {
    body: req.body,
    file: req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      destination: req.file.destination,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    } : null,
    params: req.params,
    query: req.query,
    headers: req.headers,
    rawBody: req.body,
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body),
    bodyValues: Object.values(req.body).map(v => ({ value: v, type: typeof v }))
  });

  const { ticketId: ticketIdParam } = req.params;
  const { texto } = req.body;
  const anexo = req.file?.filename;
  const { id: userId, tenantId } = req.user;

  logger.info("[TicketObservationController] Dados extraídos:", {
    params: req.params,
    body: req.body,
    file: req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      destination: req.file.destination,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    } : null,
    user: req.user,
    ticketIdParam,
    texto,
    textoType: typeof texto,
    textoValue: texto,
    textoLength: texto?.length,
    anexo,
    anexoType: typeof anexo,
    userId,
    tenantId,
    ticketIdParamType: typeof ticketIdParam,
    ticketIdParamValue: ticketIdParam,
    ticketIdParamParsed: Number(ticketIdParam),
    isNaN: isNaN(Number(ticketIdParam))
  });

  // Validação dos dados
  if (!ticketIdParam || isNaN(Number(ticketIdParam))) {
    logger.error("[TicketObservationController] ticketId inválido:", {
      ticketIdParam,
      ticketIdParamType: typeof ticketIdParam,
      ticketIdParamValue: ticketIdParam,
      ticketIdParamParsed: Number(ticketIdParam),
      isNaN: isNaN(Number(ticketIdParam))
    });
    throw new AppError("ERR_INVALID_TICKET_ID", 400);
  }

  if (!texto || typeof texto !== "string") {
    logger.error("[TicketObservationController] texto inválido:", {
      texto,
      textoType: typeof texto,
      textoValue: texto,
      textoLength: texto?.length,
      bodyKeys: Object.keys(req.body),
      bodyValues: Object.values(req.body).map(v => ({ value: v, type: typeof v }))
    });
    throw new AppError("ERR_INVALID_TEXT", 400);
  }

  if (!userId || isNaN(Number(userId))) {
    logger.error("[TicketObservationController] userId inválido:", { userId });
    throw new AppError("ERR_INVALID_USER_ID", 400);
  }

  if (!tenantId || isNaN(Number(tenantId))) {
    logger.error("[TicketObservationController] tenantId inválido:", { tenantId });
    throw new AppError("ERR_INVALID_TENANT_ID", 400);
  }

  try {
    const { observation } = await CreateTicketObservationService({
      ticketId: Number(ticketIdParam),
      texto,
      anexo,
      userId: Number(userId),
      tenantId: Number(tenantId)
    });

    if (!observation) {
      logger.error("[TicketObservationController] Observação não foi criada");
      throw new AppError("ERR_OBSERVATION_NOT_CREATED", 500);
    }

    logger.info("[TicketObservationController] Observação criada com sucesso:", {
      observationId: observation.id
    });

    return res.json(observation);
  } catch (error) {
    logger.error("[TicketObservationController] Erro ao criar observação:", {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};