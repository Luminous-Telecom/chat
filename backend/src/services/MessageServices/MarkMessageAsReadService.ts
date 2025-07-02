import { Transaction } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface MarkMessageAsReadParams {
  message: Message;
  ticket: Ticket;
  ack: number;
  transaction?: Transaction;
  source?: "whatsapp_ack" | "manual" | "system";
}

export const MarkMessageAsReadService = async ({
  message,
  ticket,
  ack,
  transaction,
  source = "system"
}: MarkMessageAsReadParams): Promise<void> => {
  try {
    // Verificar se a mensagem já está marcada como lida
    if (message.read) {
      return;
    }

    // Verificar se é uma mensagem recebida (não enviada por mim)
    if (message.fromMe) {
      return;
    }

    // Marcar mensagem como lida
    await message.update({ read: true }, { transaction });

    // Contar mensagens não lidas do ticket
    const unreadCount = await Message.count({
      where: {
        ticketId: ticket.id,
        read: false,
        fromMe: false,
      },
      transaction
    });

    // Atualizar ticket com novo contador
    const shouldMarkAnswered = unreadCount === 0;
    await ticket.update({
      unreadMessages: unreadCount,
      answered: shouldMarkAnswered || ticket.answered
    }, { transaction });

    logger.info(`[MarkMessageAsReadService] 📖 MARKED AS READ: Message ${message.id} from ${source}, ticket ${ticket.id} unreadMessages: ${unreadCount}, answered: ${shouldMarkAnswered || ticket.answered}`);

    // 🔥 SEMPRE emitir evento para sincronização dinâmica no frontend
    // Mesmo em transação, pois queremos atualização em tempo real
    const io = getIO();
    
    // Evento específico para marcação de mensagem como lida
    io.to(ticket.tenantId.toString()).emit(`${ticket.tenantId}:messageRead`, {
      type: "message:read",
      payload: {
        messageId: message.id,
        ticketId: ticket.id,
        read: true,
        source,
        ack,
        fromMe: message.fromMe,
        automatic: source === "whatsapp_ack", // 🔥 NOVO: indica se foi automático
        timestamp: new Date().toISOString(),
        ticket: {
          id: ticket.id,
          unreadMessages: unreadCount,
          answered: shouldMarkAnswered || ticket.answered,
        },
      },
    });

    // Evento para atualização geral do ticket
    io.to(ticket.tenantId.toString()).emit(`${ticket.tenantId}:ticketList`, {
      type: "chat:update",
      payload: {
        ticketId: ticket.id,
        messageId: message.id,
        read: true,
        source,
        ack,
        automatic: source === "whatsapp_ack",
        ticket: {
          id: ticket.id,
          unreadMessages: unreadCount,
          answered: shouldMarkAnswered || ticket.answered,
        },
      },
    });

    logger.info(`[MarkMessageAsReadService] 📡 EVENTO EMITIDO: messageRead e ticketList para frontend (source: ${source}, automatic: ${source === "whatsapp_ack"})`);

  } catch (error) {
    logger.error(`[MarkMessageAsReadService] Error marking message ${message.id} as read: ${error}`);
    throw error;
  }
};

export default MarkMessageAsReadService;