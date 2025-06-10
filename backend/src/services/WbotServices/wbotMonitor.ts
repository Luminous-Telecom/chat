import { WASocket, DisconnectReason } from "@whiskeysockets/baileys";
import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import StartWhatsAppSession from "./StartWhatsAppSession";
import { ensureWhatsappInstance, safeUpdateWhatsapp } from "../../helpers/WhatsappHelper";
// import { apagarPastaSessao } from "../../libs/wbot";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

interface BaileysError extends Error {
  output?: {
    statusCode?: number;
  };
}

const wbotMonitor = async (
  wbot: Session,
  whatsapp: Whatsapp
): Promise<void> => {
  const io = getIO();
  const sessionName = whatsapp.name;

  try {
    wbot.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as BaileysError)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                              statusCode !== DisconnectReason.badSession;
        
        logger.info(`Connection closed for ${sessionName} with status code ${statusCode}`);
        
        try {
          await safeUpdateWhatsapp(whatsapp, { 
            status: "DISCONNECTED",
            session: "",
            qrcode: "",
            retries: (whatsapp.retries || 0) + 1
          });

          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: whatsapp
          });

          if (shouldReconnect) {
            setTimeout(async () => {
              try {
                const instance = await ensureWhatsappInstance(whatsapp);
                await StartWhatsAppSession(instance, true);
              } catch (err) {
                logger.error(`Error reconnecting session ${sessionName}: ${err}`);
              }
            }, 5000);
          }
        } catch (err) {
          logger.error(`Error handling disconnection for ${sessionName}: ${err}`);
        }
      } else if (connection === "open") {
        logger.info(`Connection opened for ${sessionName}`);
        try {
          await safeUpdateWhatsapp(whatsapp, { 
            status: "CONNECTED",
            qrcode: ""
          });

          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: whatsapp
          });
        } catch (err) {
          logger.error(`Error updating connection status for ${sessionName}: ${err}`);
        }
      }
    });

    wbot.ev.on("creds.update", async () => {
      logger.info(`Credentials updated for ${sessionName}`);
      try {
        await safeUpdateWhatsapp(whatsapp, { 
          status: "CONNECTED"
        });

        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsapp
        });
      } catch (err) {
        logger.error(`Error updating credentials status for ${sessionName}: ${err}`);
      }
    });

  } catch (err) {
    logger.error(`Error in wbotMonitor for ${sessionName}: ${err}`);
  }
};

export default wbotMonitor;
