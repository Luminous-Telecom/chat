import { logger } from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { initBaileys, removeBaileys, isSessionReady, updateSessionState } from "../../libs/baileys";
import { getIO } from "../../libs/socket";
import BaileysCallHandler from "./BaileysCallHandler";
import HandleBaileysMessage from "./HandleBaileysMessage";
import { proto, BaileysEventMap, WAMessageStatus, GroupParticipant } from '@whiskeysockets/baileys';
import Group from "../../models/Group";
import { safeUpdateWhatsapp } from "../../helpers/WhatsappHelper";
import { verificarSaudeSessao, sincronizarEstadoSessao } from "../../libs/WhatsAppConnectionManager";
import AppError from "../../errors/AppError";

export const StartBaileysSession = async (whatsapp: Whatsapp, isRetry = false): Promise<void> => {
  try {
    logger.info(`[StartBaileysSession] Starting session ${whatsapp.id} (${whatsapp.name}) - Status: ${whatsapp.status}, isRetry: ${isRetry}`);

    // Verificar se já existe uma sessão ativa e saudável
    if (isSessionReady(whatsapp.id)) {
      const estaSaudavel = await verificarSaudeSessao(whatsapp.id);
      if (estaSaudavel) {
        logger.info(`[StartBaileysSession] Session ${whatsapp.id} is already active and healthy`);
        return;
      }
      logger.warn(`[StartBaileysSession] Session ${whatsapp.id} exists but not healthy, removing...`);
    }

    // Remover sessão existente se houver
    try {
      await removeBaileys(whatsapp.id, 'restart');
    } catch (err) {
      logger.warn(`[StartBaileysSession] Error removing existing session: ${err}`);
    }

    // Sincronizar estado antes de iniciar nova sessão
    await sincronizarEstadoSessao(whatsapp);

    // Atualizar estado inicial
    await safeUpdateWhatsapp(whatsapp, {
      status: "OPENING",
      qrcode: "",
      retries: isRetry ? (whatsapp.retries || 0) + 1 : 0
    });

    // Iniciar nova sessão
    try {
      logger.info(`[StartBaileysSession] Initializing new session for ${whatsapp.id}`);
      const whatsappInstance = await Whatsapp.findByPk(whatsapp.id);
      if (!whatsappInstance) {
        throw new AppError(`WhatsApp ${whatsapp.id} not found in database`);
      }

      // Atualizar estado para inicializando
      updateSessionState(whatsapp.id, { 
        isInitializing: true,
        isReady: false,
        lastHeartbeat: Date.now()
      });

      const wbot = await initBaileys(whatsappInstance);
      logger.info(`[StartBaileysSession] Successfully initialized session for ${whatsapp.id}`);

      // Aguardar a sessão estar pronta
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new AppError("Session initialization timeout"));
        }, 300000); // 5 minutos de timeout

        const unprocess = wbot.ev.process((events: Partial<BaileysEventMap>) => {
          const update = events["connection.update"];
          if (update) {
            if (update.connection === "open") {
              clearTimeout(timeout);
              unprocess();
              resolve();
            } else if (update.connection === "close") {
              clearTimeout(timeout);
              unprocess();
              reject(new AppError(`Connection closed during initialization: ${update.lastDisconnect?.error}`));
            }
          }
        });
      });

      // Inicializar handlers após a sessão estar pronta
      wbot.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
          await HandleBaileysMessage(msg, wbot);
        }
      });

      // Handler de eventos de grupo
      wbot.ev.on('groups.update', async (updates) => {
        for (const update of updates) {
          try {
            if (update.announce !== undefined) {
              await Group.update(
                { isAnnounce: update.announce },
                { where: { groupId: update.id || '' } }
              );
            }
          } catch (err) {
            logger.error(`Error handling group update: ${err}`);
          }
        }
      });

      // Handler de chamadas
      await BaileysCallHandler.initialize(wbot);

      // Atualizar estado para CONNECTED e READY
      updateSessionState(whatsapp.id, { 
        isInitializing: false,
        isReady: true,
        lastHeartbeat: Date.now()
      });

      await safeUpdateWhatsapp(whatsappInstance, {
        status: "CONNECTED",
        qrcode: "",
        retries: 0
      });

      const io = getIO();
      io.emit(`${whatsappInstance.tenantId}:whatsappSession`, {
        action: "update",
        session: whatsappInstance
      });

      logger.info(`[StartBaileysSession] Session ${whatsapp.id} fully initialized and ready`);

    } catch (err) {
      logger.error(`[StartBaileysSession] Error initializing session ${whatsapp.id}: ${err}`);
      
      // Atualizar estado para erro
      updateSessionState(whatsapp.id, { 
        isInitializing: false,
        isReady: false,
        lastHeartbeat: Date.now(),
        lastError: err
      });

      await safeUpdateWhatsapp(whatsapp, {
        status: "DISCONNECTED",
        qrcode: "",
        retries: (whatsapp.retries || 0) + 1
      });

      throw err;
    }
  } catch (err) {
    logger.error(`[StartBaileysSession] Fatal error for session ${whatsapp.id}: ${err}`);
    throw err;
  }
};

export const StartAllBaileysSessions = async (): Promise<void> => {
  try {
    const whatsapps = await Whatsapp.findAll({
      where: {
        isActive: true,
        isDeleted: false,
        type: "whatsapp"
      }
    });

    logger.info(`[StartAllBaileysSessions] Found ${whatsapps.length} active WhatsApp connections`);

    for (const whatsapp of whatsapps) {
      try {
        await StartBaileysSession(whatsapp);
      } catch (err) {
        logger.error(`[StartAllBaileysSessions] Error starting session for ${whatsapp.name}: ${err}`);
      }
    }
  } catch (err) {
    logger.error(`[StartAllBaileysSessions] Error: ${err}`);
    throw err;
  }
};