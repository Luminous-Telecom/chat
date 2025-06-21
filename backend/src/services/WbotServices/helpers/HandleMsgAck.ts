// Não é necessário importar WbotMessage, pois é global
// Definir o tipo MessageAck localmente

// ou defina conforme necessário para o seu uso

// import { WbotMessage } from '../../../types/baileys';
// import { MessageAck } from "whatsapp-web.js";
import { WAMessage } from "@whiskeysockets/baileys";
import { Op, Sequelize } from "sequelize";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import { getIO } from "../../../libs/socket";
import sequelize from "../../../database";
import { logger } from "../../../utils/logger";
import CampaignContacts from "../../../models/CampaignContacts";
import ApiMessage from "../../../models/ApiMessage";
import socketEmit from "../../../helpers/socketEmit";
import Queue from "../../../libs/Queue";

type MessageAck = number;

// Helper function to get message status from ack
const getMessageStatus = (ack: number): string => {
  switch (ack) {
    case 1:
      return "sended";
    case 2:
      return "delivered";
    case 3:
      return "received";
    default:
      return "pending";
  }
};

export const HandleMsgAck = async (
  msg: WAMessage,
  ack: number
): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const messageId = msg.key?.id;
    if (!messageId) {
      await t.rollback();
      return;
    }

    // Primeiro, busca TODAS as mensagens com esse messageId
    const messages = await Message.findAll({
      where: {
        messageId,
        fromMe: true,
        isDeleted: false,
      },
      order: [["createdAt", "DESC"]], // Ordena por mais recente primeiro
      lock: true,
      transaction: t,
    });

    if (messages.length === 0) {
      // Só loga warning se for uma mensagem recente (últimos 5 minutos)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentMessage = await Message.findOne({
        where: {
          fromMe: true,
          isDeleted: false,
          createdAt: {
            [Op.gte]: fiveMinutesAgo,
          },
        },
        order: [["createdAt", "DESC"]],
      });

      if (recentMessage) {
        logger.warn(`[HandleMsgAck] No message found for ID ${messageId}, but found recent messages. Possible sync issue.`);
      }
      await t.rollback();
      return;
    }

    // Se temos mais de uma mensagem, vamos analisar qual devemos atualizar
    let messageToUpdate: Message | null = null;
    let duplicateMessages: Message[] = [];

    if (messages.length === 1) {
      // Se só temos uma mensagem, ela é a que devemos atualizar
      messageToUpdate = messages[0];
    } else {
      // Se temos múltiplas mensagens, vamos analisar cada uma
      // Primeiro, vamos verificar se alguma mensagem já tem um ACK maior
      const messagesWithHigherAck = messages.filter(m => m.ack >= ack);
      if (messagesWithHigherAck.length > 0) {
        await t.rollback();
        return;
      }

      // Agora vamos verificar qual mensagem devemos atualizar
      // Preferimos a mensagem que:
      // 1. Tem o ACK mais alto (mas menor que o novo ack)
      // 2. Foi criada mais recentemente
      messageToUpdate = messages.reduce((best, current) => {
        if (!best) return current;
        if (current.ack > best.ack) return current;
        if (current.ack === best.ack && current.createdAt > best.createdAt)
          return current;
        return best;
      }, null as Message | null);

      // Todas as outras mensagens são duplicadas
      duplicateMessages = messages.filter(m => m.id !== messageToUpdate?.id);
    }

    if (!messageToUpdate) {
      logger.error(
        `[HandleMsgAck] Could not determine which message to update for ID ${messageId}`
      );
      await t.rollback();
      return;
    }

    // Não permitir que um ACK menor sobrescreva um ACK maior
    if (ack <= messageToUpdate.ack) {
      await t.rollback();
      return;
    }

    // Busca o ticket e contato em uma segunda query
    const ticket = await Ticket.findOne({
      where: { id: messageToUpdate.ticketId },
      include: [{ model: Contact }],
      transaction: t,
    });

    if (!ticket) {
      logger.error(
        `[HandleMsgAck] Ticket not found for message ${messageToUpdate.id}`
      );
      await t.rollback();
      return;
    }

    const newStatus = getMessageStatus(ack);
    // Atualiza a mensagem com lock
    await messageToUpdate.update(
      {
        ack,
        status: newStatus,
      },
      { transaction: t }
    );

    // Emitir evento no canal correto
    const io = getIO();
    io.to(ticket.tenantId.toString()).emit(`${ticket.tenantId}:ticketList`, {
      type: "chat:ack",
      payload: {
        id: messageToUpdate.id,
        messageId: messageToUpdate.messageId,
        ack,
        status: newStatus,
        read: ack >= 3,
        fromMe: messageToUpdate.fromMe,
        ticket: {
          id: ticket.id,
          status: ticket.status,
          unreadMessages: ticket.unreadMessages,
          answered: ticket.answered,
        },
      },
    });

    // Se temos mensagens duplicadas, marca como deletadas
    if (duplicateMessages.length > 0) {
      logger.warn(
        `[HandleMsgAck] Found ${duplicateMessages.length} duplicate messages for ID ${messageId}, marking them as deleted`
      );
      for (const dup of duplicateMessages) {
        logger.warn(
          `[HandleMsgAck] - Duplicate message ${
            dup.id
          } created at ${dup.createdAt.toISOString()}, current ack: ${dup.ack}`
        );
        await dup.update({ isDeleted: true }, { transaction: t });
      }
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    logger.error(
      `[HandleMsgAck] Error processing ACK for message ${
        msg.key?.id || "unknown"
      }: ${err}`
    );
  }
};

export default HandleMsgAck;