// Não é necessário importar WbotMessage, pois é global
// Definir o tipo MessageAck localmente

// ou defina conforme necessário para o seu uso

// import { WbotMessage } from '../../../types/baileys';
// import { MessageAck } from "whatsapp-web.js";
import { WAMessage } from "@whiskeysockets/baileys";
import { Op, Sequelize, Transaction } from "sequelize";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import { getIO } from "../../../libs/socket";
import sequelize from "../../../database";
import { logger } from "../../../utils/logger";
import CampaignContacts from "../../../models/CampaignContacts";
import Campaign from "../../../models/Campaign";
import ApiMessage from "../../../models/ApiMessage";
import socketEmit from "../../../helpers/socketEmit";
import Queue from "../../../libs/Queue";

type MessageAck = number;

interface MessageUpdate {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  // outros campos da mensagem
}

// Helper function to validate ACK values
const isValidAck = (ack: number): boolean => {
  return ack >= 0 && ack <= 3;
};

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

// Helper function to update campaign contact ACK
const updateCampaignContactAck = async (
  messageId: string,
  ack: number,
  transaction?: any
): Promise<void> => {
  try {
    
    // Primeiro, verificar se existem contatos de campanha no geral
    const totalCampaignContacts = await CampaignContacts.count({ transaction });
    
    // Verificar se existem contatos com messageId preenchido
    const contactsWithMessageId = await CampaignContacts.count({
      transaction
    });
    
    // Forçar refresh do cache do Sequelize para esta consulta
    await sequelize.query('SELECT 1', { transaction, type: 'SELECT' });
    
    const campaignContact = await CampaignContacts.findOne({
      where: { messageId },
      include: [
        {
          model: Campaign,
          as: "campaign"
        },
        {
          model: Contact,
          as: "contact"
        }
      ],
      transaction
    });

    if (campaignContact) {
      // FORÇA UM RELOAD FRESCO DO BANCO para garantir dados atualizados
      await campaignContact.reload({ transaction });
      
      // Verificar se este messageId é realmente da mensagem atual do contato
      const isCurrentMessage = campaignContact.messageId === messageId;
      
      if (!isCurrentMessage) {
        
        // Se o ACK é maior que o atual, processar mesmo sendo de mensagem anterior
        if (ack > campaignContact.ack) {
        } else {
          return;
        }
      }
      
      // Não permitir que um ACK menor sobrescreva um ACK maior
      if (ack <= campaignContact.ack) {
        return;
      }

      await campaignContact.update({ ack }, { transaction });
      
      // Recarregar para confirmar a atualização
      await campaignContact.reload({ transaction });

      // Emitir evento para o frontend (agora sempre porque temos apenas um registro por contato)
      const io = getIO();
      const tenantId = campaignContact.campaign?.tenantId || 1;
      const eventData = {
        type: "campaign:ack",
        payload: {
          campaignId: campaignContact.campaignId,
          contactId: campaignContact.contactId,
          messageId,
          messageRandom: campaignContact.messageRandom,
          ack,
          status: getMessageStatus(ack),
          campaignContactId: campaignContact.id,
        },
      };
      
      io.to(tenantId.toString()).emit(`${tenantId}:campaignUpdate`, eventData);

    } else {
      
      // Debug adicional: listar alguns messageIds existentes
      const existingMessageIds = await CampaignContacts.findAll({
        attributes: ['messageId', 'id', 'campaignId'],
        limit: 5,
        transaction,
        raw: true
      });
      

    }
  } catch (error) {
    logger.error(`[HandleMsgAck] Error updating campaign contact ACK for messageId ${messageId}: ${error}`);
    console.error(`[CAMPAIGN ACK] ❌ Full error:`, error);
  }
};

export const HandleMsgAck = async (
  msg: WAMessage,
  ack: number
): Promise<void> => {
  if (!msg?.key?.id) {
    logger.error("[HandleMsgAck] Invalid message format - missing key.id");
    return;
  }

  const messageId = msg.key.id;
  
  // CRÍTICO: Validar ACK antes de processar
  if (!isValidAck(ack)) {
    logger.error(`[HandleMsgAck] ⚠️  ACK INVÁLIDO DETECTADO: ${ack} para messageId: ${messageId}`);
    logger.error(`[HandleMsgAck] ACKs válidos são apenas 0, 1, 2, 3. Ignorando ACK ${ack}`);
    return;
  }

  logger.info(`[HandleMsgAck] Processando ACK ${ack} para messageId: ${messageId}`);
  
  // Primeiro, tentar atualizar campanhas (com transação separada)
  const campaignTransaction = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
  });
  
  try {
    await updateCampaignContactAck(messageId, ack, campaignTransaction);
    await campaignTransaction.commit();
  } catch (campaignError) {
    await campaignTransaction.rollback();
    logger.error(`[HandleMsgAck] Error in campaign transaction: ${campaignError}`);
  }

  // Agora processar mensagens regulares com transação separada
  const messageTransaction = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
  });

  try {
    // Continuar com a lógica original para mensagens regulares
    const messages = await Message.findAll({
      where: {
        [Op.or]: [{ messageId }, { id: messageId }],
      },
      order: [["createdAt", "DESC"]],
      transaction: messageTransaction,
    });

    if (messages.length === 0) {
      logger.info(`[HandleMsgAck] Nenhuma mensagem encontrada para messageId: ${messageId}`);
      await messageTransaction.rollback();
      return;
    }

    let messageToUpdate: Message | null = null;
    let duplicateMessages: Message[] = [];

    if (messages.length === 1) {
      // Se só temos uma mensagem, ela é a que devemos atualizar
      messageToUpdate = messages[0];
      logger.info(`[HandleMsgAck] Mensagem única encontrada: ${messageToUpdate.id} (${messageToUpdate.mediaType})`);
    } else {
      // Se temos múltiplas mensagens, vamos analisar cada uma
      // Primeiro, vamos verificar se alguma mensagem já tem um ACK maior
      const messagesWithHigherAck = messages.filter(m => m.ack >= ack);
      if (messagesWithHigherAck.length > 0) {
        logger.info(`[HandleMsgAck] ACK ${ack} ignorado - mensagem já tem ACK maior ou igual`);
        await messageTransaction.rollback();
        return;
      }

      // Agora vamos verificar qual mensagem devemos atualizar
      // Preferimos a mensagem que:
      // 1. Tem o ACK mais alto (mas menor que o novo ack)
      // 2. Foi criada mais recentemente
      messageToUpdate = messages.reduce((best, current) => {
        if (!best) return current;
        if (current.ack > best.ack) {
          return current;
        }
        if (current.ack === best.ack && current.createdAt > best.createdAt) {
          return current;
        }
        return best;
      }, null as Message | null);

      // Todas as outras mensagens são duplicadas
      duplicateMessages = messages.filter(m => m.id !== messageToUpdate?.id);
      logger.info(`[HandleMsgAck] ${messages.length} mensagens encontradas, atualizando: ${messageToUpdate?.id}`);
    }

    if (!messageToUpdate) {
      logger.error(
        `[HandleMsgAck] Could not determine which message to update for ID ${messageId}`
      );
      await messageTransaction.rollback();
      return;
    }

    // Não permitir que um ACK menor sobrescreva um ACK maior
    if (ack <= messageToUpdate.ack) {
      logger.info(`[HandleMsgAck] ACK ${ack} ignorado - mensagem ${messageToUpdate.id} já tem ACK ${messageToUpdate.ack}`);
      await messageTransaction.rollback();
      return;
    }

    // Busca o ticket e contato em uma segunda query
    const ticket = await Ticket.findOne({
      where: { id: messageToUpdate.ticketId },
      include: [{ model: Contact }],
      transaction: messageTransaction,
    });

    if (!ticket) {
      logger.error(
        `[HandleMsgAck] Ticket not found for message ${messageToUpdate.id}`
      );
      await messageTransaction.rollback();
      return;
    }

    const newStatus = getMessageStatus(ack);
    
    logger.info(`[HandleMsgAck] Atualizando mensagem ${messageToUpdate.id} (${messageToUpdate.mediaType}) de ACK ${messageToUpdate.ack} para ${ack} (${newStatus})`);
    
    // Atualiza a mensagem com lock
    await messageToUpdate.update(
      {
        ack,
        status: newStatus,
      },
      { transaction: messageTransaction }
    );

    // Emitir evento no canal correto
    const io = getIO();
    const socketPayload = {
      type: "chat:ack",
      payload: {
        id: messageToUpdate.id,
        messageId: messageToUpdate.messageId,
        ack,
        status: newStatus,
        read: ack >= 3,
        fromMe: messageToUpdate.fromMe,
        mediaType: messageToUpdate.mediaType, // ADICIONADO: incluir mediaType no payload
        ticket: {
          id: ticket.id,
          status: ticket.status,
          unreadMessages: ticket.unreadMessages,
          answered: ticket.answered,
        },
      },
    };
    
    logger.info(`[HandleMsgAck] Emitindo evento socket para ${messageToUpdate.mediaType} com ACK ${ack}`);
    
    io.to(ticket.tenantId.toString()).emit(`${ticket.tenantId}:ticketList`, socketPayload);

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
        await dup.update({ isDeleted: true }, { transaction: messageTransaction });
      }
    }

    await messageTransaction.commit();
    logger.info(`[HandleMsgAck] ✅ ACK ${ack} processado com sucesso para mensagem ${messageToUpdate.id}`);
  } catch (err) {
    await messageTransaction.rollback();
    logger.error(
      `[HandleMsgAck] Error processing ACK for message ${
        msg.key?.id || "unknown"
      }: ${err}`
    );
  }
};

export default HandleMsgAck;