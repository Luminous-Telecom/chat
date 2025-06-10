import { proto } from '@whiskeysockets/baileys';
import { logger } from "../../utils/logger";
import { getBaileys } from "./BaileysService";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import {
  isValidURL,
  isValidPhoneNumber,
  isValidEmail,
  isValidLatitude,
  isValidLongitude,
  isValidMediaType,
  isValidButtonType,
  hasValidStringLengths,
  hasValidArrayLength,
  isValidMessageLength,
  isValidList,
  isValidLocation,
  isValidContact,
  isValidMediaUrl,
  isValidFooterLength,
  isValidButtonsCount,
  isValidListItemsCount
} from "../../utils/validators";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { Op } from "sequelize";
import MediaHandler from "../MediaServices/MediaHandler";

interface Button {
  id: string;
  text: string;
  imageUrl?: string;
  type?: 'reply' | 'url' | 'quick_reply';
  url?: string;
}

interface ListItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
}

interface CarouselItem {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  buttons?: Button[];
}

interface Location {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

interface ContactData {
  name: string;
  number: string;
  email?: string;
}

interface Request {
  ticket: Ticket;
  body: string;
  buttons?: Button[];
  list?: {
    title: string;
    description?: string;
    buttonText: string;
    items: ListItem[];
  };
  carousel?: {
    title: string;
    description?: string;
    items: CarouselItem[];
  };
  location?: Location;
  contact?: ContactData;
  footer?: string;
  userId?: number | string;
  mediaUrl?: string;
  mediaType?: string;
  quickReplies?: string[];
}

const validateButton = (button: Button): void => {
  if (!button.id || !button.text) {
    throw AppError.getError("ERR_INVALID_BUTTON");
  }

  if (!hasValidStringLengths([button.id, button.text], 1, 256)) {
    throw AppError.getError("ERR_INVALID_BUTTON_LENGTH");
  }

  if (button.type && !isValidButtonType(button.type)) {
    throw AppError.getError("ERR_INVALID_BUTTON_TYPE");
  }

  if (button.type === 'url') {
    if (!button.url) {
      throw AppError.getError("ERR_BUTTON_URL_REQUIRED");
    }
    if (!isValidURL(button.url)) {
      throw AppError.getError("ERR_INVALID_BUTTON_URL");
    }
  }

  if (button.imageUrl && !isValidURL(button.imageUrl)) {
    throw AppError.getError("ERR_INVALID_BUTTON_IMAGE_URL");
  }
};

const validateContact = (contact: ContactData): void => {
  if (!contact.name || !contact.number) {
    throw AppError.getError("ERR_INVALID_CONTACT");
  }

  if (!hasValidStringLengths([contact.name], 1, 256)) {
    throw AppError.getError("ERR_INVALID_CONTACT_NAME_LENGTH");
  }

  if (!isValidPhoneNumber(contact.number)) {
    throw AppError.getError("ERR_INVALID_CONTACT_NUMBER");
  }

  if (contact.email && !isValidEmail(contact.email)) {
    throw AppError.getError("ERR_INVALID_CONTACT_EMAIL");
  }
};

const validateLocation = (location: Location): void => {
  if (!isValidLatitude(location.latitude)) {
    throw AppError.getError("ERR_INVALID_LATITUDE");
  }

  if (!isValidLongitude(location.longitude)) {
    throw AppError.getError("ERR_INVALID_LONGITUDE");
  }

  if (location.name && !hasValidStringLengths([location.name], 1, 256)) {
    throw AppError.getError("ERR_INVALID_LOCATION_NAME_LENGTH");
  }

  if (location.address && !hasValidStringLengths([location.address], 1, 1024)) {
    throw AppError.getError("ERR_INVALID_LOCATION_ADDRESS_LENGTH");
  }
};

const validateCarousel = (carousel: {
  title: string;
  description?: string;
  items: CarouselItem[];
}): void => {
  if (!carousel.title || !Array.isArray(carousel.items)) {
    throw AppError.getError("ERR_INVALID_CAROUSEL");
  }

  if (!hasValidStringLengths([carousel.title], 1, 256)) {
    throw AppError.getError("ERR_INVALID_CAROUSEL_TITLE_LENGTH");
  }

  if (carousel.description && !hasValidStringLengths([carousel.description], 1, 1024)) {
    throw AppError.getError("ERR_INVALID_CAROUSEL_DESCRIPTION_LENGTH");
  }

  if (!hasValidArrayLength(carousel.items, 1, 10)) {
    throw AppError.getError("ERR_INVALID_CAROUSEL_ITEMS_COUNT");
  }

  carousel.items.forEach(item => {
    if (!item.id || !item.title || !item.imageUrl) {
      throw AppError.getError("ERR_INVALID_CAROUSEL_ITEM");
    }

    if (!hasValidStringLengths([item.id, item.title], 1, 256)) {
      throw AppError.getError("ERR_INVALID_CAROUSEL_ITEM_LENGTH");
    }

    if (!isValidURL(item.imageUrl)) {
      throw AppError.getError("ERR_INVALID_CAROUSEL_ITEM_IMAGE_URL");
    }

    if (item.description && !hasValidStringLengths([item.description], 1, 1024)) {
      throw AppError.getError("ERR_INVALID_CAROUSEL_ITEM_DESCRIPTION_LENGTH");
    }

    if (item.buttons) {
      if (!hasValidArrayLength(item.buttons, 1, 3)) {
        throw AppError.getError("ERR_INVALID_CAROUSEL_ITEM_BUTTONS_COUNT");
      }
      item.buttons.forEach(validateButton);
    }
  });
};

const validateQuickReplies = (replies: string[]): void => {
  if (!hasValidArrayLength(replies, 1, 3)) {
    throw AppError.getError("ERR_INVALID_QUICK_REPLIES_COUNT");
  }

  if (!hasValidStringLengths(replies, 1, 256)) {
    throw AppError.getError("ERR_INVALID_QUICK_REPLY_LENGTH");
  }
};

const validateMessage = (message: Request): void => {
  // Validar corpo da mensagem
  if (!message.body && !message.location && !message.contact) {
    throw new AppError("ERR_MESSAGE_BODY_REQUIRED");
  }

  if (message.body && !isValidMessageLength(message.body)) {
    throw new AppError("ERR_INVALID_MESSAGE_LENGTH");
  }

  // Validar rodapé
  if (message.footer && !isValidFooterLength(message.footer)) {
    throw new AppError("ERR_INVALID_FOOTER_LENGTH");
  }

  // Validar mídia
  if (message.mediaUrl) {
    if (!message.mediaType) {
      throw new AppError("ERR_MEDIA_TYPE_REQUIRED");
    }

    if (!isValidMediaType(message.mediaType)) {
      throw new AppError("ERR_INVALID_MEDIA_TYPE");
    }

    if (!isValidMediaUrl(message.mediaUrl)) {
      throw new AppError("ERR_INVALID_MEDIA_URL");
    }
  }

  // Validar botões
  if (message.buttons) {
    if (!isValidButtonsCount(message.buttons)) {
      throw new AppError("ERR_INVALID_BUTTONS_COUNT");
    }

    message.buttons.forEach(validateButton);
  }

  // Validar lista
  if (message.list) {
    if (!isValidListItemsCount(message.list.items)) {
      throw new AppError("ERR_INVALID_LIST_ITEMS_COUNT");
    }

    if (!message.list.title || !message.list.buttonText || !Array.isArray(message.list.items)) {
      throw new AppError("ERR_INVALID_LIST");
    }

    if (!hasValidStringLengths([message.list.title, message.list.buttonText], 1, 256)) {
      throw new AppError("ERR_INVALID_LIST_TITLE_LENGTH");
    }

    message.list.items.forEach(item => {
      if (!item.id || !item.title) {
        throw new AppError("ERR_INVALID_LIST_ITEM");
      }

      if (!hasValidStringLengths([item.id, item.title], 1, 256)) {
        throw new AppError("ERR_INVALID_LIST_ITEM_LENGTH");
      }

      if (item.description && !hasValidStringLengths([item.description], 1, 1024)) {
        throw new AppError("ERR_INVALID_LIST_ITEM_DESCRIPTION_LENGTH");
      }

      if (item.imageUrl && !isValidURL(item.imageUrl)) {
        throw new AppError("ERR_INVALID_LIST_ITEM_IMAGE_URL");
      }
    });
  }

  // Validar mensagem interativa
  if (!message.body && !message.buttons && !message.list && !message.location && !message.contact) {
    throw new AppError("ERR_INVALID_INTERACTIVE_MESSAGE");
  }
};

const SendBaileysInteractiveMessage = async ({
  ticket,
  body,
  buttons,
  list,
  carousel,
  location,
  contact,
  footer,
  userId,
  mediaUrl,
  mediaType,
  quickReplies
}: Request): Promise<Message> => {
  try {
    const io = getIO();
    const wbot = getBaileys(ticket.whatsappId);

    if (!wbot) {
      throw AppError.getError("ERR_NO_WHATSAPP_SESSION");
    }

    validateMessage({
      ticket,
      body,
      buttons,
      list,
      carousel,
      location,
      contact,
      footer,
      userId,
      mediaUrl,
      mediaType,
      quickReplies
    });

    let messageContent: any = {};

    // Preparar mensagem interativa
    if (buttons && buttons.length > 0) {
      // Limitar a 3 botões por mensagem (limitação do WhatsApp)
      const limitedButtons = buttons.slice(0, 3);
      
      // Preparar botões com suporte a imagens e URLs
      const formattedButtons = limitedButtons.map(button => {
        const buttonContent: any = {
          buttonId: button.id,
          buttonText: { displayText: button.text }
        };

        if (button.imageUrl) {
          buttonContent.image = { url: button.imageUrl };
        }

        if (button.type === 'url' && button.url) {
          buttonContent.type = 2; // URL button
          buttonContent.url = button.url;
        } else if (button.type === 'quick_reply') {
          buttonContent.type = 3; // Quick reply button
        } else {
          buttonContent.type = 1; // Reply button
        }

        return buttonContent;
      });

      messageContent = {
        buttonsMessage: {
          contentText: body,
          footerText: footer,
          buttons: formattedButtons
        }
      };

      // Adicionar imagem de fundo se fornecida
      if (mediaUrl && mediaType === 'image') {
        messageContent.buttonsMessage.image = { url: mediaUrl };
      }
    } else if (list && list.items.length > 0) {
      // Limitar a 10 itens por lista (limitação do WhatsApp)
      const limitedItems = list.items.slice(0, 10);
      
      // Preparar itens da lista com suporte a imagens
      const formattedItems = limitedItems.map(item => ({
        title: item.title,
        description: item.description,
        rowId: item.id,
        ...(item.imageUrl && { image: { url: item.imageUrl } })
      }));

      messageContent = {
        listMessage: {
          title: list.title,
          description: list.description,
          buttonText: list.buttonText,
          footerText: footer,
          listType: 1,
          sections: [{
            title: list.title,
            rows: formattedItems
          }]
        }
      };

      // Adicionar imagem de fundo se fornecida
      if (mediaUrl && mediaType === 'image') {
        messageContent.listMessage.image = { url: mediaUrl };
      }
    } else if (carousel && carousel.items.length > 0) {
      // Limitar a 10 itens no carrossel (limitação do WhatsApp)
      const limitedItems = carousel.items.slice(0, 10);
      
      // Preparar itens do carrossel
      const formattedItems = limitedItems.map(item => ({
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        buttons: item.buttons?.slice(0, 3).map(button => ({
          buttonId: button.id,
          buttonText: { displayText: button.text },
          type: button.type === 'url' ? 2 : 1
        }))
      }));

      messageContent = {
        carouselMessage: {
          title: carousel.title,
          description: carousel.description,
          footerText: footer,
          items: formattedItems
        }
      };
    } else if (location) {
      // Mensagem de localização
      messageContent = {
        locationMessage: {
          degreesLatitude: location.latitude,
          degreesLongitude: location.longitude,
          name: location.name,
          address: location.address
        }
      };
    } else if (contact) {
      // Mensagem de contato
      messageContent = {
        contactsArrayMessage: {
          contacts: [{
            displayName: contact.name,
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL;type=CELL;type=VOICE;waid=${contact.number}:${contact.number}${contact.email ? `\nEMAIL:${contact.email}` : ''}\nEND:VCARD`
          }]
        }
      };
    } else if (quickReplies && quickReplies.length > 0) {
      // Limitar a 3 respostas rápidas (limitação do WhatsApp)
      const limitedReplies = quickReplies.slice(0, 3);
      
      messageContent = {
        text: body,
        footer: footer,
        buttons: limitedReplies.map(reply => ({
          buttonId: reply,
          buttonText: { displayText: reply },
          type: 3 // Quick reply button
        }))
      };
    } else {
      throw AppError.getError("ERR_INVALID_INTERACTIVE_MESSAGE");
    }

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      ticket.contact.number + '@s.whatsapp.net',
      messageContent
    );

    if (!sentMessage) {
      throw AppError.getError("ERR_SENDING_WAPP_MSG");
    }

    // Criar registro da mensagem
    const messageData = {
      messageId: sentMessage.key.id!,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body,
      fromMe: true,
      read: true,
      mediaType: buttons ? 'button' : 
                list ? 'list' : 
                carousel ? 'carousel' :
                location ? 'location' : 
                contact ? 'contact' :
                quickReplies ? 'quick_reply' : 'chat',
      mediaUrl,
      timestamp: Date.now(),
      status: "sending"
    };

    const message = await CreateMessageService({
      messageData,
      tenantId: ticket.tenantId
    });

    // Atualizar ticket
    await ticket.update({
      lastMessage: body,
      lastMessageAt: Date.now(),
      answered: true,
      userId: userId || null
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

    return message;
  } catch (err) {
    logger.error(`Error sending Baileys interactive message: ${err}`);
    if (err instanceof AppError) {
      throw err;
    }
    throw AppError.getError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysInteractiveMessage;