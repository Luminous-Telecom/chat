import { Client } from "whatsapp-web.js";

import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
// import { apagarPastaSessao } from "../../libs/wbot";

interface Session extends Client {
  id?: number;
}

// Função auxiliar para validar e atualizar o objeto whatsapp
const safeUpdateWhatsapp = async (whatsapp: Whatsapp, updateData: any): Promise<boolean> => {
  try {
    // Validações básicas
    if (!whatsapp) {
      logger.error(`safeUpdateWhatsapp: whatsapp é null ou undefined`);
      return false;
    }
    
    if (!whatsapp.id) {
      logger.error(`safeUpdateWhatsapp: whatsapp.id é inválido`);
      return false;
    }
    
    if (typeof whatsapp.update !== "function") {
      logger.error(`safeUpdateWhatsapp: whatsapp.update não é uma função para ID ${whatsapp.id}`);
      
      // Tentar recarregar o objeto do banco de dados
      try {
        const freshWhatsapp = await Whatsapp.findByPk(whatsapp.id);
        if (freshWhatsapp && typeof freshWhatsapp.update === "function") {
          await freshWhatsapp.update(updateData);
          logger.info(`safeUpdateWhatsapp: Objeto whatsapp recarregado e atualizado com sucesso para ID ${whatsapp.id}`);
          return true;
        } else {
          logger.error(`safeUpdateWhatsapp: Falha ao recarregar objeto whatsapp para ID ${whatsapp.id}`);
          return false;
        }
      } catch (reloadError) {
        logger.error(`safeUpdateWhatsapp: Erro ao recarregar whatsapp ${whatsapp.id}: ${reloadError}`);
        return false;
      }
    }
    
    // Se chegou até aqui, o objeto é válido
    await whatsapp.update(updateData);
    return true;
  } catch (error) {
    logger.error(`safeUpdateWhatsapp: Erro ao atualizar whatsapp ${whatsapp?.id || 'unknown'}: ${error}`);
    return false;
  }
};

const wbotMonitor = async (
  wbot: Session,
  whatsapp: Whatsapp
): Promise<void> => {
  const io = getIO();
  const sessionName = whatsapp.name;

  try {
    wbot.on("change_state", async newState => {
      logger.info(`Monitor session: ${sessionName} - NewState: ${newState}`);
      try {
        await safeUpdateWhatsapp(whatsapp, { status: newState });
      } catch (err) {
        logger.error(err);
      }

      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
        action: "update",
        session: whatsapp
      });
    });

    wbot.on("change_battery", async batteryInfo => {
      const { battery, plugged } = batteryInfo;
      logger.info(
        `Battery session: ${sessionName} ${battery}% - Charging? ${plugged}`
      );

      if (battery <= 20 && !plugged) {
        io.emit(`${whatsapp.tenantId}:change_battery`, {
          action: "update",
          batteryInfo: {
            ...batteryInfo,
            sessionName
          }
        });
      }

      try {
        await safeUpdateWhatsapp(whatsapp, { battery, plugged });
      } catch (err) {
        logger.error(err);
      }

      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
        action: "update",
        session: whatsapp
      });
    });

    wbot.on("disconnected", async reason => {
      logger.info(`Disconnected session: ${sessionName} | Reason: ${reason}`);
      try {
        await safeUpdateWhatsapp(whatsapp, {
          status: "DISCONNECTED",
          session: "",
          qrcode: null,
          retries: (whatsapp.retries || 0) + 1
        });

        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsapp
        });

        const { removeWbot } = require('../../libs/wbot');
        removeWbot(whatsapp.id);

        setTimeout(async () => {
          try {
            const { StartWhatsAppSession } = require('./StartWhatsAppSession');
            await StartWhatsAppSession(whatsapp, true);
          } catch (err) {
            logger.error(`Error reconnecting session ${sessionName}: ${err}`);
          }
        }, 5000);
      } catch (err) {
        logger.error(`Error handling disconnection for ${sessionName}: ${err}`);
      }
    });

    wbot.on("error", async (error: Error) => {
      logger.error(`Session error for ${sessionName}: ${error.message}`);
      
      if (error.message.includes('Protocol error') || 
          error.message.includes('Target closed') ||
          error.message.includes('Session closed')) {
        
        try {
          await safeUpdateWhatsapp(whatsapp, {
            status: "DISCONNECTED",
            session: "",
            qrcode: null
          });

          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: whatsapp
          });

          const { removeWbot } = require('../../libs/wbot');
          removeWbot(whatsapp.id);

          setTimeout(async () => {
            try {
              const { StartWhatsAppSession } = require('./StartWhatsAppSession');
              await StartWhatsAppSession(whatsapp, true);
            } catch (err) {
              logger.error(`Error reconnecting after error for ${sessionName}: ${err}`);
            }
          }, 5000);
        } catch (err) {
          logger.error(`Error handling session error for ${sessionName}: ${err}`);
        }
      }
    });
  } catch (err) {
    logger.error(err);
  }
};

export default wbotMonitor;
