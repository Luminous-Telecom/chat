// import { WbotMessage } from "../../../types/wbot";
import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import Message from "../../../models/Message";
import CreateMessageService from "../../MessageServices/CreateMessageService";
import VerifyQuotedMessage from "./VerifyQuotedMessage";
import { logger } from "../../../utils/logger";
import socketEmit from "../../../helpers/socketEmit";

const VerifyMessage = async (
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
) => {
  try {
    // FILTRO FINAL PARA REAÇÕES: Verificar se é uma reação antes de processar
    const ignoredTypes = [
      'reactionMessage',
      'messageContextInfo',
      'senderKeyDistributionMessage',
      'pollCreationMessage',
      'pollUpdateMessage',
      'reaction'
    ];
    
    if (ignoredTypes.includes(msg.type)) {
      logger.debug(`[VerifyMessage] Ignored message type: ${msg.type} for ticket ${ticket.id}`);
      return;
    }
    
    // Verificar se é apenas emoji (possível reação)
    if (msg.body && typeof msg.body === 'string' && !msg.fromMe) {
      const isOnlyEmoji = /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]+$/u.test(msg.body.trim());
      
      if (isOnlyEmoji && msg.type === 'chat') {
        logger.debug(`[VerifyMessage] Possible reaction (emoji only) ignored for ticket ${ticket.id}: ${msg.body}`);
        return;
      }
    }

    // Verificar se há mensagem citada e obter referência
    const quotedMsg = await VerifyQuotedMessage(msg, ticket);

    if (quotedMsg) {
    } else {
    }

    const messageData = {
      messageId: msg.id.id,
      ticketId: ticket.id,
      contactId: msg.fromMe ? undefined : contact.id,
      body: msg.body,
      fromMe: msg.fromMe,
      mediaType: msg.type,
      read: msg.fromMe,
      quotedMsgId: quotedMsg?.id,
      timestamp: msg.timestamp,
      status: "received",
      dataPayload: msg.dataPayload,
    };

    // CORREÇÃO: Não recalcular unreadMessages aqui pois já foi definido corretamente 
    // pelo FindOrCreateTicketService baseado no chat.unreadCount
    await ticket.update({
      lastMessage: msg.body,
      lastMessageAt: new Date().getTime(),
      lastMessageAck: msg.fromMe ? 1 : 0, // Se enviado por nós, ACK inicial é 1 (enviado)
      lastMessageFromMe: msg.fromMe,
      answered: msg.fromMe || false,
    });

    // CORREÇÃO: Recarregar ticket atualizado para garantir dados corretos
    await ticket.reload();

    // NOVO: Emitir evento de atualização do ticket para mudança instantânea da cor
    socketEmit({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticket,
    });

    const createdMessage = await CreateMessageService({
      messageData,
      tenantId: ticket.tenantId,
    });
    return createdMessage;
  } catch (err) {
    logger.error(
      `[VerifyMessage] Erro em VerifyMessage para ticket ${ticket.id}: ${err}`
    );
    logger.error(`[VerifyMessage] Stack de erro: ${err.stack}`);
    throw err;
  }
};

export default VerifyMessage;
