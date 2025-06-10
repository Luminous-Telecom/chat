import { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { logger } from "../../utils/logger";
import { getBaileys, updateSessionState } from "../../libs/baileys";
import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { StartBaileysSession } from "./StartBaileysSession";
import { safeUpdateWhatsapp } from "../../helpers/WhatsappHelper";
import { verificarSaudeSessao } from "../../libs/WhatsAppConnectionManager";

const BaileysConnectionStatus = async (whatsapp: Whatsapp): Promise<void> => {
  try {
    const io = getIO();
    let wbot;

    // Verificar se a sessão existe e está saudável
    try {
      wbot = getBaileys(whatsapp.id);
      const estaSaudavel = await verificarSaudeSessao(whatsapp.id);
      
      if (!estaSaudavel) {
        logger.warn(`Session ${whatsapp.id} exists but not healthy, restarting...`);
        await StartBaileysSession(whatsapp, true);
        wbot = getBaileys(whatsapp.id);
      }
    } catch (err) {
      logger.warn(`No active Baileys session found for ${whatsapp.id}, attempting to start...`);
      await StartBaileysSession(whatsapp);
      wbot = getBaileys(whatsapp.id);
    }

    if (!wbot) {
      throw new AppError("ERR_NO_BAILEYS_SESSION");
    }

    // Verificar se a sessão tem usuário
    if (!wbot.user) {
      logger.warn(`Session ${whatsapp.id} has no user, restarting...`);
      await StartBaileysSession(whatsapp, true);
      wbot = getBaileys(whatsapp.id);
    }

    // Configurar handlers de conexão
    wbot.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      logger.info(`Connection update for WhatsApp ${whatsapp.id}: ${connection}`);

      if (qr) {
        logger.info(`QR Code received for WhatsApp ${whatsapp.id}`);
        // Emitir QR code para o frontend
        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          whatsappId: whatsapp.id,
          action: "qr",
          qr
        });

        // Atualizar status para QR code
        await safeUpdateWhatsapp(whatsapp, { 
          status: "qrcode",
          qrcode: qr
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                              statusCode !== DisconnectReason.badSession;

        logger.info(`Connection closed for WhatsApp ${whatsapp.id} with status code ${statusCode}, should reconnect: ${shouldReconnect}`);

        // Atualizar estado da sessão
        updateSessionState(whatsapp.id, { isReady: false });

        if (shouldReconnect) {
          logger.info(`Baileys session ${whatsapp.id} disconnected. Attempting to reconnect...`);
          
          // Atualizar status
          await safeUpdateWhatsapp(whatsapp, { 
            status: "DISCONNECTED",
            qrcode: "",
            retries: (whatsapp.retries || 0) + 1
          });

          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            whatsappId: whatsapp.id,
            action: "update",
            session: { status: "DISCONNECTED" }
          });

          // Tentar reconectar após um delay
          setTimeout(async () => {
            try {
              await StartBaileysSession(whatsapp, true);
            } catch (err) {
              logger.error(`Error reconnecting Baileys session ${whatsapp.id}: ${err}`);
            }
          }, 5000);
        } else {
          logger.info(`Baileys session ${whatsapp.id} logged out or bad session`);
          
          // Limpar sessão
          await safeUpdateWhatsapp(whatsapp, { 
            status: "DISCONNECTED",
            qrcode: "",
            session: null
          });
          
          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            whatsappId: whatsapp.id,
            action: "update",
            session: { status: "DISCONNECTED" }
          });
        }
      }

      if (connection === 'open') {
        // Verificar se a sessão está realmente pronta
        if (!wbot.user) {
          logger.warn(`Session ${whatsapp.id} connection open but user not available`);
          return;
        }

        logger.info(`Baileys session ${whatsapp.id} connected successfully`);
        
        // Atualizar estado da sessão
        updateSessionState(whatsapp.id, { isReady: true });
        
        // Atualizar status
        await safeUpdateWhatsapp(whatsapp, { 
          status: "CONNECTED",
          qrcode: "",
          retries: 0
        });

        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          whatsappId: whatsapp.id,
          action: "update",
          session: { 
            status: "CONNECTED",
            me: wbot.user
          }
        });
      }
    });

    // Monitorar atualizações de credenciais
    wbot.ev.on('creds.update', async () => {
      logger.info(`Credentials updated for WhatsApp ${whatsapp.id}`);
      try {
        await safeUpdateWhatsapp(whatsapp, { 
          status: "CONNECTED",
          retries: 0
        });

        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsapp
        });
      } catch (err) {
        logger.error(`Error updating credentials status for ${whatsapp.id}: ${err}`);
      }
    });

  } catch (err) {
    logger.error(`Error in BaileysConnectionStatus for ${whatsapp.id}: ${err}`);
    throw err;
  }
};

export default BaileysConnectionStatus;