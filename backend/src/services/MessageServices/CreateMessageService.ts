import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import socketEmit from "../../helpers/socketEmit";
import { logger } from "../../utils/logger";
import PushController from '../../controllers/PushController';
import webpush from 'web-push';

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
  dataPayload?: any;
}
interface Request {
  messageData: MessageData;
  tenantId: string | number;
}

const CreateMessageService = async ({
  messageData,
  tenantId,
}: Request): Promise<Message> => {
  try {
    // Verificar se a mensagem já existe
    const msg = await Message.findOne({
      where: { messageId: messageData.messageId, tenantId },
    });

    // Log para depuração da mensagem citada
    if (messageData.quotedMsgId) {

      // Verificar se a mensagem citada existe
      const quotedMsg = await Message.findByPk(messageData.quotedMsgId);
      if (quotedMsg) {
      } else {
      }
    }

    // Criar ou atualizar a mensagem
    if (!msg) {
      await Message.create({ ...messageData, tenantId: Number(tenantId) } as any);
    } else {
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
          include: ["contact"],
        },
        {
          model: Message,
          as: "quotedMsg",
          required: false, // LEFT JOIN - não é obrigatório
          include: [
            {
              model: require("../../models/Contact").default,
              as: "contact",
              attributes: ["id", "name", "number", "profilePicUrl"],
            },
          ],
        },
        {
          model: require("../../models/User").default,
          as: "user",
          attributes: ["id", "name", "email"]
        }
      ],
    });

    if (!message) {
      logger.error(
        `[CreateMessageService] ERR_CREATING_MESSAGE: Não foi possível encontrar a mensagem após criação/atualização para messageId: ${messageData.messageId}, tenantId: ${tenantId}`
      );
      throw new Error("ERR_CREATING_MESSAGE");
    }

    // Verificar se a mensagem citada foi carregada corretamente
    if (messageData.quotedMsgId && message.quotedMsg) {
    } else if (messageData.quotedMsgId) {
    }

    // Emitir evento via socket
    socketEmit({
      tenantId,
      type: "chat:create",
      payload: message,
    });

    // Enviar push notification se a mensagem não for do próprio usuário
    if (message && message.fromMe === false) {
      const subscriptions = PushController.getSubscriptions();
      const payload = JSON.stringify({
        title: `Mensagem de ${message.ticket?.contact?.name || 'Contato'}`,
        body: message.body || 'Nova mensagem recebida',
        icon: message.ticket?.contact?.profilePicUrl || '/icons/icon-128x128.png',
        data: { url: `/atendimento/${message.ticket?.id || ''}` }
      });
      
      let successCount = 0;
      
      // Função local para verificar se é erro de subscription inválida
      const isInvalidSubscriptionError = (err: any): boolean => {
        return err.statusCode === 410 || 
               err.statusCode === 404 || 
               err.message?.includes('invalid') ||
               err.message?.includes('expired') ||
               err.message?.includes('unregistered') ||
               err.message?.includes('gone')
      }
      
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(sub, payload);
          successCount++;
        } catch (err) {
          // Usar função para verificar se é subscription inválida
          if (isInvalidSubscriptionError(err)) {
            // Subscription inválida - log como warning
            logger.warn(`[PushNotification] Subscription inválida detectada: ${err.message}`);
          } else {
            // Erro real - logar como erro
            logger.error('[PushNotification] Erro crítico ao enviar push:', err.message);
          }
        }
      }
      
      // Log de resumo apenas se necessário
      if (successCount === 0 && subscriptions.length > 0) {
        logger.error('[PushNotification] Falha total no envio de push notifications');
      } else if (successCount > 0) {
        logger.info(`[PushNotification] Push enviado com sucesso para ${successCount}/${subscriptions.length} dispositivos`);
      }
    }

    return message;
  } catch (err) {
    logger.error(
      `[CreateMessageService] Erro ao criar mensagem para messageId: ${messageData.messageId}, ticketId: ${messageData.ticketId}: ${err}`
    );
    logger.error(`[CreateMessageService] Stack de erro: ${err.stack}`);
    throw err;
  }
};

export default CreateMessageService;
