import { Op } from "sequelize";
import type { proto } from "@whiskeysockets/baileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import type Contact from "../../models/Contact";
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
    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;

    // Primeiro, verifica se já existe uma mensagem pendente nos últimos 5 segundos
    const existingMessage = await Message.findOne({
      where: {
        ticketId: ticket.id,
        fromMe: true,
        body,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 5000),
        },
        isDeleted: false,
      },
      order: [["createdAt", "DESC"]],
      lock: true,
      transaction: t,
    });

    let messageToUpdate: Message;

    if (existingMessage) {
      if (existingMessage.status === "error") {
        await existingMessage.update(
          {
            status: "pending",
            ack: 0,
          },
          { transaction: t }
        );
      }
      messageToUpdate = existingMessage;
    } else {
      messageToUpdate = await Message.create(
        {
          ticketId: ticket.id,
          body,
          contactId: contact.id,
          fromMe: true,
          read: true,
          mediaType: media ? "document" : "chat",
          timestamp: Date.now(),
          quotedMsgId: quotedMsg?.id || null,
          status: "pending",
          ack: 0,
          messageId: null,
          tenantId: ticket.tenantId,
        },
        { transaction: t }
      );
    }

    // Prepara as opções da mensagem incluindo a citação se houver
    const messageOptions: any = {
      linkPreview: false,
    };

    if (quotedMsg?.messageId) {
      messageOptions.quoted = {
        key: {
          remoteJid: number,
          id: quotedMsg.messageId,
          fromMe: quotedMsg.fromMe,
        },
        message: {
          conversation: quotedMsg.body,
        },
      };
    }

    // Enviar como mensagem normal (mesmo sendo resposta de botão)
    const sentMessage = await wbot.sendMessage(
      number,
      {
        text: body,
      },
      messageOptions
    );

    // Extrai o ID da mensagem e status da resposta
    const messageId = sentMessage.key.id;
    const status = sentMessage.status || 1;

    // Atualiza a mensagem com o ID e status
    await messageToUpdate.update(
      {
        messageId,
        status: "sended",
        ack: status,
      },
      { transaction: t }
    );

    await t.commit();

    return messageToUpdate;
  } catch (error) {
    await t.rollback();
    logger.error(`[SendWhatsAppMessage] Error: ${error}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
