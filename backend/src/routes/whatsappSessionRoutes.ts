import { Router } from "express";
import isAuth from "../middleware/isAuth";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";
import { StartBaileysSession } from "../services/BaileysServices/StartBaileysSession";
import BaileysConnectionStatus from "../services/BaileysServices/BaileysConnectionStatus";
import { getBaileys } from "../libs/baileys";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";

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

whatsappSessionRoutes.post("/:whatsappId/start", isAuth, async (req, res) => {
  try {
    const { whatsappId } = req.params;
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      return res.status(404).json({ error: "WhatsApp not found" });
    }

    await StartBaileysSession(whatsapp);
    await BaileysConnectionStatus(whatsapp);

    return res.json({ message: "Session started successfully" });
  } catch (err) {
    logger.error(`Error starting WhatsApp session: ${err}`);
    return res.status(500).json({ error: err.message });
  }
});

export default whatsappSessionRoutes;
