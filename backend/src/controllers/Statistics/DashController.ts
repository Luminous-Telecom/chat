import { Request, Response } from "express";
// import * as Yup from "yup";
import DashTicketsAndTimes from "../../services/Statistics/DashTicketsAndTimes";
import DashTicketsChannels from "../../services/Statistics/DashTicketsChannels";
import DashTicketsEvolutionChannels from "../../services/Statistics/DashTicketsEvolutionChannels";
import DashTicketsEvolutionByPeriod from "../../services/Statistics/DashTicketsEvolutionByPeriod";
import DashTicketsPerUsersDetail from "../../services/Statistics/DashTicketsPerUsersDetail";
import DashTicketsQueue from "../../services/Statistics/DashTicketsQueue";
import DashTicketsInstances from "../../services/Statistics/DashTicketsInstances";
// import AppError from "../errors/AppError";

type IndexQuery = {
  startDate: string;
  endDate: string;
};

export const getDashTicketsAndTimes = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const { startDate, endDate } = req.query as IndexQuery;
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsAndTimes({
    startDate,
    endDate,
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
  const { startDate, endDate } = req.query as IndexQuery;
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsChannels({
    startDate,
    endDate,
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
  const { startDate, endDate } = req.query as IndexQuery;
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsEvolutionChannels({
    startDate,
    endDate,
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
  const { startDate, endDate } = req.query as IndexQuery;
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsEvolutionByPeriod({
    startDate,
    endDate,
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
  const { startDate, endDate } = req.query as IndexQuery;
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsPerUsersDetail({
    startDate,
    endDate,
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
  const { startDate, endDate } = req.query as IndexQuery;
  const userId = req.user.id;
  const userProfile = req.user.profile;

  const data = await DashTicketsQueue({
    startDate,
    endDate,
    tenantId,
    userId,
    userProfile
  });

  return res.json(data);
};

export const getDashTicketsInstances = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const { startDate, endDate } = req.query as IndexQuery;
  const userId = req.user.id;
  const userProfile = req.user.profile;

  console.log("Requisição recebida:", {
    tenantId,
    userId,
    userProfile,
    startDate,
    endDate
  });

  try {
    const data = await DashTicketsInstances({
      startDate,
      endDate,
      tenantId,
      userId,
      userProfile
    });

    console.log("Dados retornados do serviço:", data);

    if (!data) {
      console.log("Nenhum dado retornado do serviço");
      return res.status(200).json([]);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Erro ao buscar dados das instâncias:", error);
    return res.status(500).json({ error: "Erro ao buscar dados das instâncias" });
  }
};
