import { Request, Response } from "express";
import NotificationService from "../services/NotificationServices/NotificationService";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId, id: userId } = req.user;
  const { type, priority, read, startDate, endDate } = req.query;

  try {
    const notifications = NotificationService.getNotifications({
      tenantId: Number(tenantId),
      userId: Number(userId),
      type: type as any,
      priority: priority as any,
      read: read === "true",
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    return res.json(notifications);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { notificationId } = req.params;
  const { tenantId, id: userId } = req.user;

  try {
    const notifications = NotificationService.getNotifications({
      tenantId: Number(tenantId),
      userId: Number(userId)
    });

    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    return res.json(notification);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<Response> => {
  const { notificationId } = req.params;
  const { id: userId } = req.user;

  try {
    await NotificationService.markAsRead(notificationId, Number(userId));
    return res.send();
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId, id: userId } = req.user;

  try {
    await NotificationService.markAllAsRead(Number(userId), Number(tenantId));
    return res.send();
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const deleteNotification = async (req: Request, res: Response): Promise<Response> => {
  const { notificationId } = req.params;
  const { tenantId, id: userId } = req.user;

  try {
    await NotificationService.deleteNotification(notificationId, Number(userId), Number(tenantId));
    return res.send();
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const clearNotifications = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId, id: userId } = req.user;

  try {
    await NotificationService.clearNotifications(Number(userId), Number(tenantId));
    return res.send();
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
}; 