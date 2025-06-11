import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import socketEmit from "../../helpers/socketEmit";
import { logger } from "../../utils/logger";

interface MessageData {
  id?: string;
  messageId: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  timestamp?: number;
}
interface Request {
  messageData: MessageData;
  tenantId: string | number;
}

const CreateMessageService = async ({
  messageData,
  tenantId
}: Request): Promise<Message> => {
  try {

    
    const msg = await Message.findOne({
      where: { messageId: messageData.messageId, tenantId }
    });
    
    if (!msg) {
      await Message.create({ ...messageData, tenantId });
    } else {
      await msg.update(messageData);
    }
    

    const message = await Message.findOne({
      where: { messageId: messageData.messageId, tenantId },
      include: [
        {
          model: Ticket,
          as: "ticket",
          where: { tenantId },
          include: ["contact"]
        },
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (!message) {
      logger.error(`[CreateMessageService] ERR_CREATING_MESSAGE: Could not find message after creation/update for messageId: ${messageData.messageId}, tenantId: ${tenantId}`);
      throw new Error("ERR_CREATING_MESSAGE");
    }
    


    socketEmit({
      tenantId,
      type: "chat:create",
      payload: message
    });
    


    return message;
  } catch (err) {
    logger.error(`[CreateMessageService] Error creating message for messageId: ${messageData.messageId}, ticketId: ${messageData.ticketId}: ${err}`);
    logger.error(`[CreateMessageService] Error stack: ${err.stack}`);
    throw err;
  }
};

export default CreateMessageService;
