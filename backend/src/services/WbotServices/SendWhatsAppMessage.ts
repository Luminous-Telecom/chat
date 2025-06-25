import type { proto } from "@whiskeysockets/baileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import type Contact from "../../models/Contact";
import User from "../../models/User";
import socketEmit from "../../helpers/socketEmit";
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
  media?: proto.IMessage,
  userId?: number | string
): Promise<Message> => {
  const t = await sequelize.transaction();
  try {
    const wbot = await GetTicketWbot(ticket);
    const number = `${contact.number}@${
      ticket.isGroup ? "g.us" : "s.whatsapp.net"
    }`;

    // Adicionar assinatura do usuário ao corpo da mensagem se userId estiver disponível
    let messageBody = body;
    if (userId) {
      try {
        const user = await User.findByPk(userId, {
          attributes: ["id", "name", "email"]
        });
        if (user && user.name) {
          messageBody = `*${user.name}*:\n${body}`;
        }
      } catch (error) {
        logger.warn(`[SendWhatsAppMessage] Could not fetch user ${userId}: ${error}`);
        // Continue without signature if user not found
      }
    }

    // Sempre criar uma nova mensagem (sem proteção anti-spam)
    const messageToUpdate = await Message.create(
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
        userId: userId || null, // Adicionar o userId à mensagem
      },
      { transaction: t }
    );

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
        text: messageBody, // Usar messageBody que pode conter a assinatura
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

    // NOVO: Atualizar ticket com answered: true (mensagem enviada = respondido)
    await ticket.update(
      {
        lastMessage: body,
        lastMessageAt: new Date().getTime(),
        answered: true, // Mensagem enviada = ticket respondido
      },
      { transaction: t }
    );

    await t.commit();

    // NOVO: Recarregar ticket atualizado para garantir dados corretos
    await ticket.reload();

    // NOVO: Emitir evento de atualização do ticket para mudança instantânea da cor
    socketEmit({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticket,
    });

    return messageToUpdate;
  } catch (error) {
    await t.rollback();
    logger.error(`[SendWhatsAppMessage] Error: ${error}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
