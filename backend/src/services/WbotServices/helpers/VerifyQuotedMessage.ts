// import { WbotMessage } from '../../../types/baileys';
import Message from "../../../models/Message";
import { logger } from "../../../utils/logger";
import Ticket from "../../../models/Ticket";
import { BaileysMessage } from "../../../types/baileys";

const VerifyQuotedMessage = async (
  msg: BaileysMessage,
  ticket: Ticket
): Promise<Message | null> => {
  try {
    if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      logger.debug(`[VerifyQuotedMessage] No quoted message found in message context`);
      return null;
    }

    // Extrair informações da mensagem citada
    const contextInfo = msg.message.extendedTextMessage.contextInfo;
    const quotedId = contextInfo.stanzaId;
    const quotedParticipant = contextInfo.participant;
    
    logger.info(`[VerifyQuotedMessage] Procurando mensagem citada com ID: ${quotedId}, participante: ${quotedParticipant}`);
    
    // Tentar encontrar a mensagem pelo messageId
    let quotedMsg = await Message.findOne({
      where: { 
        messageId: quotedId ?? null,
        tenantId: ticket.tenantId
      },
      include: [
        {
          model: Ticket,
          as: "ticket",
          where: { tenantId: ticket.tenantId }
        }
      ]
    });

    // Se não encontrar pelo messageId, tentar pelo id
    if (!quotedMsg && quotedId) {
      logger.info(`[VerifyQuotedMessage] Tentando encontrar mensagem pelo ID direto: ${quotedId}`);
      quotedMsg = await Message.findOne({
        where: { 
          id: quotedId,
          tenantId: ticket.tenantId
        },
        include: [
          {
            model: Ticket,
            as: "ticket",
            where: { tenantId: ticket.tenantId }
          }
        ]
      });
    }

    // Verificar se encontrou a mensagem
    if (!quotedMsg) {
      logger.warn(`[VerifyQuotedMessage] Mensagem citada não encontrada para ID: ${quotedId}`);
      return null;
    }

    logger.info(`[VerifyQuotedMessage] Mensagem citada encontrada: ${quotedMsg.id}, messageId: ${quotedMsg.messageId}`);
    return quotedMsg;
  } catch (error) {
    logger.error(`[VerifyQuotedMessage] Erro ao verificar mensagem citada: ${error}`);
    return null;
  }
};

export default VerifyQuotedMessage;
