import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";
import User from "../../models/User";
import Setting from "../../models/Setting";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import { handleError } from "../../utils/errorHandler";

export type NotificationType = 
  | "ticket" 
  | "message" 
  | "whatsapp" 
  | "system" 
  | "error";

export type NotificationPriority = 
  | "low" 
  | "medium" 
  | "high" 
  | "critical";

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: any;
  tenantId: number;
  userId?: number;
  read: boolean;
  createdAt: Date;
}

class NotificationService {
  private static instance: NotificationService;
  private notifications: Map<string, Notification>;
  private readonly MAX_NOTIFICATIONS = 1000;

  private constructor() {
    this.notifications = new Map();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async createNotification(params: {
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    data?: any;
    tenantId: number;
    userId?: number;
  }): Promise<Notification> {
    try {
      // Validar parâmetros
      if (!params.type || !params.priority || !params.title || !params.message || !params.tenantId) {
        throw new AppError("Missing required notification parameters", 400);
      }

      const notification: Notification = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...params,
        read: false,
        createdAt: new Date()
      };

      // Limitar número de notificações
      if (this.notifications.size >= this.MAX_NOTIFICATIONS) {
        const oldestNotification = Array.from(this.notifications.values())
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        if (oldestNotification) {
          this.notifications.delete(oldestNotification.id);
          logger.debug('Removed oldest notification to make room for new one', {
            id: oldestNotification.id,
            type: oldestNotification.type
          });
        }
      }

      this.notifications.set(notification.id, notification);

      // Emitir notificação via WebSocket
      await this.emitNotification(notification).catch(err => {
        logger.warn('Failed to emit notification via WebSocket', {
          error: err.message,
          notificationId: notification.id
        });
      });

      // Enviar notificações por email se configurado
      await this.sendEmailNotifications(notification).catch(err => {
        logger.warn('Failed to send email notifications', {
          error: err.message,
          notificationId: notification.id
        });
      });

      // Log da notificação
      logger.info("New notification created", {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
        tenantId: notification.tenantId,
        userId: notification.userId
      });

      return notification;
    } catch (err) {
      handleError(err, 'NotificationService.createNotification');
      throw err;
    }
  }

  private async emitNotification(notification: Notification): Promise<void> {
    try {
      const io = getIO();
      if (!io) {
        throw new AppError("Socket.IO not initialized", 500);
      }

      // Emitir para usuário específico se houver
      if (notification.userId) {
        io.emit(`${notification.tenantId}:user:${notification.userId}:notification`, notification);
        logger.debug('Emitted notification to specific user', {
          notificationId: notification.id,
          userId: notification.userId
        });
      }

      // Emitir para todos os usuários do tenant
      io.emit(`${notification.tenantId}:notification`, notification);
      logger.debug('Emitted notification to all tenant users', {
        notificationId: notification.id,
        tenantId: notification.tenantId
      });
    } catch (err) {
      handleError(err, 'NotificationService.emitNotification');
      throw err;
    }
  }

  private async sendEmailNotifications(notification: Notification): Promise<void> {
    try {
      // Buscar configurações de email do tenant
      const settings = await Setting.findOne({
        where: {
          tenantId: notification.tenantId,
          key: "emailNotifications"
        }
      });

      if (!settings?.value) {
        logger.debug('Email notifications not configured for tenant', {
          tenantId: notification.tenantId
        });
        return;
      }

      const emailSettings = JSON.parse(settings.value);
      if (!emailSettings.enabled) {
        logger.debug('Email notifications disabled for tenant', {
          tenantId: notification.tenantId
        });
        return;
      }

      // Buscar usuários que devem receber notificações
      const users = await User.findAll({
        where: {
          tenantId: notification.tenantId,
          profile: "admin",
          emailNotifications: true
        }
      });

      if (!users.length) {
        logger.debug('No users configured to receive email notifications', {
          tenantId: notification.tenantId
        });
        return;
      }

      // Filtrar usuários por prioridade da notificação
      const usersToNotify = users.filter(user => {
        const userPriority = emailSettings.priorityLevels[user.id] || "medium";
        const priorityLevels = { low: 0, medium: 1, high: 2, critical: 3 };
        return priorityLevels[notification.priority] >= priorityLevels[userPriority];
      });

      if (!usersToNotify.length) {
        logger.debug('No users match notification priority level', {
          notificationId: notification.id,
          priority: notification.priority
        });
        return;
      }

      // TODO: Implementar envio de email
      logger.info("Would send email notifications", {
        notificationId: notification.id,
        usersCount: usersToNotify.length,
        priority: notification.priority
      });
    } catch (err) {
      handleError(err, 'NotificationService.sendEmailNotifications');
      // Não propagar erro para não interromper o fluxo principal
      logger.warn('Error in email notification process', {
        error: err.message,
        notificationId: notification.id
      });
    }
  }

  public async markAsRead(notificationId: string, userId: number): Promise<void> {
    try {
      const notification = this.notifications.get(notificationId);
      if (!notification) {
        throw new AppError("Notification not found", 404);
      }

      notification.read = true;
      this.notifications.set(notificationId, notification);

      // Emitir atualização
      const io = getIO();
      if (!io) {
        throw new AppError("Socket.IO not initialized", 500);
      }

      io.emit(`${notification.tenantId}:user:${userId}:notification:read`, {
        notificationId,
        read: true
      });

      logger.debug('Notification marked as read', {
        notificationId,
        userId
      });
    } catch (err) {
      handleError(err, 'NotificationService.markAsRead');
      throw err;
    }
  }

  public async markAllAsRead(userId: number, tenantId: number): Promise<void> {
    try {
      const userNotifications = Array.from(this.notifications.values())
        .filter(n => n.tenantId === tenantId && (!n.userId || n.userId === userId));

      if (!userNotifications.length) {
        logger.debug('No notifications found to mark as read', {
          userId,
          tenantId
        });
        return;
      }

      userNotifications.forEach(notification => {
        notification.read = true;
        this.notifications.set(notification.id, notification);
      });

      // Emitir atualização
      const io = getIO();
      if (!io) {
        throw new AppError("Socket.IO not initialized", 500);
      }

      io.emit(`${tenantId}:user:${userId}:notifications:read:all`);

      logger.debug('All notifications marked as read', {
        userId,
        tenantId,
        count: userNotifications.length
      });
    } catch (err) {
      handleError(err, 'NotificationService.markAllAsRead');
      throw err;
    }
  }

  public getNotifications(params: {
    tenantId: number;
    userId?: number;
    type?: NotificationType;
    priority?: NotificationPriority;
    read?: boolean;
    startDate?: Date;
    endDate?: Date;
  }): Notification[] {
    try {
      if (!params.tenantId) {
        throw new AppError("Tenant ID is required", 400);
      }

      let notifications = Array.from(this.notifications.values());

      // Filtrar por tenant
      notifications = notifications.filter(n => n.tenantId === params.tenantId);

      // Filtrar por usuário
      if (params.userId) {
        notifications = notifications.filter(n => !n.userId || n.userId === params.userId);
      }

      // Filtrar por tipo
      if (params.type) {
        notifications = notifications.filter(n => n.type === params.type);
      }

      // Filtrar por prioridade
      if (params.priority) {
        notifications = notifications.filter(n => n.priority === params.priority);
      }

      // Filtrar por status de leitura
      if (typeof params.read === "boolean") {
        notifications = notifications.filter(n => n.read === params.read);
      }

      // Filtrar por data
      if (params.startDate) {
        notifications = notifications.filter(n => n.createdAt >= params.startDate!);
      }
      if (params.endDate) {
        notifications = notifications.filter(n => n.createdAt <= params.endDate!);
      }

      // Ordenar por data (mais recentes primeiro)
      return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (err) {
      handleError(err, 'NotificationService.getNotifications');
      throw err;
    }
  }

  public async deleteNotification(notificationId: string, userId: number, tenantId: number): Promise<void> {
    try {
      const notification = this.notifications.get(notificationId);
      if (!notification) {
        throw new AppError("Notification not found", 404);
      }

      if (notification.tenantId !== tenantId) {
        throw new AppError("Unauthorized to delete this notification", 403);
      }

      this.notifications.delete(notificationId);

      // Emitir atualização
      const io = getIO();
      if (!io) {
        throw new AppError("Socket.IO not initialized", 500);
      }

      io.emit(`${tenantId}:user:${userId}:notification:deleted`, { notificationId });

      logger.debug('Notification deleted', {
        notificationId,
        userId,
        tenantId
      });
    } catch (err) {
      handleError(err, 'NotificationService.deleteNotification');
      throw err;
    }
  }

  public async clearNotifications(userId: number, tenantId: number): Promise<void> {
    try {
      const userNotifications = Array.from(this.notifications.values())
        .filter(n => n.tenantId === tenantId && (!n.userId || n.userId === userId));

      if (!userNotifications.length) {
        logger.debug('No notifications found to clear', {
          userId,
          tenantId
        });
        return;
      }

      userNotifications.forEach(notification => {
        this.notifications.delete(notification.id);
      });

      // Emitir atualização
      const io = getIO();
      if (!io) {
        throw new AppError("Socket.IO not initialized", 500);
      }

      io.emit(`${tenantId}:user:${userId}:notifications:cleared`);

      logger.debug('All notifications cleared', {
        userId,
        tenantId,
        count: userNotifications.length
      });
    } catch (err) {
      handleError(err, 'NotificationService.clearNotifications');
      throw err;
    }
  }
}

export default NotificationService.getInstance();