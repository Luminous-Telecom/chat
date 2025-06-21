// Não é necessário importar WbotMessage, pois é global
// Definir o tipo MessageAck localmente

// ou defina conforme necessário para o seu uso

// import { WbotMessage } from '../../../types/baileys';
// import { MessageAck } from "whatsapp-web.js";
import { WAMessage } from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import Message from "../../../models/Message";
import { sequelize } from "../../../database";
import { logger } from "../../../utils/logger";
import socketEmit from "../../../helpers/socketEmit";
import Ticket from "../../../models/Ticket";

// Cache para controlar rate limiting de warnings
const warningCache = new Map<string, number>();
const WARNING_THROTTLE_TIME = 300000; // 5 minutos

const shouldLogWarning = (key: string): boolean => {
  const now = Date.now();
  const lastWarning = warningCache.get(key);
  
  if (!lastWarning || now - lastWarning > WARNING_THROTTLE_TIME) {
    warningCache.set(key, now);
    return true;
  }
  
  return false;
};

const isRecentMessage = (timeWindow: number = 600000): Promise<boolean> => {
  // Verifica se há mensagens nos últimos 10 minutos
  const timeAgo = new Date(Date.now() - timeWindow);
  
  return Message.findOne({
    where: {
      fromMe: true,
      isDeleted: false,
      createdAt: {
        [Op.gte]: timeAgo,
      },
    },
    order: [["createdAt", "DESC"]],
  }).then(message => !!message);
};

export const HandleMsgAck = async (
  msg: WAMessage,
  ack: number
): Promise<void> => {
  // Validações básicas
  if (!msg?.key?.id || ack < 0 || ack > 3) {
    return;
  }

  const messageId = msg.key.id;
  const t = await sequelize.transaction();
  
  try {
    // Buscar mensagens com esse messageId
    const messages = await Message.findAll({
      where: {
        messageId,
        fromMe: true,
        isDeleted: false,
      },
      order: [["createdAt", "DESC"]],
      lock: true,
      transaction: t,
    });

    if (messages.length === 0) {
      await t.rollback();
      
      // Só logar warning se for uma situação realmente problemática
      const hasRecentMessages = await isRecentMessage();
      if (hasRecentMessages) {
        const warningKey = `ack-no-message-${messageId.substring(0, 10)}`;
        if (shouldLogWarning(warningKey)) {
          logger.warn(
            `[HandleMsgAck] Message ID ${messageId} not found but recent messages exist. This might indicate a sync issue.`
          );
        }
      }
      return;
    }

    // Determinar qual mensagem atualizar
    let messageToUpdate: Message | null = null;
    let duplicateMessages: Message[] = [];

    if (messages.length === 1) {
      messageToUpdate = messages[0];
    } else {
      // Múltiplas mensagens - escolher a mais recente com ACK menor
      messageToUpdate = messages.find(m => m.ack < ack) || messages[0];
      duplicateMessages = messages.filter(m => m.id !== messageToUpdate!.id);
    }

    // Atualizar a mensagem principal
    if (messageToUpdate && messageToUpdate.ack < ack) {
      await messageToUpdate.update({ ack }, { transaction: t });

      // Incluir dados do ticket para o socket
      const messageWithTicket = await Message.findByPk(messageToUpdate.id, {
        include: [
          {
            model: Ticket,
            as: "ticket",
            include: ["contact"],
          },
        ],
        transaction: t,
      });

      await t.commit();

      // Emitir evento via socket (após commit da transação)
      if (messageWithTicket) {
        socketEmit({
          tenantId: messageWithTicket.ticket.tenantId,
          type: "chat:ack",
          payload: {
            id: messageWithTicket.id,
            messageId: messageWithTicket.messageId,
            ack: messageWithTicket.ack,
            status: getStatusFromAck(ack),
            ticketId: messageWithTicket.ticketId,
            fromMe: messageWithTicket.fromMe,
            timestamp: messageWithTicket.timestamp,
            mediaUrl: messageWithTicket.mediaUrl,
          },
        });
      }

      // Limpar mensagens duplicadas (em background)
      if (duplicateMessages.length > 0) {
        setImmediate(async () => {
          try {
            await cleanupDuplicateMessages(duplicateMessages);
          } catch (cleanupErr) {
            logger.error(`[HandleMsgAck] Error cleaning duplicates: ${cleanupErr}`);
          }
        });
      }
    } else {
      await t.rollback();
    }
  } catch (err) {
    await t.rollback();
    logger.error(`[HandleMsgAck] Error updating message ack: ${err}`);
  }
};

const getStatusFromAck = (ack: number): string => {
  switch (ack) {
    case 0:
      return "pending";
    case 1:
      return "sent";
    case 2:
      return "delivered";
    case 3:
      return "read";
    default:
      return "pending";
  }
};

const cleanupDuplicateMessages = async (duplicateMessages: Message[]): Promise<void> => {
  try {
    const duplicateIds = duplicateMessages.map(m => m.id);
    
    // Remover mensagens duplicadas
    await Message.destroy({
      where: {
        id: {
          [Op.in]: duplicateIds,
        },
      },
    });

    logger.info(`[HandleMsgAck] Cleaned up ${duplicateIds.length} duplicate messages`);
  } catch (err) {
    logger.error(`[HandleMsgAck] Error in cleanup: ${err}`);
  }
};

export default HandleMsgAck;
