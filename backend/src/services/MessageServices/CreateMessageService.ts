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
  quotedMsgId?: string;
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
    logger.info(`[CreateMessageService] Criando/atualizando mensagem: ${messageData.messageId}, ticketId: ${messageData.ticketId}`);
    
    // Verificar se a mensagem já existe
    const msg = await Message.findOne({
      where: { messageId: messageData.messageId, tenantId }
    });
    
    // Log para depuração da mensagem citada
    if (messageData.quotedMsgId) {
      logger.info(`[CreateMessageService] Mensagem com citação. QuotedMsgId: ${messageData.quotedMsgId}`);
      
      // Verificar se a mensagem citada existe
      const quotedMsg = await Message.findByPk(messageData.quotedMsgId);
      if (quotedMsg) {
        logger.info(`[CreateMessageService] Mensagem citada encontrada: ${quotedMsg.id}`);
      } else {
        logger.warn(`[CreateMessageService] Mensagem citada não encontrada: ${messageData.quotedMsgId}`);
      }
    }
    
    // Criar ou atualizar a mensagem
    if (!msg) {
      logger.info(`[CreateMessageService] Criando nova mensagem: ${messageData.messageId}`);
      await Message.create({ ...messageData, tenantId });
    } else {
      logger.info(`[CreateMessageService] Atualizando mensagem existente: ${messageData.messageId}`);
      await msg.update(messageData);
    }
    
    // Buscar a mensagem completa com relacionamentos
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
          required: false, // LEFT JOIN - não é obrigatório
          include: [
            {
              model: require("../../models/Contact").default,
              as: "contact",
              attributes: ["id", "name", "number", "profilePicUrl"]
            }
          ]
        }
      ]
    });

    if (!message) {
      logger.error(`[CreateMessageService] ERR_CREATING_MESSAGE: Não foi possível encontrar a mensagem após criação/atualização para messageId: ${messageData.messageId}, tenantId: ${tenantId}`);
      throw new Error("ERR_CREATING_MESSAGE");
    }
    
    // Verificar se a mensagem citada foi carregada corretamente
    if (messageData.quotedMsgId && message.quotedMsg) {
      logger.info(`[CreateMessageService] Relação com mensagem citada estabelecida com sucesso: ${message.quotedMsg.id}`);
    } else if (messageData.quotedMsgId) {
      logger.warn(`[CreateMessageService] Relação com mensagem citada não foi estabelecida para: ${messageData.quotedMsgId}`);
    }

    // Emitir evento via socket
    socketEmit({
      tenantId,
      type: "chat:create",
      payload: message
    });
    
    logger.info(`[CreateMessageService] Mensagem criada/atualizada com sucesso: ${message.id}`);
    return message;
  } catch (err) {
    logger.error(`[CreateMessageService] Erro ao criar mensagem para messageId: ${messageData.messageId}, ticketId: ${messageData.ticketId}: ${err}`);
    logger.error(`[CreateMessageService] Stack de erro: ${err.stack}`);
    throw err;
  }
};

export default CreateMessageService;
