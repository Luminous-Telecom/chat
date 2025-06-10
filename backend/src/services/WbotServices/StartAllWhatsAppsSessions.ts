import { Op } from "sequelize";
// import { initInstaBot } from "../../libs/InstaBot";
import Whatsapp from "../../models/Whatsapp";
import { StartInstaBotSession } from "../InstagramBotServices/StartInstaBotSession";
import { StartMessengerBot } from "../MessengerChannelServices/StartMessengerBot";
import { StartTbotSession } from "../TbotServices/StartTbotSession";
import { StartWaba360 } from "../WABA360/StartWaba360";
import StartWhatsAppSession from "./StartWhatsAppSession";
// import { StartTbotSession } from "../TbotServices/StartTbotSession";
import { logger } from "../../utils/logger";
import { verificarSaudeSessao, sincronizarEstadoSessao } from '../../libs/WhatsAppConnectionManager';

export const StartAllWhatsAppsSessions = async (): Promise<void> => {
  try {
    // Buscar todas as sessões ativas do banco de dados
    const whatsapps = await Whatsapp.findAll({
      where: {
        [Op.or]: [
          {
            [Op.and]: {
              type: {
                [Op.in]: ["instagram", "telegram", "waba", "messenger"]
              },
              status: {
                [Op.notIn]: ["DISCONNECTED"]
              }
            }
          },
          {
            [Op.and]: {
              type: "whatsapp",
              isActive: true
            }
          }
        ]
      }
    });

    if (whatsapps.length === 0) {
      logger.info(`[StartAllWhatsAppsSessions] No WhatsApp sessions to start`);
      return;
    }

    logger.info(`[StartAllWhatsAppsSessions] Found ${whatsapps.length} active sessions to start`);

    // Separar sessões por tipo
    const whatsappSessions = whatsapps.filter(w => w.type === "whatsapp" && w.id && w.tenantId);
    const telegramSessions = whatsapps.filter(w => w.type === "telegram" && w.tokenTelegram && w.id && w.tenantId);
    const instagramSessions = whatsapps.filter(w => w.type === "instagram" && w.id && w.tenantId);
    const waba360Sessions = whatsapps.filter(w => w.type === "waba" && w.id && w.tenantId);
    const messengerSessions = whatsapps.filter(w => w.type === "messenger" && w.id && w.tenantId);

    // Iniciar sessões WhatsApp com controle de concorrência
    if (whatsappSessions.length > 0) {
      logger.info(`[StartAllWhatsAppsSessions] Starting ${whatsappSessions.length} WhatsApp sessions`);
      
      const maxConcurrent = 3; // Limitar inicializações concorrentes
      for (let i = 0; i < whatsappSessions.length; i += maxConcurrent) {
        const batch = whatsappSessions.slice(i, i + maxConcurrent);
        
        await Promise.all(
          batch.map(async (whatsapp) => {
            try {
              // Validar objeto WhatsApp
              if (!whatsapp.id || !whatsapp.tenantId) {
                logger.error(`Invalid WhatsApp object: missing required fields (id: ${whatsapp.id}, tenantId: ${whatsapp.tenantId})`);
                return;
              }

              // Sincronizar estado antes de iniciar
              await sincronizarEstadoSessao(whatsapp);

              // Verificar se a sessão já está saudável
              const estaSaudavel = await verificarSaudeSessao(whatsapp.id);
              if (estaSaudavel && whatsapp.status === "CONNECTED") {
                logger.info(`WhatsApp session ${whatsapp.name} (ID: ${whatsapp.id}) already healthy and connected`);
                return;
              }

              logger.info(`[StartAllWhatsAppsSessions] Starting WhatsApp session: ${whatsapp.name} (ID: ${whatsapp.id}, Status: ${whatsapp.status})`);
              await StartWhatsAppSession(whatsapp);
            } catch (err) {
              logger.error(`[StartAllWhatsAppsSessions] Error starting WhatsApp session for ${whatsapp.name}: ${err}`);
              // Continuar com outras sessões mesmo se uma falhar
            }
          })
        );
        
        // Pequeno delay entre lotes
        if (i + maxConcurrent < whatsappSessions.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } else {
      logger.info(`[StartAllWhatsAppsSessions] No WhatsApp sessions to start`);
    }

    // Iniciar outras sessões
    if (telegramSessions.length > 0) {
      logger.info(`[StartAllWhatsAppsSessions] Starting ${telegramSessions.length} Telegram sessions`);
      for (const whatsapp of telegramSessions) {
        try {
          await StartTbotSession(whatsapp);
        } catch (err) {
          logger.error(`[StartAllWhatsAppsSessions] Error starting Telegram session for ${whatsapp.name}: ${err}`);
        }
      }
    }

    if (waba360Sessions.length > 0) {
      logger.info(`[StartAllWhatsAppsSessions] Starting ${waba360Sessions.length} WABA 360 sessions`);
      for (const channel of waba360Sessions) {
        try {
          if (channel.tokenAPI && channel.wabaBSP === "360") {
            await StartWaba360(channel);
          }
        } catch (err) {
          logger.error(`[StartAllWhatsAppsSessions] Error starting WABA 360 session for ${channel.name}: ${err}`);
        }
      }
    }

    if (instagramSessions.length > 0) {
      logger.info(`[StartAllWhatsAppsSessions] Starting ${instagramSessions.length} Instagram sessions`);
      for (const channel of instagramSessions) {
        try {
          if (channel.instagramKey) {
            await StartInstaBotSession(channel);
          }
        } catch (err) {
          logger.error(`[StartAllWhatsAppsSessions] Error starting Instagram session for ${channel.name}: ${err}`);
        }
      }
    }

    if (messengerSessions.length > 0) {
      logger.info(`[StartAllWhatsAppsSessions] Starting ${messengerSessions.length} Messenger sessions`);
      for (const channel of messengerSessions) {
        try {
          if (channel.tokenAPI) {
            await StartMessengerBot(channel);
          }
        } catch (err) {
          logger.error(`[StartAllWhatsAppsSessions] Error starting Messenger session for ${channel.name}: ${err}`);
        }
      }
    }

    logger.info(`[StartAllWhatsAppsSessions] Completed starting all sessions`);
  } catch (err) {
    logger.error(`[StartAllWhatsAppsSessions] Error: ${err}`);
  }
};
