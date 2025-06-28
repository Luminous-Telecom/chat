import { Request, Response } from "express";
// import path from "path";
// import { rmdir } from "fs/promises";
import { apagarPastaSessao, getWbot, removeWbot } from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import { setValue } from "../libs/redisClient";
import { logger } from "../utils/logger";
import { getTbot, removeTbot } from "../libs/tbot";
import { getInstaBot, removeInstaBot } from "../libs/InstaBot";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";
import Whatsapp from "../models/Whatsapp";

interface UserRequest extends Request {
  user: {
    id: string;
    profile: string;
    tenantId: string | number;
  };
}

export const store = async (
  req: UserRequest,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, tenantId },
  });

  if (!whatsapp) {
    throw new AppError("No WhatsApp instance found with this ID.");
  }

  StartWhatsAppSession(whatsapp, Number(tenantId));
  return res.status(200).json({ message: "Starting session." });
};

export const update = async (
  req: UserRequest,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, tenantId },
  });

  if (!whatsapp) {
    throw new AppError("No WhatsApp instance found with this ID.");
  }

  StartWhatsAppSession(whatsapp, Number(tenantId));
  return res.status(200).json({ message: "Starting session." });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // console.log('=== WhatsAppSessionController.remove ===');
  // console.log('Request params:', req.params);
  // console.log('Request headers:', req.headers);
  // console.log('Request body:', req.body);
  // console.log('User from token:', req.user);

  const { whatsappId } = req.params;
  // console.log('WhatsApp ID to remove:', whatsappId);

  const { tenantId } = req.user;
  // console.log('Tenant ID:', tenantId);

  const channel = await ShowWhatsAppService({ id: whatsappId, tenantId });
  // console.log('Channel found:', channel ? channel.id : 'null');

  const io = getIO();
  // console.log('IO instance obtained');

  try {
    // console.log('Channel type:', channel.type);

    if (channel.type === "whatsapp") {
      // console.log('Processing WhatsApp channel');

      try {
        const wbot = getWbot(channel.id);
        // console.log('WhatsApp bot obtained:', wbot ? 'yes' : 'no');

        await setValue(`${channel.id}-retryQrCode`, 0);
        // console.log('Redis retry QR code value set to 0');

        await (wbot as any).logout().catch(error => {
          console.error("Error during WhatsApp logout:", error);
          logger.error("Erro ao fazer logout da conexão", error);
        });
        // console.log('WhatsApp logout completed');

        removeWbot(channel.id);
        // console.log('WhatsApp bot removed from memory');
      } catch (wbotError) {
        // console.log('WhatsApp bot not initialized, skipping logout');
        // Se o bot não está inicializado, apenas remove da memória
        await setValue(`${channel.id}-retryQrCode`, 0);
        removeWbot(channel.id);
      }
    }

    if (channel.type === "telegram") {
      // console.log('Processing Telegram channel');
      const tbot = getTbot(channel.id);
      await tbot.telegram.logOut().catch(error => {
        console.error("Error during Telegram logout:", error);
        logger.error("Erro ao fazer logout da conexão", error);
      });
      removeTbot(channel.id);
      // console.log('Telegram bot removed');
    }

    if (channel.type === "instagram") {
      // console.log('Processing Instagram channel');
      const instaBot = getInstaBot(channel.id);
      await instaBot.destroy();
      removeInstaBot(channel);
      // console.log('Instagram bot removed');
    }

    // console.log('Updating channel status to DISCONNECTED');
    await channel.update({
      status: "DISCONNECTED",
      session: "",
      qrcode: "",
      retries: 0,
    });
    // console.log('Channel status updated successfully');
  } catch (error) {
    console.error("Error in remove method:", error);
    logger.error(error);

    // console.log('Updating channel status to DISCONNECTED due to error');
    await channel.update({
      status: "DISCONNECTED",
      session: "",
      qrcode: "",
      retries: 0,
    });

    // console.log('Emitting socket event for error case');
    io.emit(`${tenantId}:whatsappSession`, {
      action: "update",
      session: {
        id: channel.id,
        name: channel.name,
        status: "CONNECTING",
        qrcode: "",
        isDefault: channel.isDefault,
        tenantId: channel.tenantId,
      },
    });

    // Não lança erro, apenas retorna sucesso pois o objetivo foi alcançado
    // console.log('Session disconnected despite errors');
  }

  // console.log('Remove method completed successfully');
  return res.status(200).json({ message: "Session disconnected." });
};

export const connectByNumber = async (
  req: UserRequest,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { number } = req.body;
  const { tenantId } = req.user;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, tenantId },
  });

  if (!whatsapp) {
    throw new AppError("No WhatsApp instance found with this ID.");
  }

  // Limpa o QR code e atualiza o status antes de iniciar a nova sessão
  await whatsapp.update({
    status: "CONNECTING",
    qrcode: "",
    retries: 0,
  });

  // Notifica o frontend sobre a mudança de status
  const io = getIO();
  io.emit(`${tenantId}:whatsappSession`, {
    action: "update",
    session: {
      id: whatsapp.id,
      name: whatsapp.name,
      status: "CONNECTING",
      qrcode: "",
      isDefault: whatsapp.isDefault,
      tenantId: whatsapp.tenantId,
    },
  });

  await StartWhatsAppSession(whatsapp, Number(tenantId), number);

  return res.status(200).json({ message: "Iniciando sessão via número." });
};

export default {
 store, remove, update, connectByNumber 
};
