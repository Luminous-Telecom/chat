import { WASocket, proto } from '@whiskeysockets/baileys';
import Contact from '../../models/Contact';
import { BaileysMessageAdapter } from './BaileysMessageAdapter';
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

const HandleBaileysMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: BaileysClient
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    (async () => {
      //logger.info(`[DEBUG] HandleBaileysMessage called for message:`, JSON.stringify({
        //id: msg.key.id,
        //from: msg.key.remoteJid,
        //fromMe: msg.key.fromMe,
        //hasMessage: !!msg.message,
        //type: msg.message ? Object.keys(msg.message)[0] : 'no-message'
      //}, null, 2));

      if (!msg.key.fromMe && !msg.message) {
        //logger.info(`[DEBUG] Skipping message - no content and not from me`);
        return;
      }

      const whatsapp = await ShowWhatsAppService({ id: wbot.id });
      const { tenantId } = whatsapp;

      // Ignorar mensagens de grupo se configurado
      const Settingdb = await Setting.findOne({
        where: { key: 'ignoreGroupMsg', tenantId }
      });

      const isGroup = msg.key.remoteJid?.endsWith('@g.us');
      if (Settingdb?.value === 'enabled' && isGroup) {
        return;
      }

      try {
        let msgContact: WbotContact;
        let groupContact: Contact | undefined;

        const jid = msg.key.remoteJid || msg.key.participant || "";
        const numero = jid.split('@')[0].replace(/\D/g, '');

        if (msg.key.fromMe) {
          const [foundContact] = await Contact.findOrCreate({
            where: { 
              number: numero,
              tenantId 
            },
            defaults: {
              name: msg.pushName || numero,
              isWAContact: true
            }
          });
          msgContact = {
            id: {
              user: numero,
              _serialized: jid
            },
            name: foundContact.name || '',
            pushname: foundContact.pushname || '',
            number: numero,
            isGroup: false,
            isMe: false,
            isWAContact: true,
            isMyContact: true,
            getProfilePicUrl: async () => foundContact.profilePicUrl || ''
          };
        } else {
          const [foundContact] = await Contact.findOrCreate({
            where: { 
              number: numero,
              tenantId 
            },
            defaults: {
              name: msg.pushName || numero,
              isWAContact: true
            }
          });
          msgContact = {
            id: {
              user: numero,
              _serialized: jid
            },
            name: foundContact.name || '',
            pushname: foundContact.pushname || '',
            number: numero,
            isGroup: false,
            isMe: false,
            isWAContact: true,
            isMyContact: true,
            getProfilePicUrl: async () => foundContact.profilePicUrl || ''
          };
        }

        if (isGroup) {
          const groupPhoneNumber = msg.key.remoteJid?.split('@')[0];
          if (groupPhoneNumber) {
            const foundGroupContact = await Contact.findOne({
              where: { number: groupPhoneNumber }
            });
            groupContact = foundGroupContact || undefined;
          }
        }

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

        const adaptedMessage = BaileysMessageAdapter.convertMessage(msg, wbot);
        const messageType = Object.keys(msg.message || {})[0];
        if (messageType !== 'conversation' && messageType !== 'extendedTextMessage') {
          await VerifyMediaMessage(adaptedMessage, ticket, contact);
        } else {
          await VerifyMessage(adaptedMessage, ticket, contact);
        }

        const isBusinessHours = await verifyBusinessHours(adaptedMessage, ticket);
        if (isBusinessHours) {
          await VerifyStepsChatFlowTicket(adaptedMessage, ticket);
        }

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
        }

        resolve();
      } catch (err) {
        logger.error(err);
        reject(err);
      }
    })();
  });
};

export default HandleBaileysMessage;