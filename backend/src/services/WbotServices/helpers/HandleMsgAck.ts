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
import MarkMessageAsReadService from "../../MessageServices/MarkMessageAsReadService";

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
    // Primeiro tentar buscar mensagens enviadas por nós (comportamento original)
    let messages = await Message.findAll({
      where: {
        [Op.or]: [
          { messageId: messageId },
          { messageId: messageId?.toString() },
          { id: messageId }
        ],
        fromMe: true, // Mensagens enviadas por nós
        isDeleted: false,
      },
      order: [["createdAt", "DESC"]],
      limit: 3,
      transaction: messageTransaction,
    });

    // 🔥 NOVA LÓGICA: Se não encontrou mensagens enviadas E o ACK >= 3, 
    // buscar mensagens recebidas (para marcar como lidas quando lemos no WhatsApp)
    if (messages.length === 0 && ack >= 3) {
      messages = await Message.findAll({
        where: {
          [Op.or]: [
            { messageId: messageId },
            { messageId: messageId?.toString() },
            { id: messageId }
          ],
          fromMe: false, // Mensagens recebidas
          ack: { [Op.lt]: 3 }, // Que ainda não foram marcadas como lidas
          isDeleted: false,
        },
        order: [["createdAt", "DESC"]],
        limit: 3,
        transaction: messageTransaction,
      });
      
      if (messages.length > 0) {
        logger.info(`[HandleMsgAck] 📱 LEITURA NO WHATSAPP: Encontradas ${messages.length} mensagens recebidas para marcar como lidas (ACK ${ack})`);
      }
    }

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

    // Lógica de validação de ACK diferente para mensagens enviadas vs recebidas
    let canUpdateAck = false;
    
    if (messageToUpdate.fromMe) {
      // Mensagens ENVIADAS: ACK não pode regredir, exceto ACK 5 para áudios
      canUpdateAck = ack > messageToUpdate.ack || 
                    (ack === 5 && messageToUpdate.ack === 3 && messageToUpdate.mediaType === 'audio');
    } else {
      // Mensagens RECEBIDAS: ACK 3 sempre pode ser aplicado (lida por nós no WhatsApp)
      // ACK 5 para áudios também é permitido
      canUpdateAck = (ack === 3 && messageToUpdate.ack < 3) ||
                    (ack === 5 && messageToUpdate.mediaType === 'audio') ||
                    (ack > messageToUpdate.ack);
    }
    
    if (!canUpdateAck) {
      if (process.env.DEBUG_ACK === 'true') {
        logger.debug(`[HandleMsgAck] ACK ${ack} ignorado - mensagem ${messageToUpdate.id} (fromMe: ${messageToUpdate.fromMe}) já tem ACK ${messageToUpdate.ack}`);
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
    
    // Log diferenciado para mensagens enviadas vs recebidas
    if (ack === 5) {
      logger.info(`[HandleMsgAck] 🔊 ÁUDIO OUVIDO: Atualizando mensagem ${messageToUpdate.id} (${messageToUpdate.mediaType}, fromMe: ${messageToUpdate.fromMe}) de ACK ${messageToUpdate.ack} para ${ack} (${newStatus})`);
    } else if (ack >= 3 || process.env.DEBUG_ACK === 'true') {
      const messageType = messageToUpdate.fromMe ? "ENVIADA" : "RECEBIDA";
      const ackMeaning = messageToUpdate.fromMe ? "lida pelo destinatário" : "lida por nós no WhatsApp";
      logger.info(`[HandleMsgAck] ${messageType}: Atualizando mensagem ${messageToUpdate.id} de ACK ${messageToUpdate.ack} para ${ack} (${ackMeaning})`);
    }
    
    // Preparar dados para atualização da mensagem
    const messageUpdateData: any = {
      ack,
      status: newStatus,
    };

    // 🔥 NOVA FUNCIONALIDADE: Marcar como visualizada quando lida no WhatsApp
    const wasNotRead = messageToUpdate.ack < 3;
    const isNowRead = ack >= 3;
    
    // Atualiza a mensagem primeiro
    await messageToUpdate.update(messageUpdateData, { transaction: messageTransaction });

    // Se a mensagem agora foi lida no WhatsApp, marcar como visualizada no sistema
    if (wasNotRead && isNowRead && !messageToUpdate.fromMe) {
      try {
        await MarkMessageAsReadService({
          message: messageToUpdate,
          ticket,
          ack,
          transaction: messageTransaction,
          source: "whatsapp_ack"
        });
      } catch (markReadError) {
        logger.error(`[HandleMsgAck] Error marking message as read via service: ${markReadError}`);
        // Continua o processamento mesmo se falhar a marcação como lida
      }
    }

    // Recarregar ticket para obter dados atualizados após possíveis mudanças
    await ticket.reload({ transaction: messageTransaction });

    // Emitir eventos no canal correto
    const io = getIO();
    const isAutoMarkedAsRead = wasNotRead && isNowRead && !messageToUpdate.fromMe;
    
    // Evento principal de ACK
    const socketPayload = {
      type: "chat:ack",
      payload: {
        id: messageToUpdate.id,
        messageId: messageToUpdate.messageId,
        ack,
        status: newStatus,
        read: isAutoMarkedAsRead ? true : (ack >= 3),
        played: ack === 5, // ADICIONADO: indicar se áudio foi ouvido
        fromMe: messageToUpdate.fromMe,
        mediaType: messageToUpdate.mediaType, // ADICIONADO: incluir mediaType no payload
        wasMarkedAsRead: isAutoMarkedAsRead, // 🔥 NOVO: indicar se foi marcada como lida automaticamente
        automatic: isAutoMarkedAsRead, // 🔥 NOVO: mesma info com nome mais claro
        timestamp: new Date().toISOString(),
        ticket: {
          id: ticket.id,
          status: ticket.status,
          unreadMessages: ticket.unreadMessages, // Dados atualizados após reload
          answered: ticket.answered, // Dados atualizados após reload
        },
      },
    };
    
    io.to(ticket.tenantId.toString()).emit(`${ticket.tenantId}:ticketList`, socketPayload);
    
    // 🔥 EVENTO ADICIONAL: Se foi marcada como lida automaticamente, emitir evento específico
    if (isAutoMarkedAsRead) {
      io.to(ticket.tenantId.toString()).emit(`${ticket.tenantId}:messageAutoRead`, {
        type: "message:auto-read",
        payload: {
          messageId: messageToUpdate.id,
          ticketId: ticket.id,
          contactId: ticket.contactId,
          contactName: ticket.contact?.name || "Contato",
          ack,
          source: "whatsapp_business",
          timestamp: new Date().toISOString(),
          ticket: {
            id: ticket.id,
            unreadMessages: ticket.unreadMessages,
            answered: ticket.answered,
          },
        },
      });
      
      logger.info(`[HandleMsgAck] 📱 AUTO-READ: Emitido evento messageAutoRead para mensagem ${messageToUpdate.id}`);
    }
    
    // Log apenas para ACKs importantes ou modo debug
    if (ack >= 3 || process.env.DEBUG_ACK === 'true') {
      logger.info(`[HandleMsgAck] 📡 EVENTOS EMITIDOS: ticketList${isAutoMarkedAsRead ? ' + messageAutoRead' : ''} para ${messageToUpdate.mediaType} com ACK ${ack}`);
    }

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