import { Op } from "sequelize";
import TicketObservation from "../models/TicketObservation";
import Ticket from "../models/Ticket";
import User from "../models/User";
import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";

interface Request {
  ticketId: number;
  texto: string;
  anexo?: string;
  userId: number;
  tenantId: number;
}

interface Response {
  observation: TicketObservation | null;
}

const CreateTicketObservationService = async ({
  ticketId,
  texto,
  anexo,
  userId,
  tenantId
}: Request): Promise<Response> => {
  logger.info(`[CreateTicketObservationService] Recebendo dados:`, {
    ticketId,
    texto,
    anexo,
    userId,
    tenantId,
    tenantIdType: typeof tenantId
  });

  const ticket = await Ticket.findOne({
    where: { id: ticketId, tenantId }
  });

  if (!ticket) {
    logger.error(`[CreateTicketObservationService] Ticket não encontrado:`, {
      ticketId,
      tenantId
    });
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  try {
    const observation = await TicketObservation.create({
      texto,
      anexo,
      ticketId,
      userId,
      tenantId
    });

    logger.info(`[CreateTicketObservationService] Observação criada:`, {
      observationId: observation.id
    });

    const observationWithUser = await TicketObservation.findByPk(observation.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name"]
        }
      ]
    });

    if (!observationWithUser) {
      logger.error(`[CreateTicketObservationService] Observação não encontrada após criação:`, {
        observationId: observation.id
      });
      throw new AppError("ERR_OBSERVATION_NOT_FOUND", 404);
    }

    const io = getIO();
    io.to(`tenant-${tenantId}`).emit("ticketObservation:create", {
      observation: observationWithUser
    });

    return { observation: observationWithUser };
  } catch (error) {
    logger.error(`[CreateTicketObservationService] Erro ao criar observação:`, {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

export default CreateTicketObservationService;