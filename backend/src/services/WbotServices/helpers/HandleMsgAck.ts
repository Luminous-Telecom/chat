// Não é necessário importar WbotMessage, pois é global
// Definir o tipo MessageAck localmente

type MessageAck = number; // ou defina conforme necessário para o seu uso

// import { WbotMessage } from '../../../types/baileys';
// import { MessageAck } from "whatsapp-web.js";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import { logger } from "../../../utils/logger";
import CampaignContacts from "../../../models/CampaignContacts";
import ApiMessage from "../../../models/ApiMessage";
import socketEmit from "../../../helpers/socketEmit";
import Queue from "../../../libs/Queue";
import { Op } from "sequelize";
import Contact from "../../../models/Contact";
import { getIO } from "../../../libs/socket";
import { WAMessage } from "@whiskeysockets/baileys";

// Helper function to get message status from ack
const getMessageStatus = (ack: number): string => {
  switch (ack) {
    case 3:
      return "received";
    case 2:
      return "delivered";
    default:
      return "sended";
  }
};

export const HandleMsgAck = async (msg: WAMessage, ack: number): Promise<void> => {
  try {
    const messageId = msg.key?.id;
    if (!messageId) {
      return;
    }

    const message = await Message.findOne({
      where: {
        messageId: {
          [Op.or]: [
            messageId,
            messageId.split('_')[0],
            messageId.split(':')[0],
            messageId.replace(/[^A-Z0-9]/g, ''),
            { [Op.like]: `%${messageId}%` }
          ]
        }
      },
      include: [
        {
          model: Ticket,
          include: [{ model: Contact }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (message) {
      const newStatus = getMessageStatus(ack);
      await message.update({ ack, status: newStatus });

      // Emitir evento no canal correto com o id da mensagem e informações do ticket
      const io = getIO();
      io.to(message.ticket.tenantId.toString()).emit(`${message.ticket.tenantId}:ticketList`, {
        type: "chat:ack",
        payload: {
          id: message.id,
          messageId: message.messageId,
          ack,
          status: newStatus,
          read: ack >= 3, // Mensagem é considerada lida quando ack >= 3
          fromMe: message.fromMe,
          ticket: {
            id: message.ticket.id,
            status: message.ticket.status,
            unreadMessages: message.ticket.unreadMessages,
            answered: message.ticket.answered
          }
        }
      });
    } else {
      
      // Tenta buscar por ID direto
      const messageByPk = await Message.findByPk(messageId);
      if (messageByPk) {

        return await HandleMsgAck({
          ...msg,
          key: {
            ...msg.key,
            id: messageByPk.messageId
          }
        }, ack);
      }

      // Se ainda não encontrou, tenta buscar mensagens recentes do mesmo ticket
      if (msg.key.remoteJid) {
        const recentMessages = await Message.findAll({
          where: {
            createdAt: {
              [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // últimas 24h
            }
          },
          include: [
            {
              model: Ticket,
              as: "ticket",
              include: [
                {
                  model: Contact,
                  as: "contact",
                  where: {
                    number: msg.key.remoteJid.split('@')[0]
                  }
                }
              ]
            }
          ],
          order: [['createdAt', 'DESC']],
          limit: 10
        });

        if (recentMessages.length > 0) {
          const similarMessage = recentMessages.find(m => {
            if (!m.messageId) return false;
            return m.messageId.includes(messageId) || messageId.includes(m.messageId);
          });

          if (similarMessage) {
            return await HandleMsgAck({
              ...msg,
              key: {
                ...msg.key,
                id: similarMessage.messageId
              }
            }, ack);
          }
        }
      }
    }
  } catch (err) {
    logger.error(`Erro ao processar ACK para mensagem ${msg.key?.id || 'unknown'}: ${err}`);
  }
};

export default HandleMsgAck;
