import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import UserMessagesLog from "../../models/UserMessagesLog";

interface SendGroupAnnouncementRequest {
  ticket: Ticket;
  body: string;
  userId: number;
}

interface SendGroupWelcomeRequest {
  ticket: Ticket;
  body: string;
  userId: number;
}

interface SendGroupGoodbyeRequest {
  ticket: Ticket;
  body: string;
  userId: number;
}

interface SendGroupMentionRequest {
  ticket: Ticket;
  body: string;
  mentions: string[];
  userId: number;
}

const SendGroupAnnouncement = async ({
  ticket,
  body,
  userId
}: SendGroupAnnouncementRequest): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Verificar se o grupo é de anúncios
    const groupInfo = await wbot.groupMetadata(`${ticket.contact.number}@g.us`);
    if (!groupInfo.announce) {
      throw new AppError("ERR_GROUP_NOT_ANNOUNCEMENT");
    }

    // Enviar mensagem de anúncio
    const sentMessage = await wbot.sendMessage(`${ticket.contact.number}@g.us`, {
      text: body
    });

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_GROUP_ANNOUNCEMENT");
    }

    // Criar registro da mensagem
    const message = await Message.create({
      ticketId: ticket.id,
      body,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      sendType: "announcement"
    });

    // Atualizar ticket
    await ticket.update({
      lastMessage: body,
      lastMessageAt: new Date().getTime()
    });

    // Registrar mensagem do usuário
    await UserMessagesLog.create({
      messageId: message.id,
      userId,
      ticketId: ticket.id
    });

    // Emitir evento de nova mensagem
    const io = getIO();
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:appMessage`,
      {
        action: "create",
        message,
        ticket,
        contact: ticket.contact
      }
    );

    return message;
  } catch (err) {
    logger.error(`SendGroupAnnouncement | Error: ${err}`);
    throw new AppError("ERR_SENDING_GROUP_ANNOUNCEMENT");
  }
};

const SendGroupWelcome = async ({
  ticket,
  body,
  userId
}: SendGroupWelcomeRequest): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Enviar mensagem de boas-vindas
    const sentMessage = await wbot.sendMessage(ticket.contact.number, {
      text: body
    });

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_GROUP_WELCOME");
    }

    // Criar registro da mensagem
    const message = await Message.create({
      ticketId: ticket.id,
      body,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      sendType: "welcome"
    });

    // Atualizar ticket
    await ticket.update({
      lastMessage: body,
      lastMessageAt: new Date().getTime()
    });

    // Registrar mensagem do usuário
    await UserMessagesLog.create({
      messageId: message.id,
      userId,
      ticketId: ticket.id
    });

    // Emitir evento de nova mensagem
    const io = getIO();
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:appMessage`,
      {
        action: "create",
        message,
        ticket,
        contact: ticket.contact
      }
    );

    return message;
  } catch (err) {
    logger.error(`SendGroupWelcome | Error: ${err}`);
    throw new AppError("ERR_SENDING_GROUP_WELCOME");
  }
};

const SendGroupGoodbye = async ({
  ticket,
  body,
  userId
}: SendGroupGoodbyeRequest): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Enviar mensagem de despedida
    const sentMessage = await wbot.sendMessage(ticket.contact.number, {
      text: body
    });

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_GROUP_GOODBYE");
    }

    // Criar registro da mensagem
    const message = await Message.create({
      ticketId: ticket.id,
      body,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      sendType: "goodbye"
    });

    // Atualizar ticket
    await ticket.update({
      lastMessage: body,
      lastMessageAt: new Date().getTime()
    });

    // Registrar mensagem do usuário
    await UserMessagesLog.create({
      messageId: message.id,
      userId,
      ticketId: ticket.id
    });

    // Emitir evento de nova mensagem
    const io = getIO();
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:appMessage`,
      {
        action: "create",
        message,
        ticket,
        contact: ticket.contact
      }
    );

    return message;
  } catch (err) {
    logger.error(`SendGroupGoodbye | Error: ${err}`);
    throw new AppError("ERR_SENDING_GROUP_GOODBYE");
  }
};

const SendGroupMention = async ({
  ticket,
  body,
  mentions,
  userId
}: SendGroupMentionRequest): Promise<Message> => {
  try {
    const wbot = await GetTicketBaileys(ticket);

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Enviar mensagem com menções
    const sentMessage = await wbot.sendMessage(ticket.contact.number, {
      text: body,
      mentions
    });

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_GROUP_MENTION");
    }

    // Criar registro da mensagem
    const message = await Message.create({
      ticketId: ticket.id,
      body,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      sendType: "mention"
    });

    // Atualizar ticket
    await ticket.update({
      lastMessage: body,
      lastMessageAt: new Date().getTime()
    });

    // Registrar mensagem do usuário
    await UserMessagesLog.create({
      messageId: message.id,
      userId,
      ticketId: ticket.id
    });

    // Emitir evento de nova mensagem
    const io = getIO();
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:appMessage`,
      {
        action: "create",
        message,
        ticket,
        contact: ticket.contact
      }
    );

    return message;
  } catch (err) {
    logger.error(`SendGroupMention | Error: ${err}`);
    throw new AppError("ERR_SENDING_GROUP_MENTION");
  }
};

export {
  SendGroupAnnouncement,
  SendGroupWelcome,
  SendGroupGoodbye,
  SendGroupMention
};