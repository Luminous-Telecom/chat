import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as WhatsAppController from "../controllers/WhatsAppController";
import { StartBaileysSession } from "../services/BaileysServices/StartBaileysSession";
import BaileysConnectionStatus from "../services/BaileysServices/BaileysConnectionStatus";
import { getBaileys } from "../libs/baileys";
import Whatsapp from "../models/Whatsapp";
import { join } from "path";
import { rm } from "fs/promises";
import { logger } from "../utils/logger";

const whatsappSessionRoutes = Router();

whatsappSessionRoutes.get("/", isAuth, WhatsAppController.index);

whatsappSessionRoutes.get("/:whatsappId", isAuth, WhatsAppController.show);

whatsappSessionRoutes.post("/", isAuth, WhatsAppController.store);

whatsappSessionRoutes.put("/:whatsappId", isAuth, WhatsAppController.update);

whatsappSessionRoutes.delete("/:whatsappId", isAuth, WhatsAppController.remove);

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
    return res.status(500).json({ error: err.message });
  }
});

whatsappSessionRoutes.post("/:whatsappId/stop", isAuth, async (req, res) => {
  try {
    const { whatsappId } = req.params;
    const wbot = getBaileys(parseInt(whatsappId));

    if (!wbot) {
      return res.status(404).json({ error: "WhatsApp session not found" });
    }

    await wbot.logout();
    wbot.end(undefined);

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (whatsapp) {
      await whatsapp.update({ status: "DISCONNECTED" });
    }

    return res.json({ message: "Session stopped successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

whatsappSessionRoutes.post("/:whatsappId/restart", isAuth, async (req, res) => {
  try {
    const { whatsappId } = req.params;
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      return res.status(404).json({ error: "WhatsApp not found" });
    }

    const wbot = getBaileys(parseInt(whatsappId));
    if (wbot) {
      await wbot.logout();
      wbot.end(undefined);
    }

    await StartBaileysSession(whatsapp);
    await BaileysConnectionStatus(whatsapp);

    return res.json({ message: "Session restarted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

whatsappSessionRoutes.post("/:whatsappId/force-new", isAuth, async (req, res) => {
  try {
    const { whatsappId } = req.params;
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      return res.status(404).json({ error: "WhatsApp not found" });
    }

    // 1. Remover sessão existente
    const wbot = getBaileys(parseInt(whatsappId));
    if (wbot) {
      logger.info(`Destroying existing session for WhatsApp ${whatsappId}`);
      await wbot.logout().catch(err => {
        logger.warn(`Error destroying session: ${err}`);
      });
      wbot.end(undefined);
    }

    // 2. Limpar pasta de sessão
    const sessionPath = join(__dirname, "..", "..", ".baileys_auth", `session-${whatsappId}`);
    try {
      await rm(sessionPath, { recursive: true, force: true });
    } catch (err) {
      logger.warn(`Error clearing session folder: ${err}`);
    }

    // 3. Atualizar status no banco
    await whatsapp.update({
      status: "DISCONNECTED",
      qrcode: null,
      session: "",
      retries: 0
    });

    // 4. Aguardar um pouco antes de iniciar nova sessão
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Iniciar nova sessão
    await StartBaileysSession(whatsapp);
    await BaileysConnectionStatus(whatsapp);

    return res.json({ message: "New session forced successfully" });
  } catch (err) {
    logger.error(`Error forcing new session: ${err}`);
    return res.status(500).json({ error: err.message });
  }
});

export default whatsappSessionRoutes;