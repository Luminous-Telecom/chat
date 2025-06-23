import fs from "fs";
import mime from "mime-types";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
import Message from "../../models/Message";
import socketEmit from "../../helpers/socketEmit";

// Função para criar nomes de arquivo seguros
const createSafeFilename = (originalName: string, timestamp: number, ext: string): string => {
  // Se não há nome original ou é muito longo, usar timestamp
  if (!originalName || originalName.length > 50) {
    return `${timestamp}.${ext}`;
  }

  // Limpar o nome do arquivo removendo caracteres problemáticos
  let safeName = originalName
    .replace(/[<>:"/\\|?*]/g, '') // Remover caracteres inválidos para arquivos
    .replace(/\s+/g, '_') // Substituir espaços por underscores
    .replace(/[^\w\-_.]/g, '') // Manter apenas letras, números, hífens, underscores e pontos
    .substring(0, 50); // Limitar a 50 caracteres

  // Se o nome ficou vazio após a limpeza, usar timestamp
  if (!safeName || safeName.trim() === '') {
    return `${timestamp}.${ext}`;
  }

  // Adicionar extensão se não tiver
  if (!safeName.includes('.')) {
    safeName += `.${ext}`;
  }

  return safeName;
};

// Função padronizada para extrair o ID da mensagem do WhatsApp
const extractMessageId = (sentMessage: any): string | null => {
  logger.info(
    "[SendWhatsAppMedia] Resposta completa do WhatsApp:",
    JSON.stringify(sentMessage, null, 2)
  );

  let messageId: string | null = null;
  
  if (sentMessage) {
    if (typeof sentMessage === "string") {
      messageId = sentMessage;
    } else if (sentMessage.key && sentMessage.key.id) {
      messageId = sentMessage.key.id;
    } else if (sentMessage.id) {
      if (typeof sentMessage.id === "string") {
        messageId = sentMessage.id;
      } else if (sentMessage.id.id) {
        messageId = sentMessage.id.id;
      } else if (sentMessage.id._serialized) {
        messageId = sentMessage.id._serialized;
      }
    }
  }

  logger.info("[SendWhatsAppMedia] ID extraído da mensagem:", messageId);
  return messageId;
};

// Função padronizada para atualizar a mensagem no banco
const updateMessageWithId = async (dbMessage: Message, messageId: string | null, mediaType: string): Promise<void> => {
  if (messageId) {
    const updateData = {
      messageId,
      status: "sended",
      ack: 1,
      mediaType,
    };

    logger.info(
      "[SendWhatsAppMedia] Dados para atualização:",
      JSON.stringify(updateData, null, 2)
    );

    await dbMessage.update(updateData);
    logger.info(
      `[SendWhatsAppMedia] Mensagem atualizada com ID do WhatsApp: ${messageId}`
    );
  } else {
    logger.error(
      "[SendWhatsAppMedia] WhatsApp não retornou ID da mensagem!"
    );
    throw new AppError("ERR_WAPP_MESSAGE_ID_NOT_FOUND");
  }
};

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  userId: number | string | undefined;
}

const SendWhatsAppMedia = async (
  media: Express.Multer.File,
  number: string,
  ticket: Ticket,
  body?: string
): Promise<Message> => {
  const wbot = await GetTicketWbot(ticket);
  const numberToSend = number.replace(/\D/g, "");

  try {
    logger.info(
      `[SendWhatsAppMedia] Iniciando envio de mídia: ${media.filename}`
    );

    if (!wbot) {
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }

    // Verifica se o arquivo existe no disco
    const filePath = media.path;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new AppError("ERR_FILE_NOT_FOUND");
    }

    const fileBuffer = media.buffer || fs.readFileSync(filePath);
    const mimeType = mime.lookup(media.filename) || "application/octet-stream";
    logger.info(`[SendWhatsAppMedia] Tipo de mídia detectado: ${mimeType}`);

    // Criar nome de arquivo seguro
    const timestamp = new Date().getTime();
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
    const safeFilename = createSafeFilename(media.filename || media.originalname || '', timestamp, ext);
    
    logger.info(
      `[SendWhatsAppMedia] Created safe filename: ${safeFilename} from original: ${media.filename}`
    );

    let sentMessage;
    const isAudio = mimeType && mimeType.startsWith("audio/");
    const mediaType = mimeType.startsWith("image/")
      ? "image"
      : mimeType.startsWith("video/")
      ? "video"
      : mimeType.startsWith("audio/")
      ? "audio"
      : "document";

    // Criar a mensagem no banco de dados primeiro
    const messageData = {
      ticketId: ticket.id,
      body: body || media.originalname || safeFilename,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      mediaType,
      mediaUrl: `sent/${safeFilename}`,
      mediaName: safeFilename,
      originalName: media.originalname,
      timestamp: new Date().getTime(),
      status: "sended",
      ack: 1,
      messageId: null,
      tenantId: ticket.tenantId,
    };

    logger.info("[SendWhatsAppMedia] Dados da mensagem para o banco:", {
      body: messageData.body,
      mediaUrl: messageData.mediaUrl,
      mediaName: messageData.mediaName,
      safeFilename
    });

    // Criar a mensagem no banco
    const dbMessage = await Message.create(messageData);
    logger.info(
      `[SendWhatsAppMedia] Mensagem criada no banco com ID: ${dbMessage.id} como ${mediaType}`
    );

    // Evento será emitido pelo CreateMessageSystemService na função finalizeMessage

    if (isAudio) {
      try {
        logger.info("[SendWhatsAppMedia] Tentando enviar como áudio");
        // Enviar como áudio normal (não como voz)
        sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
          audio: fileBuffer,
          mimetype: mimeType,
          ptt: true, // Forçar como áudio de voz
        });
        logger.info("[SendWhatsAppMedia] Enviado como áudio");

        // Extrair o ID da mensagem usando função padronizada
        const messageId = extractMessageId(sentMessage);
        await updateMessageWithId(dbMessage, messageId, "audio");

      } catch (audioError) {
        logger.warn(
          `[SendWhatsAppMedia] Falha ao enviar como áudio: ${audioError.message}`
        );
        logger.info("[SendWhatsAppMedia] Tentando enviar como documento");
        // Se falhar, tenta enviar como documento
        sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
          document: fileBuffer,
          fileName: safeFilename,
          mimetype: mimeType,
          caption: body,
        });
        logger.info("[SendWhatsAppMedia] Enviado como documento");

        // Extrair o ID da mensagem usando função padronizada
        const messageId = extractMessageId(sentMessage);
        await updateMessageWithId(dbMessage, messageId, "document");
      }
    } else if (mimeType && mimeType.startsWith("image/")) {
      logger.info("[SendWhatsAppMedia] Tentando enviar como imagem");
      sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
        image: fileBuffer,
        caption: body,
      });
      logger.info("[SendWhatsAppMedia] Enviado como imagem");

      // Extrair o ID da mensagem usando função padronizada
      const messageId = extractMessageId(sentMessage);
      await updateMessageWithId(dbMessage, messageId, "image");

    } else if (mimeType && mimeType.startsWith("video/")) {
      logger.info("[SendWhatsAppMedia] Tentando enviar como vídeo");
      sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
        video: fileBuffer,
        caption: body,
      });
      logger.info("[SendWhatsAppMedia] Enviado como vídeo");

      // Extrair o ID da mensagem usando função padronizada
      const messageId = extractMessageId(sentMessage);
      await updateMessageWithId(dbMessage, messageId, "video");

    } else {
      logger.info("[SendWhatsAppMedia] Tentando enviar como documento");
      sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
        document: fileBuffer,
        fileName: safeFilename,
        mimetype: mimeType,
        caption: body,
      });
      logger.info("[SendWhatsAppMedia] Enviado como documento");

      // Extrair o ID da mensagem usando função padronizada
      const messageId = extractMessageId(sentMessage);
      await updateMessageWithId(dbMessage, messageId, "document");
    }

    // Registrar atividade do usuário se houver userId
    if (ticket.userId) {
      await UserMessagesLog.create({
        messageId: dbMessage.id,
        userId: ticket.userId,
        ticketId: ticket.id,
      });
      logger.info(
        `[SendWhatsAppMedia] Log de usuário criado para mensagem ${dbMessage.id}`
      );
    }

    // Não precisamos mais remover o arquivo pois ele já está na pasta correta
    logger.info(`[SendWhatsAppMedia] Arquivo salvo em: ${media.path}`);

    return dbMessage;
  } catch (err) {
    logger.error(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
