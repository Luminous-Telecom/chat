import express from "express";
import isAuth from "../middleware/isAuth";

import * as WhatsAppController from "../controllers/WhatsAppController";

const whatsappRoutes = express.Router();

whatsappRoutes.get("/whatsapp/", isAuth, WhatsAppController.index);

whatsappRoutes.get("/whatsapp/:whatsappId", isAuth, WhatsAppController.show);

whatsappRoutes.put("/whatsapp/:whatsappId", isAuth, WhatsAppController.update);
whatsappRoutes.post("/whatsapp", isAuth, WhatsAppController.store);

whatsappRoutes.delete(
  "/whatsapp/:whatsappId",
  isAuth,
  WhatsAppController.remove
);

// Novas rotas para gerenciamento de sessões
whatsappRoutes.post(
  "/whatsapp/:whatsappId/regenerate-session",
  isAuth,
  WhatsAppController.regenerateSession
);

whatsappRoutes.post(
  "/whatsapp/clear-all-sessions",
  isAuth,
  WhatsAppController.clearAllSessions
);

whatsappRoutes.get(
  "/whatsapp/sessions/status",
  isAuth,
  WhatsAppController.getSessionsStatus
);

export default whatsappRoutes;
