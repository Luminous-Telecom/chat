// import { WbotMessage } from "../../../types/wbot";
import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import CreateMessageService from "../../MessageServices/CreateMessageService";
import VerifyQuotedMessage from "./VerifyQuotedMessage";
import { logger } from "../../../utils/logger";

const VerifyMessage = async (
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
) => {
  try {

    
    const quotedMsg = await VerifyQuotedMessage(msg);


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
    


    await ticket.update({
      lastMessage: msg.body,
      lastMessageAt: new Date().getTime(),
      answered: msg.fromMe || false
    });

    
    const createdMessage = await CreateMessageService({ messageData, tenantId: ticket.tenantId });

    
    return createdMessage;
  } catch (err) {
    logger.error(`[VerifyMessage] Error in VerifyMessage for ticket ${ticket.id}: ${err}`);
    logger.error(`[VerifyMessage] Error stack: ${err.stack}`);
    throw err;
  }
};

export default VerifyMessage;
