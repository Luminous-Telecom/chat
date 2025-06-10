import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as NotificationController from "../controllers/NotificationController";

const notificationRoutes = Router();

notificationRoutes.get("/notifications", isAuth, NotificationController.index);
notificationRoutes.get("/notifications/:id", isAuth, NotificationController.show);
notificationRoutes.put("/notifications/:id/read", isAuth, NotificationController.markAsRead);
notificationRoutes.put("/notifications/read-all", isAuth, NotificationController.markAllAsRead);
notificationRoutes.delete("/notifications/:id", isAuth, NotificationController.deleteNotification);
notificationRoutes.delete("/notifications", isAuth, NotificationController.clearNotifications);

export default notificationRoutes; 