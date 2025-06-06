import { Request, Response } from "express";
// import path from "path";
// import { rmdir } from "fs/promises";
import { apagarPastaSessao, getWbot, removeWbot } from "../libs/wbot";
import { isSessionClosedError } from "../helpers/HandleSessionError";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import { setValue } from "../libs/redisClient";
import { logger } from "../utils/logger";
import { getTbot, removeTbot } from "../libs/tbot";
import { getInstaBot, removeInstaBot } from "../libs/InstaBot";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;
  const whatsapp = await ShowWhatsAppService({
    id: whatsappId,
    tenantId,
    isInternal: true
  });

  StartWhatsAppSession(whatsapp);

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { isQrcode } = req.body;
  const { tenantId } = req.user;

  if (isQrcode) {
    await apagarPastaSessao(whatsappId);
  }

  const { whatsapp } = await UpdateWhatsAppService({
    whatsappId,
    whatsappData: { session: "" },
    tenantId
  });

  // await apagarPastaSessao(whatsappId);
  StartWhatsAppSession(whatsapp);
  return res.status(200).json({ message: "Starting session." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;
  const channel = await ShowWhatsAppService({ id: whatsappId, tenantId });

  const io = getIO();

  try {
    if (channel.type === "whatsapp") {
      const wbot = getWbot(channel.id);
      await setValue(`${channel.id}-retryQrCode`, 0);
      
      // Aguardar operações pendentes antes do logout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar se o wbot ainda está ativo antes de fazer logout
      if (wbot && wbot.info && wbot.info.wid) {
        // Usar destroy() em vez de logout() para garantir desconexão completa do celular
        await wbot
          .destroy()
          .catch(error => {
            if (!isSessionClosedError(error)) {
              logger.error("Erro ao destruir conexão", error);
            }
          }); // --> encerra a sessão e desconecta o bot do whatsapp, gerando um novo QRCODE
      } else {
        logger.info(`WhatsApp session ${channel.id} already disconnected, skipping logout`);
      }
      removeWbot(channel.id);
    }

    if (channel.type === "telegram") {
      const tbot = getTbot(channel.id);
      // Verificar se o tbot ainda está ativo antes de fazer logout
      if (tbot && tbot.telegram) {
        await tbot.telegram
          .logOut()
          .catch(error => {
            if (!isSessionClosedError(error)) {
              logger.error("Erro ao fazer logout da conexão", error);
            }
          });
      } else {
        logger.info(`Telegram session ${channel.id} already disconnected, skipping logout`);
      }
      removeTbot(channel.id);
    }

    if (channel.type === "instagram") {
      const instaBot = getInstaBot(channel.id);
      await instaBot.destroy();
      removeInstaBot(channel);
    }

    await channel.update({
      status: "DISCONNECTED",
      session: "",
      qrcode: null,
      retries: 0
    });

    io.emit(`${channel.tenantId}:whatsappSession`, {
      action: "update",
      session: channel
    });

    return res.status(200).json({ message: "Session disconnected." });
  } catch (error) {
    logger.error(error);
    await channel.update({
      status: "DISCONNECTED",
      session: "",
      qrcode: null,
      retries: 0
    });

    io.emit(`${channel.tenantId}:whatsappSession`, {
      action: "update",
      session: channel
    });
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }
};

export default { store, remove, update };
