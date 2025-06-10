import { Router } from "express";

import isAuth from "../middleware/isAuth";
import * as UserController from "../controllers/UserController";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";

const userRoutes = Router();

userRoutes.get("/", isAuth, UserController.index);

userRoutes.get("/:userId", isAuth, UserController.show);

userRoutes.post("/", isAuth, UserController.store);

userRoutes.put("/:userId", isAuth, UserController.update);

userRoutes.put("/:userId/configs", isAuth, UserController.updateConfigs);

userRoutes.delete("/:userId", isAuth, UserController.remove);

userRoutes.post("/:userId/transfer-tickets", isAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { targetUserId, whatsappId } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError("ERR_NO_USER_FOUND");
    }

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
      throw new AppError("ERR_NO_TARGET_USER_FOUND");
    }

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Buscar tickets do usuário
    const tickets = await Ticket.findAll({
      where: { userId, status: "open" },
      include: ["contact"]
    });

    // Transferir tickets
    for (const ticket of tickets) {
      // Enviar mensagem de transferência
      await wbot.sendMessage(
        ticket.contact.number + '@s.whatsapp.net',
        { text: `Atendimento transferido para ${targetUser.name}` }
      );

      // Atualizar ticket
      await ticket.update({ userId: targetUserId });
    }

    return res.json({ 
      message: "Tickets transferred successfully",
      transferredCount: tickets.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

userRoutes.post("/:userId/notify", isAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { whatsappId, message } = req.body;

    const user = await User.findByPk(userId, {
      include: [{
        model: Contact,
        as: 'Contact',
        where: { isUser: true },
        required: true
      }]
    });
    
    if (!user) {
      throw new AppError("ERR_NO_USER_FOUND");
    }

    if (!user.Contact || !user.Contact[0]?.number) {
      throw new AppError("ERR_NO_USER_CONTACT_FOUND");
    }

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Enviar notificação
    await wbot.sendMessage(
      user.Contact[0].number + '@s.whatsapp.net',
      { text: message }
    );

    return res.json({ message: "Notification sent successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default userRoutes;
