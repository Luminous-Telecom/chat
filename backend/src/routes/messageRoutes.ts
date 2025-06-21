import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as MessageController from "../controllers/MessageController";

const messageRoutes = Router();

const upload = multer(uploadConfig);

messageRoutes.get(
  "/messages/contact/:contactId",
  isAuth,
  MessageController.getContactMessages
);

messageRoutes.post(
  "/messages/button-response",
  isAuth,
  MessageController.buttonResponse
);

messageRoutes.post(
  "/messages/read/:messageId",
  isAuth,
  MessageController.markAsRead
);

messageRoutes.post("/forward-messages/", isAuth, MessageController.forward);

messageRoutes.get("/messages/:ticketId", isAuth, MessageController.index);

messageRoutes.post(
  "/messages/:ticketId",
  isAuth,
  upload.array("medias"),
  MessageController.store
);

messageRoutes.put("/messages/:messageId", isAuth, MessageController.update);

messageRoutes.patch("/messages/:messageId/cancel", isAuth, MessageController.cancel);

messageRoutes.delete("/messages/:messageId", isAuth, MessageController.remove);

export default messageRoutes;
