import { Op } from 'sequelize';
import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
import { getBaileysSession, removeBaileysSession } from "../../libs/baileys";

const wbotMonitor = async (): Promise<void> => {
  const whatsapps = await Whatsapp.findAll({
    where: { status: { [Op.ne]: "DISCONNECTED" } }
  });

  for (const whatsapp of whatsapps) {
    try {
      const wbot = getBaileysSession(whatsapp.id);
      if (!wbot) {
        logger.info(`Session not found for ${whatsapp.name}, starting new session`);
        StartWhatsAppSession(whatsapp, whatsapp.tenantId);
        continue;
      }

      const state = (wbot as any)?.connection;
      if (state === 'close') {
        logger.info(`Session closed for ${whatsapp.name}, attempting to reconnect`);
        await removeBaileysSession(whatsapp.id);
        // Espera um pouco mais antes de tentar reconectar
        setTimeout(() => StartWhatsAppSession(whatsapp, whatsapp.tenantId), 5000);
      }
    } catch (err) {
      logger.error(`Error monitoring session for ${whatsapp.name}: ${err}`);
      // Em caso de erro, tenta reiniciar a sessão após um delay
      setTimeout(() => StartWhatsAppSession(whatsapp, whatsapp.tenantId), 5000);
    }
  }
};

export default wbotMonitor;
