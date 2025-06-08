import {
  Contact as WbotContact,
  Message as WbotMessage,
  Client
} from "whatsapp-web.js";
import Contact from "../../../models/Contact";
import { logger } from "../../../utils/logger";
import FindOrCreateTicketService from "../../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../../WhatsappService/ShowWhatsAppService";
import IsValidMsg from "./IsValidMsg";
import VerifyContact from "./VerifyContact";
import VerifyMediaMessage from "./VerifyMediaMessage";
import VerifyMessage from "./VerifyMessage";
import verifyBusinessHours from "./VerifyBusinessHours";
import VerifyStepsChatFlowTicket from "../../ChatFlowServices/VerifyStepsChatFlowTicket";
import Queue from "../../../libs/Queue";
import Setting from "../../../models/Setting";

interface Session extends Client {
  id: number;
}

// Função para verificar se a sessão está saudável
const isSessionHealthy = (wbot: Session): boolean => {
  try {
    return !!(wbot && wbot.pupPage && !wbot.pupPage.isClosed() && wbot.info && wbot.info.wid);
  } catch (error) {
    return false;
  }
};

// Função para executar operações com timeout e retry
const executeWithTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number = 10000,
  operationName: string = 'operation'
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout in ${operationName} after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } catch (error: any) {
    logger.warn(`Error in ${operationName}: ${error.message}`);
    throw error;
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
    'participants'
  ];
  
  return recoverablePatterns.some(pattern => message.includes(pattern));
};

const HandleMessage = async (
  msg: WbotMessage,
  wbot: Session
): Promise<void> => {
  try {
    // Verificar se a mensagem é válida
    if (!IsValidMsg(msg)) {
      logger.debug(`Invalid message ${msg.id?.id || 'unknown'}, skipping`);
      return;
    }

    // Verificar saúde da sessão antes de processar
    if (!isSessionHealthy(wbot)) {
      logger.warn(`Session unhealthy, skipping message ${msg.id?.id || 'unknown'}`);
      return;
    }

    // Buscar configuração do WhatsApp
    let whatsapp;
    try {
      whatsapp = await ShowWhatsAppService({ id: wbot.id });
    } catch (error: any) {
      logger.error(`Error getting WhatsApp service for session ${wbot.id}: ${error.message}`);
      return;
    }

    const { tenantId } = whatsapp;
    
    // Obter chat com tratamento de erro robusto
    let chat: any;
    try {
      chat = await executeWithTimeout(
        () => msg.getChat(),
        8000,
        'getChat'
      );
    } catch (error: any) {
      if (isRecoverableError(error)) {
        logger.warn(`Recoverable error getting chat for message ${msg.id?.id || 'unknown'}: ${error.message}`);
        return; // Skip message but don't crash
      }
      logger.error(`Critical error getting chat for message ${msg.id?.id || 'unknown'}: ${error.message}`);
      throw error;
    }

    // Verificar configuração para ignorar grupos
    let shouldIgnoreGroups = false;
    try {
      const settingDb = await Setting.findOne({
        where: { key: "ignoreGroupMsg", tenantId }
      });
      shouldIgnoreGroups = settingDb?.value === "enabled";
    } catch (error: any) {
      logger.warn(`Error checking group settings: ${error.message}`);
      // Continue processamento mesmo com erro na configuração
    }

    // Ignorar mensagens de grupo se configurado
    if (shouldIgnoreGroups && (chat.isGroup || msg.from === "status@broadcast")) {
      logger.debug(`Ignoring group message ${msg.id?.id || 'unknown'}`);
      return;
    }

    // Verificar saúde da sessão novamente antes de operações pesadas
    if (!isSessionHealthy(wbot)) {
      logger.warn(`Session became unhealthy during processing of message ${msg.id?.id || 'unknown'}`);
      return;
    }

    let msgContact: WbotContact;
    let groupContact: Contact | undefined;

    try {
      if (msg.fromMe) {
        // Verificar se é mídia enviada do celular
        if (!msg.hasMedia && msg.type !== "chat" && msg.type !== "vcard") {
          logger.debug(`Skipping media message from phone ${msg.id?.id || 'unknown'}`);
          return;
        }

        msgContact = await executeWithTimeout(
          () => wbot.getContactById(msg.to),
          8000,
          'getContactById(msg.to)'
        );
      } else {
        msgContact = await executeWithTimeout(
          () => msg.getContact(),
          8000,
          'msg.getContact'
        );
      }
    } catch (error: any) {
      if (isRecoverableError(error)) {
        logger.warn(`Recoverable error getting contact for message ${msg.id?.id || 'unknown'}: ${error.message}`);
        return;
      }
      logger.error(`Critical error getting contact for message ${msg.id?.id || 'unknown'}: ${error.message}`);
      throw error;
    }

    // Processar contato do grupo se necessário
    if (chat.isGroup) {
      try {
        let msgGroupContact;

        if (msg.fromMe) {
          msgGroupContact = await executeWithTimeout(
            () => wbot.getContactById(msg.to),
            8000,
            'getContactById(group-msg.to)'
          );
        } else {
          msgGroupContact = await executeWithTimeout(
            () => wbot.getContactById(msg.from),
            8000,
            'getContactById(group-msg.from)'
          );
        }

        groupContact = await VerifyContact(msgGroupContact, tenantId);
      } catch (error: any) {
        logger.warn(`Error processing group contact for message ${msg.id?.id || 'unknown'}: ${error.message}`);
        // Continue sem o grupo contact se houver erro
        groupContact = undefined;
      }
    }

    const unreadMessages = msg.fromMe ? 0 : 1;

    // Verificar e criar contato
    let contact: Contact;
    try {
      contact = await VerifyContact(msgContact, tenantId);
    } catch (error: any) {
      logger.error(`Error verifying contact for message ${msg.id?.id || 'unknown'}: ${error.message}`);
      return;
    }

    // Criar ou encontrar ticket
    let ticket;
    try {
      ticket = await FindOrCreateTicketService({
        contact,
        whatsappId: wbot.id!,
        unreadMessages,
        tenantId,
        groupContact,
        msg,
        channel: "whatsapp"
      });
    } catch (error: any) {
      logger.error(`Error creating/finding ticket for message ${msg.id?.id || 'unknown'}: ${error.message}`);
      return;
    }

    // Verificar se é mensagem de campanha ou despedida
    if (ticket?.isCampaignMessage || ticket?.isFarewellMessage) {
      logger.debug(`Skipping campaign/farewell message ${msg.id?.id || 'unknown'}`);
      return;
    }

    // Processar mensagem com mídia ou texto
    try {
      if (msg.hasMedia) {
        await VerifyMediaMessage(msg, ticket, contact);
      } else {
        await VerifyMessage(msg, ticket, contact);
      }
    } catch (error: any) {
      logger.error(`Error processing message content ${msg.id?.id || 'unknown'}: ${error.message}`);
      // Continue com o fluxo mesmo se houver erro no processamento da mensagem
    }

    // Verificar horário comercial
    let isBusinessHours = true;
    try {
      isBusinessHours = await verifyBusinessHours(msg, ticket);
    } catch (error: any) {
      logger.warn(`Error checking business hours for message ${msg.id?.id || 'unknown'}: ${error.message}`);
      // Assume horário comercial em caso de erro
    }

    // Processar chatflow se estiver em horário comercial
    if (isBusinessHours) {
      try {
        await VerifyStepsChatFlowTicket(msg, ticket);
      } catch (error: any) {
        logger.error(`Error in chatflow for message ${msg.id?.id || 'unknown'}: ${error.message}`);
        // Continue mesmo se houver erro no chatflow
      }
    }

    // Processar webhook se necessário
    try {
      const apiConfig: any = ticket.apiConfig || {};
      if (
        !msg.fromMe &&
        !ticket.isGroup &&
        !ticket.answered &&
        apiConfig?.externalKey &&
        apiConfig?.urlMessageStatus
      ) {
        const payload = {
          timestamp: Date.now(),
          msg: {
            id: msg.id,
            body: msg.body,
            from: msg.from,
            timestamp: msg.timestamp,
            type: msg.type
          },
          messageId: msg.id.id,
          ticketId: ticket.id,
          externalKey: apiConfig.externalKey,
          authToken: apiConfig.authToken,
          type: "hookMessage"
        };

        // Adicionar à fila de forma assíncrona para não bloquear
        setImmediate(() => {
          Queue.add("WebHooksAPI", {
            url: apiConfig.urlMessageStatus,
            type: payload.type,
            payload
          });
        });
      }
    } catch (error: any) {
      logger.error(`Error processing webhook for message ${msg.id?.id || 'unknown'}: ${error.message}`);
      // Não falhar se webhook der erro
    }

  } catch (err: any) {
    // Log do erro sem fazer throw para não quebrar o listener
    logger.error(`Critical error in HandleMessage for message ${msg.id?.id || 'unknown'}: ${err.message}`);
    
    // Só fazer throw se for erro realmente crítico que precisa parar o processamento
    if (!isRecoverableError(err)) {
      throw err;
    }
  }
};

export default HandleMessage;