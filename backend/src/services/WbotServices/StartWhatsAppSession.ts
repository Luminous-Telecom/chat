import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { getBaileysSession, removeBaileysSession, initBaileys } from "../../libs/baileys";
import HandleBaileysMessage from "../BaileysServices/HandleBaileysMessage";
import { BaileysClient } from "../../types/baileys";
import { getIO } from "../../libs/socket";
import AppError from "../../errors/AppError";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  try {
    // Verifica se já existe uma sessão ativa
    const existingSession = getBaileysSession(whatsapp.id);
    if (existingSession) {
      const state = (existingSession as any)?.connection;
      if (state === 'open') {
        logger.info(`Session already exists and is connected for ${whatsapp.name}`);
        return;
      } else {
        // Remove a sessão antiga se não estiver ativa
        await removeBaileysSession(whatsapp.id);
      }
    }

    const wbot = await initBaileys(whatsapp);
    const io = getIO();

    // Configura o handler de QR code
    wbot.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        // Atualiza o status para QR_CODE e salva o QR code
        await whatsapp.update({
          status: "qrcode",
          qrcode: qr
        });
        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsapp
        });
        logger.info(`QR Code generated for ${whatsapp.name}`);
        return;
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== 401;
        logger.info(`Connection closed for ${whatsapp.name}, should reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          // Limpa o QR code se existir
          await whatsapp.update({
            status: "DISCONNECTED",
            qrcode: null
          });

          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: whatsapp
          });

          // Agenda uma nova tentativa de conexão
          setTimeout(async () => {
            try {
              logger.info(`Attempting to reconnect session for ${whatsapp.name}`);
              await StartWhatsAppSession(whatsapp, companyId);
            } catch (err) {
              logger.error(`Error during reconnection attempt: ${err}`);
            }
          }, 5000); // Espera 5 segundos antes de tentar reconectar
        } else {
          // Se não deve reconectar, limpa a sessão
          await removeBaileysSession(whatsapp.id);
          await whatsapp.update({
            status: "DISCONNECTED",
            qrcode: null
          });

          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: whatsapp
          });
        }
      }

      if (connection === 'open') {
        // Limpa o QR code quando conectado
        await whatsapp.update({
          status: "CONNECTED",
          qrcode: null
        });

        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsapp
        });

        logger.info(`Session connected successfully for ${whatsapp.name}`);
      }
    });

    // Configura os outros event listeners com tratamento de erro
    wbot.ev.on('messages.upsert', async (m: any) => {
      try {
        const messages = m.messages;
        if (messages.length === 0) return;

        for (const msg of messages) {
          await HandleBaileysMessage(msg, wbot);
        }
      } catch (err) {
        logger.error(`Error handling message: ${err}`);
      }
    });

    wbot.ev.on('messages.update', async (messageInfo: any) => {
      try {
        for (const msg of messageInfo) {
          if (msg.key && msg.key.fromMe) {
            await HandleBaileysMessage(msg, wbot);
          }
        }
      } catch (err) {
        logger.error(`Error handling message update: ${err}`);
      }
    });

    wbot.ev.on('message-receipt.update', async (messageReceipts: any) => {
      try {
        for (const receipt of messageReceipts) {
          if (receipt.key && receipt.key.fromMe) {
            await HandleBaileysMessage(receipt, wbot);
          }
        }
      } catch (err) {
        logger.error(`Error handling message receipt: ${err}`);
      }
    });

    logger.info(`WhatsApp session initialized for ${whatsapp.name}`);
  } catch (err) {
    logger.error(`Error starting WhatsApp session: ${err}`);
    throw err;
  }
};
