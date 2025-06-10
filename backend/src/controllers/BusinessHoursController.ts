import { Request, Response } from "express";
import AppError from "../errors/AppError";
import BusinessHours from "../models/BusinessHours";
import { logger } from "../utils/logger";

interface Schedule {
  dayOfWeek: number;
  startTime: number;
  endTime: number;
}

interface BusinessHoursData {
  name: string;
  schedules: Schedule[];
  status?: "ACTIVE" | "INACTIVE";
  tenantId: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;

  try {
    const businessHours = await BusinessHours.findAll({
      where: { tenantId: Number(tenantId) },
      order: [["createdAt", "DESC"]]
    });

    return res.json(businessHours);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { businessHoursId } = req.params;
  const { tenantId } = req.user;

  try {
    const businessHours = await BusinessHours.findOne({
      where: { id: Number(businessHoursId), tenantId: Number(tenantId) }
    });

    if (!businessHours) {
      throw new AppError("ERR_NO_BUSINESSHOURS_FOUND", 404);
    }

    return res.json(businessHours);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, schedules } = req.body;
  const { tenantId } = req.user;

  try {
    const businessHoursData: BusinessHoursData = {
      name,
      schedules,
      status: "INACTIVE",
      tenantId: Number(tenantId)
    };

    const businessHours = await BusinessHours.create(businessHoursData);

    return res.status(201).json(businessHours);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { businessHoursId } = req.params;
  const { name, schedules } = req.body;
  const { tenantId } = req.user;

  try {
    const businessHours = await BusinessHours.findOne({
      where: { id: Number(businessHoursId), tenantId: Number(tenantId) }
    });

    if (!businessHours) {
      throw new AppError("ERR_NO_BUSINESSHOURS_FOUND", 404);
    }

    await businessHours.update({
      name,
      schedules
    });

    return res.json(businessHours);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { businessHoursId } = req.params;
  const { tenantId } = req.user;

  try {
    const businessHours = await BusinessHours.findOne({
      where: { id: Number(businessHoursId), tenantId: Number(tenantId) }
    });

    if (!businessHours) {
      throw new AppError("ERR_NO_BUSINESSHOURS_FOUND", 404);
    }

    await businessHours.destroy();

    return res.status(204).send();
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
}; 