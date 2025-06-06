import { initWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import { StartInstaBotSession } from "../InstagramBotServices/StartInstaBotSession";
import { StartTbotSession } from "../TbotServices/StartTbotSession";
import { StartWaba360 } from "../WABA360/StartWaba360";
import { StartMessengerBot } from "../MessengerChannelServices/StartMessengerBot";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp
): Promise<void> => {
  const io = getIO();

  try {
    // CORREÇÃO: Melhor controle de estado inicial
    await whatsapp.update({ 
      status: "OPENING",
      qrcode: "",
      qrData: "", // Adicionar campo para dados originais do QR
      retries: 0
    });

    // Emitir atualização inicial
    io.emit(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });

    if (whatsapp.type === "whatsapp") {
      logger.info(`Starting WhatsApp session for ${whatsapp.name} (ID: ${whatsapp.id})`);
      
      const wbot = await initWbot(whatsapp);
      wbotMessageListener(wbot);
      wbotMonitor(wbot, whatsapp);
      
      logger.info(`WhatsApp session started successfully for ${whatsapp.name}`);
    }

    if (whatsapp.type === "telegram") {
      logger.info(`Starting Telegram session for ${whatsapp.name}`);
      StartTbotSession(whatsapp);
    }

    if (whatsapp.type === "instagram") {
      logger.info(`Starting Instagram session for ${whatsapp.name}`);
      StartInstaBotSession(whatsapp);
    }

    if (whatsapp.type === "messenger") {
      logger.info(`Starting Messenger session for ${whatsapp.name}`);
      StartMessengerBot(whatsapp);
    }

    if (whatsapp.type === "waba") {
      if (whatsapp.wabaBSP === "360") {
        logger.info(`Starting WABA 360 session for ${whatsapp.name}`);
        StartWaba360(whatsapp);
      }
    }
  } catch (err) {
    logger.error(`StartWhatsAppSession | Error for ${whatsapp.name}: ${err}`);
    
    // Atualizar status para erro
    await whatsapp.update({
      status: "DISCONNECTED",
      qrcode: "",
      qrData: ""
    });

    io.emit(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });

    throw new AppError("ERR_START_SESSION", 404);
  }
};