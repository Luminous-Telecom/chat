import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as BusinessHoursController from "../controllers/BusinessHoursController";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import BusinessHours from "../models/BusinessHours";
import Whatsapp from "../models/Whatsapp";
import { proto } from "@whiskeysockets/baileys";

const businessHoursRoutes = Router();

businessHoursRoutes.get("/", isAuth, BusinessHoursController.index);

businessHoursRoutes.get("/:businessHoursId", isAuth, BusinessHoursController.show);

businessHoursRoutes.post("/", isAuth, BusinessHoursController.store);

businessHoursRoutes.put("/:businessHoursId", isAuth, BusinessHoursController.update);

businessHoursRoutes.delete("/:businessHoursId", isAuth, BusinessHoursController.remove);

businessHoursRoutes.post("/:businessHoursId/test", isAuth, async (req, res) => {
  try {
    const { businessHoursId } = req.params;
    const { whatsappId, testNumber } = req.body;

    const businessHours = await BusinessHours.findByPk(businessHoursId);
    if (!businessHours) {
      throw new AppError("ERR_NO_BUSINESSHOURS_FOUND");
    }

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Verificar horário atual
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const schedule = businessHours.schedules.find(s => s.dayOfWeek === dayOfWeek);
    if (!schedule) {
      throw new AppError("ERR_NO_SCHEDULE_FOUND");
    }

    const isOpen = currentTime >= schedule.startTime && currentTime <= schedule.endTime;

    // Enviar mensagem de teste
    const message = isOpen 
      ? `Horário de funcionamento: Aberto (${schedule.startTime}:00 - ${schedule.endTime}:00)`
      : `Horário de funcionamento: Fechado (${schedule.startTime}:00 - ${schedule.endTime}:00)`;

    await wbot.sendMessage(
      testNumber + '@s.whatsapp.net',
      { text: message }
    );

    return res.json({ 
      message: "Business hours test successful",
      isOpen,
      schedule
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

businessHoursRoutes.post("/:businessHoursId/activate", isAuth, async (req, res) => {
  try {
    const { businessHoursId } = req.params;

    const businessHours = await BusinessHours.findByPk(businessHoursId);
    if (!businessHours) {
      throw new AppError("ERR_NO_BUSINESSHOURS_FOUND");
    }

    // Ativar horário
    await businessHours.update({ 
      status: "ACTIVE",
      activatedAt: Date.now()
    });

    return res.json({ message: "Business hours activated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

businessHoursRoutes.post("/:businessHoursId/deactivate", isAuth, async (req, res) => {
  try {
    const { businessHoursId } = req.params;

    const businessHours = await BusinessHours.findByPk(businessHoursId);
    if (!businessHours) {
      throw new AppError("ERR_NO_BUSINESSHOURS_FOUND");
    }

    // Desativar horário
    await businessHours.update({ 
      status: "INACTIVE",
      deactivatedAt: Date.now()
    });

    return res.json({ message: "Business hours deactivated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default businessHoursRoutes; 