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
const isValidAck = (ack: number, mediaType?: string): boolean => {
  // ACK 5 é válido apenas para mensagens de áudio (quando o áudio foi ouvido/reproduzido)
  if (ack === 5) {
    return mediaType === 'audio';
  }
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
    case 5:
      return "played"; // ACK 5 = áudio foi ouvido/reproduzido
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
      // Exceção: ACK 5 pode sobrescrever ACK 3 para áudios
      const canUpdateCampaignAck = ack > campaignContact.ack || 
                                  (ack === 5 && campaignContact.ack === 3);
      
      if (!canUpdateCampaignAck) {
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
  
  // Log apenas para ACKs importantes (3, 5) ou debug mode
  if (ack >= 3 || process.env.DEBUG_ACK === 'true') {
    logger.info(`[HandleMsgAck] Processando ACK ${ack} para messageId: ${messageId}`);
  }
  
  // Para ACK 5, precisamos verificar se é uma mensagem de áudio
  let mediaType: string | undefined;
  if (ack === 5) {
    try {
      const audioMessage = await Message.findOne({
        where: {
          [Op.or]: [{ messageId }, { id: messageId }],
        },
        attributes: ['mediaType'],
      });
      mediaType = audioMessage?.mediaType;
      if (process.env.DEBUG_ACK === 'true') {
        logger.info(`[HandleMsgAck] MediaType encontrado para ACK 5: ${mediaType}`);
      }
    } catch (error) {
      logger.error(`[HandleMsgAck] Erro ao buscar mediaType: ${error}`);
    }
  }
  
  // CRÍTICO: Validar ACK antes de processar
  if (!isValidAck(ack, mediaType)) {
    if (ack === 5) {
      // Log de debug apenas, não error - é comportamento normal do WhatsApp
      logger.debug(`[HandleMsgAck] ACK 5 ignorado para messageId ${messageId} (mediaType: ${mediaType || 'undefined'}) - não é áudio`);
    } else if (ack > 3) {
      // Log apenas para ACKs realmente inválidos
      logger.warn(`[HandleMsgAck] ACK inválido ${ack} ignorado para messageId: ${messageId}`);
    }
    return;
  }
  
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
    // Buscar mensagens com estratégia otimizada
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { messageId: messageId },
          { messageId: messageId?.toString() },
          { id: messageId }
        ],
        fromMe: true, // Apenas mensagens enviadas por nós podem ter ACK
        isDeleted: false, // Não processar mensagens deletadas
      },
      order: [["createdAt", "DESC"]],
      limit: 3, // Limitar para evitar consultas muito grandes
      transaction: messageTransaction,
    });

    if (messages.length === 0) {
      // Log apenas para ACKs importantes ou modo debug
      if (ack >= 3 || process.env.DEBUG_ACK === 'true') {
        logger.debug(`[HandleMsgAck] Nenhuma mensagem encontrada para messageId: ${messageId} (ACK ${ack})`);
      }
      await messageTransaction.rollback();
      return;
    }

    let messageToUpdate: Message | null = null;
    let duplicateMessages: Message[] = [];

    if (messages.length === 1) {
      // Se só temos uma mensagem, ela é a que devemos atualizar
      messageToUpdate = messages[0];
      if (process.env.DEBUG_ACK === 'true') {
        logger.info(`[HandleMsgAck] Mensagem única encontrada: ${messageToUpdate.id} (${messageToUpdate.mediaType})`);
      }
    } else {
      // Se temos múltiplas mensagens, vamos analisar cada uma
      // Primeiro, vamos verificar se alguma mensagem já tem um ACK maior
      // Exceção: ACK 5 pode ser aplicado mesmo se já existe ACK 3 para áudios
      const messagesWithHigherAck = messages.filter(m => {
        if (ack === 5 && m.ack === 3 && m.mediaType === 'audio') {
          return false; // Permite ACK 5 sobrescrever ACK 3 para áudios
        }
        return m.ack >= ack;
      });
      
      if (messagesWithHigherAck.length > 0) {
        if (process.env.DEBUG_ACK === 'true') {
          logger.debug(`[HandleMsgAck] ACK ${ack} ignorado - mensagem já tem ACK maior ou igual`);
        }
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
      if (process.env.DEBUG_ACK === 'true' || duplicateMessages.length > 0) {
        logger.info(`[HandleMsgAck] ${messages.length} mensagens encontradas, atualizando: ${messageToUpdate?.id}`);
      }
    }

    if (!messageToUpdate) {
      logger.error(
        `[HandleMsgAck] Could not determine which message to update for ID ${messageId}`
      );
      await messageTransaction.rollback();
      return;
    }

    // Não permitir que um ACK menor sobrescreva um ACK maior
    // Exceção: ACK 5 pode sobrescrever ACK 3 para áudios (3=visualizado, 5=ouvido)
    const canUpdateAck = ack > messageToUpdate.ack || 
                        (ack === 5 && messageToUpdate.ack === 3 && messageToUpdate.mediaType === 'audio');
    
    if (!canUpdateAck) {
      if (process.env.DEBUG_ACK === 'true') {
        logger.debug(`[HandleMsgAck] ACK ${ack} ignorado - mensagem ${messageToUpdate.id} já tem ACK ${messageToUpdate.ack}`);
      }
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
    
    // Log apenas para ACKs importantes ou modo debug
    if (ack === 5) {
      logger.info(`[HandleMsgAck] 🔊 ÁUDIO OUVIDO: Atualizando mensagem ${messageToUpdate.id} (${messageToUpdate.mediaType}) de ACK ${messageToUpdate.ack} para ${ack} (${newStatus})`);
    } else if (ack >= 3 || process.env.DEBUG_ACK === 'true') {
      logger.info(`[HandleMsgAck] Atualizando mensagem ${messageToUpdate.id} (${messageToUpdate.mediaType}) de ACK ${messageToUpdate.ack} para ${ack} (${newStatus})`);
    }
    
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
        played: ack === 5, // ADICIONADO: indicar se áudio foi ouvido
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
    
    // Log apenas para ACKs importantes ou modo debug
    if (ack >= 3 || process.env.DEBUG_ACK === 'true') {
      logger.info(`[HandleMsgAck] Emitindo evento socket para ${messageToUpdate.mediaType} com ACK ${ack}`);
    }
    
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
    
    // Log de sucesso apenas para ACKs importantes ou modo debug
    if (ack >= 3 || process.env.DEBUG_ACK === 'true') {
      logger.info(`[HandleMsgAck] ✅ ACK ${ack} processado com sucesso para mensagem ${messageToUpdate.id}`);
    }
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