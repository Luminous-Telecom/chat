import { WASocket, proto } from '@whiskeysockets/baileys';
import { BaileysClient } from '../../types/baileys';
import { logger } from '../../utils/logger';
import FindOrCreateTicketService from '../TicketServices/FindOrCreateTicketService';
import ShowWhatsAppService from '../WhatsappService/ShowWhatsAppService';
import VerifyContact from '../WbotServices/helpers/VerifyContact';
import VerifyMediaMessage from '../WbotServices/helpers/VerifyMediaMessage';
import VerifyMessage from '../WbotServices/helpers/VerifyMessage';
import verifyBusinessHours from '../WbotServices/helpers/VerifyBusinessHours';
import VerifyStepsChatFlowTicket from '../ChatFlowServices/VerifyStepsChatFlowTicket';
import Queue from '../../libs/Queue';
import Setting from '../../models/Setting';
import { StartWhatsAppSessionVerify } from '../WbotServices/StartWhatsAppSessionVerify';
import { getBaileysSession } from '../../libs/baileys';
import socketEmit from '../../helpers/socketEmit';
import Contact from '../../models/Contact';
import { BaileysMessageAdapter } from './BaileysMessageAdapter';
import Message from '../../models/Message';
// import SetTicketMessagesAsRead from '../../helpers/SetTicketMessagesAsRead'; // Removido - não usado mais

const HandleBaileysMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: BaileysClient
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    (async () => {
      try {
      

        // Verificar se mensagem é válida
        if (!msg.key.fromMe && !msg.message) {
          logger.debug(`[HandleBaileysMessage] Skipping message - no content and not from me`);
          resolve();
          return;
        }

        // Ignorar tipos de mensagem especiais que não devem ser processados
        const messageType = msg.message ? Object.keys(msg.message)[0] : '';
        const ignoredMessageTypes = [
          'protocolMessage',
          'ephemeralMessage', 
          'reactionMessage',
          'pollCreationMessage',
          'pollUpdateMessage',
          'senderKeyDistributionMessage',
          'fastRatchetKeySenderKeyDistributionMessage'
        ];
        
        if (ignoredMessageTypes.includes(messageType)) {
          logger.debug(`[HandleBaileysMessage] Ignoring ${messageType} type message`);
          resolve();
          return;
        }

        const whatsapp = await ShowWhatsAppService({ id: wbot.id });
        const { tenantId } = whatsapp;

        // Verificar configuração de grupos
        const Settingdb = await Setting.findOne({
          where: { key: 'ignoreGroupMsg', tenantId }
        });

        const isGroup = msg.key.remoteJid?.endsWith('@g.us');
        if (Settingdb?.value === 'enabled' && isGroup) {
          logger.debug(`[HandleBaileysMessage] Ignoring group message`);
          resolve();
          return;
        }

        // Verificar estado da sessão
        const sessionState = (wbot as any)?.connection;
        const wsExists = !!(wbot as any)?.ws;
        
        if (sessionState !== 'open' || !wsExists) {
          logger.warn(`[HandleBaileysMessage] Session not ready (state: ${sessionState}, ws: ${wsExists})`);
          
          if (sessionState === 'open' && !wsExists) {
            await attemptSessionReconnect(whatsapp, msg, wbot);
            resolve();
            return;
          }
        }

        // Processar contato
        const { msgContact, groupContact } = await processMessageContact(msg, tenantId);
        
        // Criar/buscar ticket
        const unreadMessages = msg.key.fromMe ? 0 : 1;
        const contact = await VerifyContact(msgContact, tenantId);
        const ticket = await FindOrCreateTicketService({
          contact,
          whatsappId: wbot.id,
          unreadMessages,
          tenantId,
          groupContact,
          msg,
          channel: 'whatsapp'
        });

        if (ticket?.isCampaignMessage || ticket?.isFarewellMessage) {
          resolve();
          return;
        }

        // Processar mensagem
        const message = await processMessage(msg, ticket, contact, wbot);
        
        if (!message) {
          logger.warn(`[HandleBaileysMessage] Failed to create message for ticket ${ticket.id}`);
          resolve();
          return;
        }

        // Marcar como lida se não for própria mensagem - COMENTADO PARA EVITAR MARCAÇÃO AUTOMÁTICA
        // if (!msg.key.fromMe) {
        //   // Usar setTimeout para não bloquear o processamento principal
        //   setTimeout(async () => {
        //     try {
        //       await handleMessageReadReceipt(msg, ticket, message, wbot);
        //     } catch (err) {
        //       logger.error(`[HandleBaileysMessage] Error in read receipt: ${err}`);
        //     }
        //   }, 1000);
        // }

        // Verificar horário comercial e chat flow
        const adaptedMessage = BaileysMessageAdapter.convertMessage(msg, wbot);
        const isBusinessHours = await verifyBusinessHours(adaptedMessage, ticket);
        if (isBusinessHours) {
          await VerifyStepsChatFlowTicket(adaptedMessage, ticket);
        }

        // Webhook para API externa
        await handleExternalWebhook(msg, ticket);

        resolve();

      } catch (err) {
        reject(err);
      }
    })();
  });
};

const attemptSessionReconnect = async (whatsapp: any, msg: proto.IWebMessageInfo, wbot: BaileysClient): Promise<void> => {
  try {
    logger.warn(`[HandleBaileysMessage] Attempting reconnect for session ${whatsapp.name}`);
    await StartWhatsAppSessionVerify(whatsapp.id, 'ERR_WAPP_NOT_INITIALIZED');
    
    // Aguardar reconexão
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Tentar processar mensagem novamente
    const newWbot = getBaileysSession(whatsapp.id);
    if (newWbot) {
      logger.info(`[HandleBaileysMessage] Retrying with new session`);
      return HandleBaileysMessage(msg, newWbot);
    }
  } catch (reconnectErr) {
    logger.error(`[HandleBaileysMessage] Reconnect failed: ${reconnectErr}`);
  }
};

const processMessageContact = async (msg: proto.IWebMessageInfo, tenantId: number) => {
  const jid = msg.key.remoteJid || msg.key.participant || "";
  const numero = jid.split('@')[0].replace(/\D/g, '');
  const isGroup = jid.endsWith('@g.us');

  // Buscar ou criar contato
  const [foundContact] = await Contact.findOrCreate({
    where: { 
      number: numero,
      tenantId 
    },
    defaults: {
      name: msg.pushName || numero,
      isWAContact: true,
      profilePicUrl: null
    }
  });

  // Atualizar nome se necessário
  if (msg.pushName && foundContact.name !== msg.pushName) {
    await foundContact.update({ name: msg.pushName });
  }

  const msgContact = {
    id: {
      user: numero,
      _serialized: jid
    },
    name: foundContact.name || '',
    pushname: foundContact.pushname || '',
    number: numero,
    isGroup: false,
    isMe: msg.key.fromMe || false,
    isWAContact: true,
    isMyContact: true,
    getProfilePicUrl: async () => foundContact.profilePicUrl || ''
  };

  let groupContact;
  if (isGroup) {
    const groupPhoneNumber = msg.key.remoteJid?.split('@')[0];
    if (groupPhoneNumber) {
      groupContact = await Contact.findOne({
        where: { number: groupPhoneNumber, tenantId }
      });
    }
  }

  return { msgContact, groupContact };
};

const processMessage = async (msg: proto.IWebMessageInfo, ticket: any, contact: any, wbot: BaileysClient) => {
  try {
    const adaptedMessage = BaileysMessageAdapter.convertMessage(msg, wbot);
    const messageType = Object.keys(msg.message || {})[0];
    
    let message;
    if (messageType !== 'conversation' && messageType !== 'extendedTextMessage') {
      message = await VerifyMediaMessage(adaptedMessage, ticket, contact);
    } else {
      message = await VerifyMessage(adaptedMessage, ticket, contact);
    }

    return message;
  } catch (err) {
    logger.error(`[HandleBaileysMessage] Error creating message for ticket ${ticket.id}: ${err}`);
    logger.error(`[HandleBaileysMessage] Error stack: ${err.stack}`);
    return null;
  }
};

const handleMessageReadReceipt = async (
  msg: proto.IWebMessageInfo, 
  ticket: any, 
  message: any, 
  wbot: BaileysClient
): Promise<void> => {
  try {
    // Verificar se mensagem ainda não foi lida
    const freshMessage = await Message.findOne({
      where: { id: message.id, read: false }
    });

    if (!freshMessage) {
      return;
    }

    const jid = msg.key.remoteJid || "";
    const sessionState = (wbot as any)?.connection;
    const wsExists = !!(wbot as any)?.ws;

    if (sessionState === 'open' && wsExists) {
      // Tentar marcar como lida usando readMessages
      try {
        await wbot.readMessages([{
          remoteJid: jid,
          id: msg.key.id,
          fromMe: false
        }]);
      } catch (readErr) {
        logger.warn(`[HandleBaileysMessage] readMessages failed: ${readErr}`);
        
        // Fallback: usar presença
        try {
          await wbot.sendPresenceUpdate('available', jid);
          await wbot.sendPresenceUpdate('composing', jid);
          await wbot.sendPresenceUpdate('paused', jid);
        } catch (presenceErr) {
          logger.warn(`[HandleBaileysMessage] Presence fallback failed: ${presenceErr}`);
        }
      }
    }

    // Atualizar no banco de dados
    await freshMessage.update({ read: true });
    
    // Atualizar contador do ticket
    const currentUnread = await Message.count({
      where: { ticketId: ticket.id, read: false, fromMe: false }
    });
    
    await ticket.update({ unreadMessages: currentUnread });

    // Notificar frontend
    socketEmit({
      tenantId: ticket.tenantId,
      type: "chat:update",
      payload: {
        ticketId: ticket.id,
        messageId: freshMessage.id,
        read: true
      }
    });

  } catch (err) {
    logger.error(`[HandleBaileysMessage] Error processing read receipt: ${err}`);
  }
};

const handleExternalWebhook = async (msg: proto.IWebMessageInfo, ticket: any): Promise<void> => {
  try {
    const apiConfig: any = ticket.apiConfig || {};
    
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.answered &&
      apiConfig?.externalKey &&
      apiConfig?.urlMessageStatus
    ) {
      const payload = {
        timestamp: Date.now(),
        msg,
        messageId: msg.key.id,
        ticketId: ticket.id,
        externalKey: apiConfig?.externalKey,
        authToken: apiConfig?.authToken,
        type: 'hookMessage'
      };
      
      Queue.add('WebHooksAPI', {
        url: apiConfig.urlMessageStatus,
        type: payload.type,
        payload
      });
      
      logger.debug(`[HandleBaileysMessage] Webhook queued for ticket ${ticket.id}`);
    }
  } catch (err) {
    logger.error(`[HandleBaileysMessage] Webhook error: ${err}`);
  }
};

export default HandleBaileysMessage;