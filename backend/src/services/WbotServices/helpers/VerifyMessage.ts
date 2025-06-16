// import { WbotMessage } from "../../../types/wbot";
import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import Message from "../../../models/Message";
import CreateMessageService from "../../MessageServices/CreateMessageService";
import VerifyQuotedMessage from "./VerifyQuotedMessage";
import { logger } from "../../../utils/logger";

const VerifyMessage = async (
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
) => {
  try {
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
      status: "received"
    };
    
    logger.debug(`[VerifyMessage] Dados da mensagem: ${JSON.stringify({
      messageId: messageData.messageId,
      ticketId: messageData.ticketId,
      fromMe: messageData.fromMe,
      quotedMsgId: messageData.quotedMsgId
    })}`);

    // Calcular contador de mensagens não lidas
    const currentUnread = await Message.count({
      where: { ticketId: ticket.id, read: false, fromMe: false }
    });
    
    // Incrementar contador se mensagem não for própria
    const newUnreadCount = msg.fromMe ? currentUnread : currentUnread + 1;
    
    await ticket.update({
      lastMessage: msg.body,
      lastMessageAt: new Date().getTime(),
      answered: msg.fromMe || false,
      unreadMessages: newUnreadCount
    });

    const createdMessage = await CreateMessageService({ messageData, tenantId: ticket.tenantId });    
    return createdMessage;
  } catch (err) {
    logger.error(`[VerifyMessage] Erro em VerifyMessage para ticket ${ticket.id}: ${err}`);
    logger.error(`[VerifyMessage] Stack de erro: ${err.stack}`);
    throw err;
  }
};

export default VerifyMessage;
