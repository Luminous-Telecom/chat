import { WASocket, WACallEvent } from "@whiskeysockets/baileys";
import { logger } from "../../utils/logger";
import { isSessionClosedError } from "../../helpers/HandleSessionError";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";
import Tenant from "../../models/Tenant";
import VerifyContact from "./helpers/VerifyContact";
import CreateMessageSystemService from "../MessageServices/CreateMessageSystemService";
import SendMessagesSystemWbot from "./SendMessagesSystemWbot";

interface Session extends WASocket {
  id: number;
  tenantId: number;
  lastHeartbeat?: number;
}

interface TenantSettingsResult {
  key: string;
  value: string;
  tenantId: number;
}

interface CachedSettings {
  rejectCalls: boolean;
  callRejectMessage: string;
  timestamp: number;
}

// Cache para configurações de tenant
const tenantSettingsCache = new Map<number, CachedSettings>();

// Função para verificar se a sessão está saudável
const isSessionHealthy = (wbot: Session): boolean => {
  try {
    return Boolean(wbot && wbot.user && wbot.user.id);
  } catch (error) {
    return false;
  }
};

// Função para buscar configurações com cache
const getTenantSettings = async (wbot: Session): Promise<{
  rejectCalls: boolean;
  callRejectMessage: string;
  tenantId: number;
} | null> => {
  try {
    // Verificar cache primeiro (válido por 5 minutos)
    const cached = tenantSettingsCache.get(wbot.id);
    if (cached && (Date.now() - cached.timestamp) < 5 * 60 * 1000) {
      return {
        rejectCalls: cached.rejectCalls,
        callRejectMessage: cached.callRejectMessage,
        tenantId: wbot.id // Assumindo que wbot.id corresponde ao tenantId
      };
    }

    // Verificar se sequelize está disponível
    if (!Setting.sequelize) {
      logger.error('Sequelize not initialized');
      return null;
    }

    const query = `
      SELECT s."key", s.value, w."tenantId" 
      FROM "Whatsapps" w
      INNER JOIN "Tenants" t ON w."tenantId" = t.id
      INNER JOIN "Settings" s ON t.id = s."tenantId"
      WHERE w.id = $1
      AND s."key" IN ('rejectCalls', 'callRejectMessage')
    `;

    const results = await Setting.sequelize.query(query, {
      bind: [wbot.id]
    });

    // O resultado é um array onde o primeiro elemento contém os dados
    const settings = (results[0] as TenantSettingsResult[]);

    if (!settings || settings.length === 0) {
      logger.debug(`No call settings found for WhatsApp ${wbot.id}`);
      return null;
    }

    const rejectCallsSetting = settings.find(s => s.key === 'rejectCalls');
    const callRejectMessageSetting = settings.find(s => s.key === 'callRejectMessage');
    const tenantId = rejectCallsSetting?.tenantId || callRejectMessageSetting?.tenantId;

    if (!tenantId) {
      logger.warn(`No tenantId found in settings for WhatsApp ${wbot.id}`);
      return null;
    }

    const result = {
      rejectCalls: rejectCallsSetting?.value === 'enabled',
      callRejectMessage: callRejectMessageSetting?.value || 
        'As chamadas de voz e vídeo estão desabilitadas para esse WhatsApp, favor enviar uma mensagem de texto.',
      tenantId
    };

    // Armazenar no cache
    tenantSettingsCache.set(wbot.id, {
      rejectCalls: result.rejectCalls,
      callRejectMessage: result.callRejectMessage,
      timestamp: Date.now()
    });

    return result;
  } catch (error: any) {
    logger.error(`Error fetching tenant settings for WhatsApp ${wbot.id}: ${error.message}`);
    return null;
  }
};

// Função para verificar se o erro é recuperável
const isRecoverableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  const recoverablePatterns = [
    'evaluation failed',
    'minified invariant',
    'protocol error',
    'target closed',
    'navigation',
    'timeout',
    'cannot read properties of undefined',
    'execution context was destroyed'
  ];
  
  return recoverablePatterns.some(pattern => message.includes(pattern));
};

// Função para buscar contato com timeout e retry
const getContactSafely = async (wbot: Session, callFrom: string): Promise<any> => {
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      
      // Verificar saúde da sessão antes de cada tentativa
      if (!isSessionHealthy(wbot)) {
        logger.warn(`Session unhealthy, skipping contact fetch for ${callFrom}`);
        return null;
      }

      // Buscar o contato usando o método correto do Baileys
      const contact = await wbot.fetchStatus(callFrom);
      
      if (!contact) {
        logger.warn(`Contact not found for ${callFrom}`);
        return null;
      }

      logger.debug(`Contact fetched successfully for ${callFrom}`);
      return contact;

    } catch (error: any) {
      logger.warn(`Error fetching contact for ${callFrom} (attempt ${attempts}): ${error.message}`);

      // Verificar se é erro de sessão fechada
      if (isSessionClosedError(error)) {
        logger.warn('Session closed during contact fetch in VerifyCall, aborting');
        return null;
      }

      // Verificar se é erro recuperável
      if (isRecoverableError(error)) {
        logger.warn(`Recoverable error for contact ${callFrom}: ${error.message}`);
        
        if (attempts < maxAttempts) {
          // Aguardar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        } else {
          logger.error(`Max attempts reached for contact ${callFrom}, skipping`);
          return null;
        }
      }

      // Para erros não recuperáveis, falhar imediatamente
      logger.error(`Non-recoverable error for contact ${callFrom}: ${error.message}`);
      return null;
    }
  }

  return null;
};

const VerifyCall = async (calls: WACallEvent[], wbot: Session): Promise<void> => {
  try {
    // Verificar saúde da sessão imediatamente
    if (!isSessionHealthy(wbot)) {
      logger.warn(`Session unhealthy, skipping call verification for WhatsApp ${wbot.id}`);
      return;
    }

    // Processar cada evento de chamada
    for (const call of calls) {
      // Verificar se a chamada tem dados válidos
      if (!call || !call.from) {
        logger.warn(`Invalid call data for WhatsApp ${wbot.id}`);
        continue;
      }

      // Verificar se é uma chamada de oferta (nova chamada)
      if (call.status !== 'offer') {
        logger.debug(`Skipping call ${call.id} with status ${call.status}`);
        continue;
      }

      const callType = call.isVideo ? 'video' : 'audio';
      logger.info(`Processing ${callType} call from ${call.from} on WhatsApp ${wbot.id}`);

      // Buscar configurações do tenant
      const tenantSettings = await getTenantSettings(wbot);
      
      if (!tenantSettings) {
        logger.debug(`No tenant settings found for WhatsApp ${wbot.id}, not rejecting call`);
        continue;
      }

      // Se não deve rejeitar chamadas, sair
      if (!tenantSettings.rejectCalls) {
        logger.debug(`Call rejection disabled for WhatsApp ${wbot.id}`);
        continue;
      }

      logger.info(`Rejecting ${callType} call from ${call.from} on WhatsApp ${wbot.id}`);

      // Tentar rejeitar a chamada usando o método correto do Baileys
      try {
        await wbot.rejectCall(call.id, call.from);
        logger.info(`${callType} call from ${call.from} rejected successfully`);
      } catch (error: any) {
        logger.error(`Error rejecting ${callType} call from ${call.from}: ${error.message}`);
      }

      // Buscar contato para criar ticket
      const contact = await getContactSafely(wbot, call.from);
      if (!contact) {
        logger.warn(`Could not fetch contact for ${call.from}, skipping ticket creation`);
        continue;
      }

      // Criar ticket para a chamada rejeitada
      const ticketData = {
        contact,
        whatsappId: wbot.id,
        unreadMessages: 1,
        tenantId: wbot.tenantId,
        msg: {
          key: {
            id: call.id,
            fromMe: false,
            remoteJid: call.from
          },
          message: {
            call: {
              id: call.id,
              status: 'reject',
              from: call.from,
              timestamp: Date.now(),
              type: callType
            }
          }
        },
        channel: "whatsapp"
      };

      const ticket = await FindOrCreateTicketService(ticketData);

      // Enviar mensagem de rejeição de chamada
      if (ticket && !ticket.isCampaignMessage) {
        const messageData = {
          body: tenantSettings.callRejectMessage,
          fromMe: true,
          read: true,
          sendType: "bot"
        };

        await CreateMessageSystemService({
          msg: messageData,
          tenantId: wbot.tenantId,
          ticket,
          sendType: messageData.sendType,
          status: "pending"
        });
      }
    }

  } catch (error: any) {
    logger.error(`Error in VerifyCall: ${error.message}`);
  }
};

// Função para limpeza periódica do cache
export const cleanupCallCache = (): void => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutos
  
  for (const [wbotId, settings] of tenantSettingsCache.entries()) {
    if (now - settings.timestamp > maxAge) {
      tenantSettingsCache.delete(wbotId);
    }
  }
  
  logger.debug('Call settings cache cleanup completed');
};

export default VerifyCall;