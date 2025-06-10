import Queue from 'bull';
import { logger } from '../../utils/logger';
import AppError from '../../errors/AppError';
import { MessageErrors, WhatsAppErrors } from '../../utils/errorHandler';
import { getIO } from '../../libs/socket';
import Message from '../../models/Message';
import Ticket from '../../models/Ticket';
import Contact from '../../models/Contact';
import Whatsapp from '../../models/Whatsapp';
import { getBaileys } from '../../libs/baileys';
import SendBaileysMessage from '../BaileysServices/SendBaileysMessage';
import SendBaileysInteractiveMessage from '../BaileysServices/SendBaileysInteractiveMessage';
import SendBaileysTemplateMessage from '../BaileysServices/SendBaileysTemplateMessage';
import SendBaileysReaction from '../BaileysServices/SendBaileysReaction';

// Configuração da fila
const messageQueue = new Queue('message-queue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

// Tipos de mensagem
type MessageType = 'text' | 'interactive' | 'template' | 'reaction';

interface MessageJob {
  type: MessageType;
  data: {
    ticketId: number;
    body?: string;
    messageId?: string;
    reaction?: string;
    buttons?: any[];
    list?: any;
    templateName?: string;
    languageCode?: string;
    components?: any[];
    mediaUrl?: string;
    mediaType?: string;
    mediaName?: string;
    quotedMsg?: Message;
    userId?: number | string;
  };
}

// Processador de jobs
messageQueue.process(async (job: Queue.Job<MessageJob>) => {
  const { type, data } = job.data;
  const { ticketId } = data;
  let ticket: Ticket | null = null;

  try {
    // Buscar ticket
    ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    if (!ticket) {
      throw MessageErrors.ticketNotFound(ticketId);
    }

    // Verificar conexão
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw WhatsAppErrors.sessionNotFound(`WhatsApp session not found for ticket ${ticketId}`);
    }

    // Processar mensagem baseado no tipo
    let message: Message;
    switch (type) {
      case 'text':
        message = await SendBaileysMessage({
          ticket,
          body: data.body!,
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType,
          mediaName: data.mediaName,
          quotedMsg: data.quotedMsg,
          userId: data.userId
        });
        break;

      case 'interactive':
        message = await SendBaileysInteractiveMessage({
          ticket,
          body: data.body!,
          buttons: data.buttons,
          list: data.list,
          userId: data.userId
        });
        break;

      case 'template':
        message = await SendBaileysTemplateMessage({
          ticket,
          templateName: data.templateName!,
          languageCode: data.languageCode!,
          components: data.components,
          userId: data.userId
        });
        break;

      case 'reaction':
        message = await SendBaileysReaction({
          ticket,
          messageId: data.messageId!,
          reaction: data.reaction!,
          userId: data.userId
        });
        break;

      default:
        throw MessageErrors.invalidType(`Invalid message type: ${type}`);
    }

    // Atualizar status da mensagem
    await message.update({ status: 'sent' });

    // Emitir evento de sucesso
    const io = getIO();
    io.emit(`${ticket.tenantId}:appMessage`, {
      action: "update",
      message,
      ticket,
      contact: ticket.contact
    });

    return message;
  } catch (err) {
    logger.error(`Error processing message queue job: ${err}`);
    
    // Atualizar status da mensagem em caso de erro
    if (job.attemptsMade === job.opts.attempts) {
      const message = await Message.findOne({
        where: { ticketId, status: 'sending' },
        order: [['createdAt', 'DESC']]
      });

      if (message && ticket) {
        await message.update({ status: 'error' });
        
        const io = getIO();
        io.emit(`${ticket.tenantId}:appMessage`, {
          action: "update",
          message,
          ticket,
          contact: ticket.contact
        });
      }
    }

    throw err;
  }
});

// Eventos da fila
messageQueue.on('completed', (job) => {
  logger.info(`Message queue job ${job.id} completed for ticket ${job.data.data.ticketId}`);
});

messageQueue.on('failed', (job, err) => {
  logger.error(`Message queue job ${job?.id} failed for ticket ${job?.data.data.ticketId}: ${err}`);
});

messageQueue.on('stalled', (job) => {
  logger.warn(`Message queue job ${job.id} stalled for ticket ${job.data.data.ticketId}`);
});

// Função para adicionar mensagem à fila
export const addToMessageQueue = async (type: MessageType, data: MessageJob['data']): Promise<void> => {
  try {
    await messageQueue.add({ type, data });
    logger.info(`Message added to queue: ${type} for ticket ${data.ticketId}`);
  } catch (err) {
    logger.error(`Error adding message to queue: ${err}`);
    throw err;
  }
};

// Função para limpar fila
export const clearMessageQueue = async (): Promise<void> => {
  try {
    await messageQueue.empty();
    logger.info('Message queue cleared');
  } catch (err) {
    logger.error(`Error clearing message queue: ${err}`);
    throw err;
  }
};

// Função para pausar fila
export const pauseMessageQueue = async (): Promise<void> => {
  try {
    await messageQueue.pause();
    logger.info('Message queue paused');
  } catch (err) {
    logger.error(`Error pausing message queue: ${err}`);
    throw err;
  }
};

// Função para retomar fila
export const resumeMessageQueue = async (): Promise<void> => {
  try {
    await messageQueue.resume();
    logger.info('Message queue resumed');
  } catch (err) {
    logger.error(`Error resuming message queue: ${err}`);
    throw err;
  }
};

export default messageQueue;