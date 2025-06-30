import { Router } from "express";
import isAuth from "../middleware/isAuth";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";

const whatsappSessionRoutes = Router();

whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.store
);

whatsappSessionRoutes.put(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.update
);

whatsappSessionRoutes.delete(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.remove
);

whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId/connect-by-number",
  isAuth,
  WhatsAppSessionController.connectByNumber
);

// NOVA ROTA: Debug de sessões
whatsappSessionRoutes.get(
  "/whatsappsession/:whatsappId/debug",
  isAuth,
  WhatsAppSessionController.debugSession
);

export default whatsappSessionRoutes;
