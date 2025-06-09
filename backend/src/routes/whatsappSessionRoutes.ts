import { Router } from "express";
import isAuth from "../middleware/isAuth";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";

const whatsappSessionRoutes = Router();

whatsappSessionRoutes.post(
  "/:whatsappId",
  isAuth,
  WhatsAppSessionController.store
);

whatsappSessionRoutes.put(
  "/:whatsappId",
  isAuth,
  WhatsAppSessionController.update
);

whatsappSessionRoutes.delete(
  "/:whatsappId",
  isAuth,
  WhatsAppSessionController.remove
);

whatsappSessionRoutes.post(
  "/:whatsappId/clear-cache",
  isAuth,
  WhatsAppSessionController.clearCache
);

export default whatsappSessionRoutes;
