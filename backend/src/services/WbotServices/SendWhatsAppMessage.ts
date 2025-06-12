import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import { Op } from "sequelize";
import sequelize from "../../database";
import type Contact from "../../models/Contact";
import type { proto } from "@whiskeysockets/baileys";
// import { StartWhatsAppSessionVerify } from "./StartWhatsAppSessionVerify";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  userId?: number | string | undefined;
  media?: proto.IMessage;
}

export const SendWhatsAppMessage = async (
  contact: Contact,
  ticket: Ticket,
  body: string,
  quotedMsg?: Message,
  media?: proto.IMessage
): Promise<Message> => {
  const t = await sequelize.transaction();
  try {
    const wbot = await GetTicketWbot(ticket);
    const number = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

    // Primeiro, verifica se já existe uma mensagem pendente nos últimos 5 segundos
    // Usamos FOR UPDATE para garantir que ninguém mais pode criar/atualizar mensagens nesse período
    const existingMessage = await Message.findOne({
      where: {
        ticketId: ticket.id,
        fromMe: true,
        body: body,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 5000) // Últimos 5 segundos
        },
        isDeleted: false
      },
      order: [['createdAt', 'DESC']], // Pegamos a mais recente
      lock: true,
      transaction: t
    });

    let messageToUpdate: Message;

    if (existingMessage) {
      logger.info(`[SendWhatsAppMessage] Found existing message ${existingMessage.id} from ${existingMessage.createdAt.toISOString()}, reusing it`);
      // Se a mensagem existente estava com erro, atualiza para pending
      if (existingMessage.status === 'error') {
        await existingMessage.update({
          status: 'pending',
          ack: 0
        }, { transaction: t });
      }
      messageToUpdate = existingMessage;
    } else {
      logger.info(`[SendWhatsAppMessage] Creating new message in database: ${JSON.stringify({
        ticketId: ticket.id,
        body,
        contactId: contact.id,
        fromMe: true,
        read: true,
        mediaType: media ? "document" : "chat", // Simplificando o tipo de mídia
        timestamp: Date.now(),
        quotedMsg: quotedMsg ? { id: quotedMsg.id } : {},
        status: "pending",
        ack: 0,
        messageId: null,
        tenantId: ticket.tenantId
      })}`);

      messageToUpdate = await Message.create({
        ticketId: ticket.id,
        body,
        contactId: contact.id,
        fromMe: true,
        read: true,
        mediaType: media ? "document" : "chat", // Simplificando o tipo de mídia
        timestamp: Date.now(),
        quotedMsg: quotedMsg ? { id: quotedMsg.id } : {},
        status: "pending",
        ack: 0,
        messageId: null,
        tenantId: ticket.tenantId
      }, { transaction: t });

      logger.info(`[SendWhatsAppMessage] Message created in database with ID: ${messageToUpdate.id}`);
    }

    // Envia a mensagem
    logger.info(`[SendWhatsAppMessage] Preparing to send message to chatId: ${number}`);
    const sentMessage = await wbot.sendMessage(number, {
      text: body,
      linkPreview: false
    });

    // Extrai o ID da mensagem e status da resposta
    const messageId = sentMessage.key.id;
    const status = sentMessage.status || 1; // 1 = PENDING

    logger.info(`[SendWhatsAppMessage] Message sent successfully. Raw response: ${JSON.stringify(sentMessage)}`);
    logger.info(`[SendWhatsAppMessage] Extracted message ID: ${messageId}, Status: ${status}`);

    // Atualiza a mensagem com o ID do WhatsApp e status
    logger.info(`[SendWhatsAppMessage] Updating message in database: ${JSON.stringify({
      messageId,
      status: 'pending',
      ack: status
    })}`);

    await messageToUpdate.update({
      messageId,
      status: 'pending',
      ack: status
    }, { transaction: t });

    logger.info(`[SendWhatsAppMessage] Message ${messageToUpdate.id} updated in database. Status: pending`);

    await t.commit();
    return messageToUpdate;
  } catch (err) {
    await t.rollback();
    logger.error(`[SendWhatsAppMessage] Error sending message: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG", 500);
  }
};

export default SendWhatsAppMessage;
