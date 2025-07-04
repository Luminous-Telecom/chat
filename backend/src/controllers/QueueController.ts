import * as Yup from "yup";
import { Request, Response } from "express";
import { Op, fn, col } from "sequelize";
import AppError from "../errors/AppError";
import sequelize from "../database";
import Queue from "../models/Queue";
import Ticket from "../models/Ticket";

import CreateQueueService from "../services/QueueServices/CreateQueueService";
import ListQueueService from "../services/QueueServices/ListQueueService";
import DeleteQueueService from "../services/QueueServices/DeleteQueueService";
import UpdateQueueService from "../services/QueueServices/UpdateQueueService";

interface QueueData {
  queue: string;
  isActive: boolean;
  userId: number;
  tenantId: number | string;
}

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const newQueue: QueueData = { ...req.body, userId: req.user.id, tenantId };

  const schema = Yup.object().shape({
    queue: Yup.string().required(),
    userId: Yup.number().required(),
    tenantId: Yup.number().required(),
  });

  try {
    await schema.validate(newQueue);
  } catch (error) {
    throw new AppError(error.message);
  }

  const queue = await CreateQueueService(newQueue);

  return res.status(200).json(queue);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const queues = await ListQueueService({ tenantId });
  return res.status(200).json(queues);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;

  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const queueData: QueueData = { ...req.body, userId: req.user.id, tenantId };

  const schema = Yup.object().shape({
    queue: Yup.string().required(),
    isActive: Yup.boolean().required(),
    userId: Yup.number().required(),
  });

  try {
    await schema.validate(queueData);
  } catch (error) {
    throw new AppError(error.message);
  }

  const { queueId } = req.params;
  const queueObj = await UpdateQueueService({
    queueData,
    queueId,
  });

  return res.status(200).json(queueObj);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const { queueId } = req.params;

  await DeleteQueueService({ id: queueId, tenantId });
  return res.status(200).json({ message: "Queue deleted" });
};

export const getUnreadCount = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { tenantId } = req.user;

    // Contar tickets pendentes (não atendidos) por fila
    const pendingTicketsCount = await Ticket.findAll({
      where: {
        tenantId,
        status: "pending", // Tickets não atendidos
      },
      attributes: [
        "queueId",
        [fn("COUNT", col("id")), "count"], // Contar tickets ao invés de somar mensagens
      ],
      group: ["queueId"],
    });

    // Formatar os dados para o frontend
    const formattedQueues = pendingTicketsCount.map(item => ({
      queueId: item.queueId,
      count: parseInt((item as any).getDataValue("count") || "0", 10),
    }));

    return res.status(200).json({ queues: formattedQueues });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};
