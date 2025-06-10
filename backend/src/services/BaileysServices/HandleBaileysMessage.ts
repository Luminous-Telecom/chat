import { proto, WASocket } from '@whiskeysockets/baileys';
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import { WhatsAppErrors } from "../../utils/errorHandler";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import VerifyStepsChatFlowTicket from "../ChatFlowServices/VerifyStepsChatFlowTicket";
import verifyBusinessHours from "../WbotServices/helpers/VerifyBusinessHours";
import MediaHandler from "../MediaServices/MediaHandler";
import AudioDocumentHandler from "../MediaServices/AudioDocumentHandler";
import { getBaileys } from "./BaileysService";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import { Op } from "sequelize";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

const getContact = async (msg: proto.IWebMessageInfo, tenantId: number): Promise<Contact> => {
  const sender = msg.key.fromMe ? msg.key.remoteJid! : msg.key.participant || msg.key.remoteJid!;
  
  const contactData = {
    name: msg.pushName ?? sender.split('@')[0],
    number: sender.split('@')[0],
    tenantId,
    isGroup: msg.key.remoteJid?.endsWith('@g.us') || false,
    pushname: msg.pushName ?? sender.split('@')[0],
    isUser: false,
    isWAContact: true
  };

  return CreateOrUpdateContactService(contactData);
};

const getMessageBody = (msg: proto.IWebMessageInfo): string => {
  if (msg.message?.conversation) {
    return msg.message.conversation;
  }
  
  if (msg.message?.extendedTextMessage?.text) {
    return msg.message.extendedTextMessage.text;
  }
  
  if (msg.message?.imageMessage?.caption) {
    return msg.message.imageMessage.caption;
  }
  
  if (msg.message?.videoMessage?.caption) {
    return msg.message.videoMessage.caption;
  }
  
  if (msg.message?.documentMessage?.caption) {
    return msg.message.documentMessage.caption;
  }

  // Processar respostas de botões
  if (msg.message?.buttonsResponseMessage) {
    const buttonResponse = msg.message.buttonsResponseMessage;
    const buttonId = buttonResponse.selectedButtonId;
    const displayText = buttonResponse.selectedDisplayText;
    
    // Usar asserção de tipo para comparar o tipo do botão
    const buttonType = buttonResponse.type as number;
    if (buttonType === 2 && displayText) {
      return `URL selecionada: ${displayText}`;
    }
    
    return displayText || buttonId || 'Botão selecionado';
  }

  // Processar respostas de lista
  if (msg.message?.listResponseMessage) {
    const listResponse = msg.message.listResponseMessage;
    const selectedItem = listResponse.singleSelectReply?.selectedRowId;
    const selectedTitle = listResponse.title;
    const selectedDescription = listResponse.description;
    
    let response = selectedTitle || 'Item selecionado';
    if (selectedItem) {
      response += `: ${selectedItem}`;
    }
    if (selectedDescription) {
      response += `\n${selectedDescription}`;
    }
    
    return response;
  }

  // Processar mensagens de localização
  if (msg.message?.locationMessage) {
    const location = msg.message.locationMessage;
    const name = location.name || 'Localização';
    const address = location.address || '';
    const coordinates = `${location.degreesLatitude}, ${location.degreesLongitude}`;
    
    return `${name}${address ? `\n${address}` : ''}\n${coordinates}`;
  }

  // Processar mensagens de contato
  if (msg.message?.contactsArrayMessage) {
    const contacts = msg.message.contactsArrayMessage.contacts;
    if (!contacts || contacts.length === 0) {
      return '';
    }

    return contacts.map(contact => {
      const vcard = contact.vcard || "";
      const name = contact.displayName || 'Contato';
      const number = vcard.match(/TEL[^:]*:([^\\\n]*)/)?.[1] || '';
      const email = vcard.match(/EMAIL[^:]*:([^\\\n]*)/)?.[1] || '';
      
      let contactInfo = name;
      if (number) contactInfo += `\n${number}`;
      if (email) contactInfo += `\n${email}`;
      
      return contactInfo;
    }).join('\n\n');
  }

  // Processar reações
  if (msg.message?.reactionMessage) {
    return msg.message.reactionMessage.text || '👍';
  }

  return '';
};

const getMessageType = (msg: proto.IWebMessageInfo): string => {
  if (msg.message?.reactionMessage) return 'reaction';
  if (msg.message?.buttonsResponseMessage) return 'button_response';
  if (msg.message?.listResponseMessage) return 'list_response';
  if (msg.message?.locationMessage) return 'location';
  if (msg.message?.contactsArrayMessage) return 'contact';
  if (msg.message?.imageMessage) return 'image';
  if (msg.message?.videoMessage) return 'video';
  if (msg.message?.audioMessage) return 'audio';
  if (msg.message?.documentMessage) return 'document';
  if (msg.message?.stickerMessage) return 'sticker';
  if (msg.message?.extendedTextMessage) return 'reply';
  return 'chat';
};

const getQuotedMessageId = (msg: proto.IWebMessageInfo): string | undefined => {
  if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    return msg.message.extendedTextMessage.contextInfo.stanzaId ?? undefined;
  }
  if (msg.message?.reactionMessage?.key) {
    return msg.message.reactionMessage.key.id ?? undefined;
  }
  return undefined;
};

const HandleBaileysMessage = async (msg: proto.IWebMessageInfo, session: Session): Promise<void> => {
  try {
    const io = getIO();
    const whatsapp = await ShowWhatsAppService({ id: session.id, tenantId: session.tenantId });
    
    if (!whatsapp) {
      throw WhatsAppErrors.sessionNotFound(`WhatsApp ${session.id} not found`);
    }

    // Ignorar mensagens do próprio bot
    if (msg.key.fromMe) {
      return;
    }

    // Processar contato
    const contact = await getContact(msg, session.tenantId);

    // Criar ou recuperar ticket
    const ticket = await FindOrCreateTicketService({
      contact,
      whatsappId: session.id,
      unreadMessages: 1,
      tenantId: session.tenantId,
      groupContact: msg.key.remoteJid?.endsWith('@g.us') ? contact : undefined,
      msg,
      channel: "whatsapp"
    });

    if (!ticket) {
      return;
    }

    // Processar mensagem
    const messageData = {
      messageId: msg.key.id!,
      ticketId: ticket.id,
      contactId: msg.key.fromMe ? undefined : contact.id,
      body: getMessageBody(msg),
      fromMe: msg.key.fromMe || false,
      read: msg.key.fromMe || false,
      mediaType: getMessageType(msg),
      timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now()
    };

    // Processar mensagem de áudio
    if (msg.message?.audioMessage) {
      const audioHandler = AudioDocumentHandler.getInstance();
      await audioHandler.handleAudioMessage(msg, ticket, contact, whatsapp);
      return;
    }

    // Processar mensagem de documento
    if (msg.message?.documentMessage) {
      const audioHandler = AudioDocumentHandler.getInstance();
      await audioHandler.handleDocumentMessage(msg, ticket, contact, whatsapp);
      return;
    }

    // Salvar mensagem
    const message = await CreateMessageService({ messageData, tenantId: session.tenantId });

    // Verificar horário comercial
    const isBusinessHours = await verifyBusinessHours(msg, ticket);

    // Atualizar ticket
    await ticket.update({
      lastMessage: messageData.body,
      lastMessageAt: messageData.timestamp,
      answered: !isBusinessHours,
      unreadMessages: (ticket.unreadMessages || 0) + 1
    });

    // Emitir eventos
    io.emit(`${ticket.tenantId}:ticket`, {
      action: "update",
      ticket,
      contact: ticket.contact
    });

    io.emit(`${ticket.tenantId}:appMessage`, {
      action: "create",
      message,
      ticket,
      contact: ticket.contact
    });

    // Verificar fluxo de chat
    if (ticket.chatFlowId) {
      await VerifyStepsChatFlowTicket(msg, ticket);
    }

  } catch (err) {
    logger.error(`Error handling Baileys message: ${err}`);
  }
};

export default HandleBaileysMessage;