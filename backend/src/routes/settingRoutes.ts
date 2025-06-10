import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as SettingController from "../controllers/SettingController";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import Setting from "../models/Setting";

const settingRoutes = Router();

settingRoutes.get("/", isAuth, SettingController.index);

settingRoutes.put("/:key", isAuth, SettingController.update);

settingRoutes.post("/test-connection", isAuth, async (req, res) => {
  try {
    const { whatsappId } = req.body;

    const setting = await Setting.findOne({
      where: { key: 'testNumber' }
    });

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Testar conexão enviando mensagem de teste
    const testNumber = setting?.value || whatsapp.number;
    await wbot.sendMessage(
      testNumber + '@s.whatsapp.net',
      { text: "Teste de conexão - " + new Date().toLocaleString() }
    );

    return res.json({ message: "Connection test successful" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

settingRoutes.post("/notify", isAuth, async (req, res) => {
  try {
    const { whatsappId, message } = req.body;

    const setting = await Setting.findOne({
      where: { key: 'notifyNumber' }
    });

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Enviar notificação
    const notifyNumber = setting?.value || whatsapp.number;
    await wbot.sendMessage(
      notifyNumber + '@s.whatsapp.net',
      { text: message }
    );

    return res.json({ message: "Notification sent successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default settingRoutes;
