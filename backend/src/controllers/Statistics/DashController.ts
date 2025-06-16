import { Request, Response } from "express";
import { ParsedQs } from "qs";
// import * as Yup from "yup";
import DashTicketsAndTimes from "../../services/Statistics/DashTicketsAndTimes";
import DashTicketsChannels from "../../services/Statistics/DashTicketsChannels";
import DashTicketsEvolutionChannels from "../../services/Statistics/DashTicketsEvolutionChannels";
import DashTicketsEvolutionByPeriod from "../../services/Statistics/DashTicketsEvolutionByPeriod";
import DashTicketsPerUsersDetail from "../../services/Statistics/DashTicketsPerUsersDetail";
import DashTicketsQueue from "../../services/Statistics/DashTicketsQueue";
import DashTicketsInstances from "../../services/Statistics/DashTicketsInstances";
import DashTicketsEvolutionByQueue from "../../services/Statistics/DashTicketsEvolutionByQueue";
// import AppError from "../errors/AppError";

type IndexQuery = {
  startDate: string;
  endDate: string;
  queuesIds?: number[];
};

const validateQuery = (query: ParsedQs): IndexQuery => {
  const { startDate, endDate, queuesIds } = query;
  
  if (!startDate || !endDate) {
    throw new Error("startDate e endDate são obrigatórios");
  }

  let parsedQueuesIds: number[] | undefined;
  if (queuesIds) {
    parsedQueuesIds = Array.isArray(queuesIds)
      ? queuesIds.map(Number)
      : [Number(queuesIds)];
  }

  return {
    startDate: startDate as string,
    endDate: endDate as string,
    queuesIds: parsedQueuesIds
  };
};

export const getDashTicketsAndTimes = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const query = validateQuery(req.query);
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsAndTimes({
    startDate: query.startDate,
    endDate: query.endDate,
    tenantId,
    userId,
    userProfile
  });

  return res.json(data);
};

export const getDashTicketsChannels = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const query = validateQuery(req.query);
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsChannels({
    startDate: query.startDate,
    endDate: query.endDate,
    tenantId,
    userId,
    userProfile
  });

  return res.json(data);
};

export const getDashTicketsEvolutionChannels = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const query = validateQuery(req.query);
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsEvolutionChannels({
    startDate: query.startDate,
    endDate: query.endDate,
    tenantId,
    userId,
    userProfile
  });

  return res.json(data);
};

export const getDashTicketsEvolutionByPeriod = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const query = validateQuery(req.query);
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsEvolutionByPeriod({
    startDate: query.startDate,
    endDate: query.endDate,
    tenantId,
    userId,
    userProfile
  });

  return res.json(data);
};

export const getDashTicketsPerUsersDetail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const query = validateQuery(req.query);
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsPerUsersDetail({
    startDate: query.startDate,
    endDate: query.endDate,
    tenantId,
    userId,
    userProfile
  });

  return res.json(data);
};

export const getDashTicketsQueue = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const query = validateQuery(req.query);
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsQueue({
    startDate: query.startDate,
    endDate: query.endDate,
    tenantId,
    userId,
    userProfile
  });

  return res.json(data);
};

export const getDashTicketsEvolutionByQueue = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { tenantId } = req.user;
    const query = validateQuery(req.query);
    const userId = req.user.id;
    const userProfile = req.user.profile;

    const data = await DashTicketsEvolutionByQueue({
      startDate: query.startDate,
      endDate: query.endDate,
      tenantId,
      userId,
      userProfile
    });

    return res.json(data);
  } catch (error) {
    console.error("Erro ao buscar evolução por fila:", error);
    return res.status(500).json({ error: "Erro ao buscar evolução por fila" });
  }
};

export const getDashTicketsInstances = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const query = validateQuery(req.query);
  const userId = req.user.id;
  const userProfile = req.user.profile;

  try {
    const data = await DashTicketsInstances({
      startDate: query.startDate,
      endDate: query.endDate,
      tenantId,
      userId,
      userProfile
    });

    if (!data) return res.status(200).json([]);

    return res.status(200).json(data);
  } catch (error) {
    console.error("Erro ao buscar dados das instâncias:", error);
    return res.status(500).json({ error: "Erro ao buscar dados das instâncias" });
  }
};
