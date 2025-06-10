import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { getBaileys } from "../libs/baileys";
import BaileysCallHandler from "../services/BaileysServices/BaileysCallHandler";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.query;
  const { tenantId } = req.user;

  try {
    if (!whatsappId) {
      throw new AppError("WhatsApp ID é obrigatório", 400);
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: Number(whatsappId), tenantId: Number(tenantId) }
    });

    if (!whatsapp) {
      throw new AppError("WhatsApp não encontrado", 404);
    }

    const activeCalls = BaileysCallHandler.getActiveCalls();
    const whatsappCalls = activeCalls.filter(call => {
      const wbot = getBaileys(whatsapp.id);
      return wbot?.user?.id && call.from.includes(wbot.user.id.split(':')[0]);
    });

    return res.json(whatsappCalls);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { callId } = req.params;
  const { whatsappId } = req.query;
  const { tenantId } = req.user;

  try {
    if (!whatsappId) {
      throw new AppError("WhatsApp ID é obrigatório", 400);
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: Number(whatsappId), tenantId: Number(tenantId) }
    });

    if (!whatsapp) {
      throw new AppError("WhatsApp não encontrado", 404);
    }

    const call = BaileysCallHandler.getActiveCall(callId);
    if (!call) {
      throw new AppError("Chamada não encontrada", 404);
    }

    const wbot = getBaileys(whatsapp.id);
    if (!wbot?.user?.id || !call.from.includes(wbot.user.id.split(':')[0])) {
      throw new AppError("Chamada não pertence a esta sessão", 403);
    }

    return res.json(call);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const acceptCall = async (req: Request, res: Response): Promise<Response> => {
  const { callId } = req.params;
  const { whatsappId } = req.query;
  const { tenantId } = req.user;

  try {
    if (!whatsappId) {
      throw new AppError("WhatsApp ID é obrigatório", 400);
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: Number(whatsappId), tenantId: Number(tenantId) }
    });

    if (!whatsapp) {
      throw new AppError("WhatsApp não encontrado", 404);
    }

    const wbot = getBaileys(whatsapp.id);
    if (!wbot) {
      throw new AppError("Sessão do WhatsApp não encontrada", 404);
    }

    const call = BaileysCallHandler.getActiveCall(callId);
    if (!call) {
      throw new AppError("Chamada não encontrada", 404);
    }

    if (!wbot.user?.id || !call.from.includes(wbot.user.id.split(':')[0])) {
      throw new AppError("Chamada não pertence a esta sessão", 403);
    }

    await BaileysCallHandler.acceptCall(wbot, callId, call.from);

    const io = getIO();
    io.emit(`${tenantId}:call`, {
      action: "update",
      call: {
        ...call,
        status: "ongoing"
      }
    });

    return res.send();
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const rejectCall = async (req: Request, res: Response): Promise<Response> => {
  const { callId } = req.params;
  const { whatsappId } = req.query;
  const { tenantId } = req.user;

  try {
    if (!whatsappId) {
      throw new AppError("WhatsApp ID é obrigatório", 400);
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: Number(whatsappId), tenantId: Number(tenantId) }
    });

    if (!whatsapp) {
      throw new AppError("WhatsApp não encontrado", 404);
    }

    const wbot = getBaileys(whatsapp.id);
    if (!wbot) {
      throw new AppError("Sessão do WhatsApp não encontrada", 404);
    }

    const call = BaileysCallHandler.getActiveCall(callId);
    if (!call) {
      throw new AppError("Chamada não encontrada", 404);
    }

    if (!wbot.user?.id || !call.from.includes(wbot.user.id.split(':')[0])) {
      throw new AppError("Chamada não pertence a esta sessão", 403);
    }

    await BaileysCallHandler.rejectCall(wbot, callId, call.from);

    const io = getIO();
    io.emit(`${tenantId}:call`, {
      action: "update",
      call: {
        ...call,
        status: "rejected"
      }
    });

    return res.send();
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const endCall = async (req: Request, res: Response): Promise<Response> => {
  const { callId } = req.params;
  const { whatsappId } = req.query;
  const { tenantId } = req.user;

  try {
    if (!whatsappId) {
      throw new AppError("WhatsApp ID é obrigatório", 400);
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: Number(whatsappId), tenantId: Number(tenantId) }
    });

    if (!whatsapp) {
      throw new AppError("WhatsApp não encontrado", 404);
    }

    const wbot = getBaileys(whatsapp.id);
    if (!wbot) {
      throw new AppError("Sessão do WhatsApp não encontrada", 404);
    }

    const call = BaileysCallHandler.getActiveCall(callId);
    if (!call) {
      throw new AppError("Chamada não encontrada", 404);
    }

    if (!wbot.user?.id || !call.from.includes(wbot.user.id.split(':')[0])) {
      throw new AppError("Chamada não pertence a esta sessão", 403);
    }

    await BaileysCallHandler.endCall(wbot, callId);

    const io = getIO();
    io.emit(`${tenantId}:call`, {
      action: "update",
      call: {
        ...call,
        status: "ended",
        duration: Date.now() - call.timestamp
      }
    });

    return res.send();
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
}; 