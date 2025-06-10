import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as CallController from "../controllers/CallController";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import { getBaileys } from "../libs/baileys";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";
import BaileysCallHandler from "../services/BaileysServices/BaileysCallHandler";

interface CallInfo {
  id: string;
  from: string;
  timestamp: number;
  type: 'audio' | 'video';
  status: 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected';
  duration?: number;
  ticketId?: number;
}

const callRoutes = Router();

callRoutes.get("/", isAuth, CallController.index);

callRoutes.get("/:callId", isAuth, CallController.show);

callRoutes.post("/", isAuth, async (req, res) => {
  const { ticketId, type } = req.body;
  const { tenantId } = req.user;

  try {
    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND", 404);
    }

    if (!ticket.whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND", 404);
    }

    const wbot = getBaileys(ticket.whatsapp.id);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION", 404);
    }

    if (!wbot.user?.id) {
      throw new AppError("ERR_NO_WHATSAPP_USER", 404);
    }

    // Criar chamada usando o BaileysCallHandler
    const callId = Date.now().toString();
    const callInfo: CallInfo = {
      id: callId,
      from: wbot.user.id,
      timestamp: Date.now(),
      type: type === "video" ? "video" : "audio",
      status: "ringing",
      ticketId: ticket.id
    };

    // Emitir evento de chamada iniciada
    const io = getIO();
    io.to(ticketId.toString()).emit("appCall", {
      action: "create",
      call: callInfo,
      ticket,
      contact: ticket.contact
    });

    return res.json(callInfo);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
});

callRoutes.put("/:callId/end", isAuth, async (req, res) => {
  const { callId } = req.params;
  const { status } = req.body;
  const { tenantId } = req.user;

  try {
    const call = await CallController.show(req, res);
    if (!call) {
      throw new AppError("ERR_NO_CALL_FOUND", 404);
    }

    const callData = call as unknown as CallInfo;
    if (!callData.ticketId) {
      throw new AppError("ERR_NO_TICKET_ID", 400);
    }

    // Atualizar status da chamada
    const updatedCall: CallInfo = {
      ...callData,
      status: status as CallInfo['status'],
      duration: Date.now() - callData.timestamp
    };

    // Emitir evento de chamada finalizada
    const io = getIO();
    io.to(callData.ticketId.toString()).emit("appCall", {
      action: "update",
      call: updatedCall
    });

    return res.json(updatedCall);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
});

export default callRoutes;