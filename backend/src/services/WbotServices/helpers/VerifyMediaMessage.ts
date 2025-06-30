import { join } from "path";
import { promisify } from "util";
import fs, { writeFile } from "fs";

// import { WbotMessage } from '../../../types/baileys';
import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";

import Message from "../../../models/Message";
import VerifyQuotedMessage from "./VerifyQuotedMessage";
import CreateMessageService from "../../MessageServices/CreateMessageService";
import { logger } from "../../../utils/logger";
import { createMediaPreviewMessage } from "../../../utils/mediaPreviewHelper";
import socketEmit from "../../../helpers/socketEmit";

// Cache para mensagens em processamento
const processingMessages = new Set<string>();

// Cache para controlar logs repetitivos de mensagens já existentes
const existingMessageLogCache = new Set<string>();
const EXISTING_MESSAGE_LOG_TTL = 300000; // 5 minutos

// Limpar cache de logs periodicamente
setInterval(() => {
  existingMessageLogCache.clear();
}, EXISTING_MESSAGE_LOG_TTL);

const writeFileAsync = promisify(writeFile);

const getMediaType = (mimetype: string | undefined): string => {
  if (!mimetype) return "application";
  const [type] = mimetype.split("/");
  return type || "application";
};

const getFileExtension = (mimetype: string | undefined): string => {
  if (!mimetype) return "bin";
  const ext = mimetype.split("/")[1];
  return ext ? ext.split(";")[0] : "bin";
};

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

interface MediaData {
  data: string | Buffer;
  mimetype?: string;
  filename?: string;
}

const VerifyMediaMessage = async (
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
): Promise<Message | void> => {
  // Timeout geral para todo o processo de verificação de mídia
  const processTimeout = 120000; // 2 minutos
  
  return Promise.race([
    processVerifyMediaMessage(msg, ticket, contact),
    new Promise<void>((_, reject) =>
      setTimeout(() => {
        processingMessages.delete(msg.id.id);
        reject(new Error(`VerifyMediaMessage timeout after ${processTimeout}ms for message ${msg.id.id}`));
      }, processTimeout)
    )
  ]);
};

const processVerifyMediaMessage = async (
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
): Promise<Message | void> => {
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
      logger.debug(`[VerifyMediaMessage] Ignored message type: ${msg.type} for ticket ${ticket.id}`);
      return;
    }

    // Log detalhado apenas quando necessário (reduzido para debug)
    logger.debug(
      `[VerifyMediaMessage] DEBUG - Processing message ${msg.id.id} for ticket ${ticket.id}`
    );
    logger.debug(
      `[VerifyMediaMessage] DEBUG - Message type: ${msg.type}, hasMedia: ${msg.hasMedia}, fromMe: ${msg.fromMe}`
    );
    logger.debug(
      `[VerifyMediaMessage] DEBUG - Message body: ${msg.body || 'empty'}`
    );

    // Verificar se a mensagem já está sendo processada
    if (processingMessages.has(msg.id.id)) {
      logger.warn(
        `[VerifyMediaMessage] Message ${msg.id.id} is already being processed, skipping`
      );
      return;
    }

    // Adicionar mensagem ao cache de processamento
    processingMessages.add(msg.id.id);

    // Verificar se a mensagem já existe no banco
    const existingMessage = await Message.findOne({
      where: { messageId: msg.id.id },
    });

    if (existingMessage) {
      // Log apenas uma vez por mensagem para evitar spam
      if (!existingMessageLogCache.has(msg.id.id)) {
        logger.debug(
          `[VerifyMediaMessage] DEBUG - Message ${msg.id.id} already exists in database, skipping`
        );
        existingMessageLogCache.add(msg.id.id);
      }
      processingMessages.delete(msg.id.id);
      return existingMessage;
    }

    logger.debug(
      `[VerifyMediaMessage] DEBUG - Message ${msg.id.id} is new, proceeding with processing`
    );

    const quotedMsg = await VerifyQuotedMessage(msg, ticket);

    // Verificar se a mensagem tem mídia antes de tentar baixar
    // Permitir tentativa de download apenas para tipos de mensagem de mídia válidos
    const validMediaTypes = ["image", "video", "audio", "document", "sticker", "contactMessage", "imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];
    const invalidTypes = ["messageContextInfo", "conversation", "extendedTextMessage", "chat", "text", "ephemeralMessage"];
    
    // Log para debug de tipos de mensagem (reduzido)
    logger.debug(
      `[VerifyMediaMessage] DEBUG - Message type validation - type: ${msg.type}, hasMedia: ${msg.hasMedia}`
    );
    
    // Rejeitar tipos explicitamente não-mídia
    if (invalidTypes.includes(msg.type)) {
      logger.debug(
        `[VerifyMediaMessage] DEBUG - Message ${msg.id.id} rejected - type '${msg.type}' is not a media type`
      );
      processingMessages.delete(msg.id.id);
      return;
    }
    
    if (!msg.hasMedia && !validMediaTypes.includes(msg.type)) {
      logger.debug(
        `[VerifyMediaMessage] DEBUG - Message ${msg.id.id} has no media content for ticket ${ticket.id} - hasMedia: ${msg.hasMedia}, type: ${msg.type}`
      );
      processingMessages.delete(msg.id.id);
      return;
    }

    logger.debug(
      `[VerifyMediaMessage] DEBUG - Starting media download for message ${msg.id.id}`
    );

    // Tentar baixar a mídia com retry
    let media: MediaData | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    let lastError: any = null;

    while (retryCount < maxRetries && !media) {
      try {
        logger.info(`[VerifyMediaMessage] Download attempt ${retryCount + 1}/${maxRetries} for message ${msg.id.id} (type: ${msg.type})`);
        
        // Tentar diferentes métodos de download com timeout específico para cada tipo
        let downloadResult: any = null;
        const timeoutMs = msg.type === 'stickerMessage' ? 15000 : 30000; // Timeout menor para stickers
        
        if (retryCount === 0) {
          // Primeira tentativa normal
          downloadResult = await Promise.race([
            (msg as any).downloadMedia(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Download timeout after ${timeoutMs}ms`)), timeoutMs)
            )
          ]);
        } else if (retryCount === 1) {
          // Segunda tentativa com opções específicas
          downloadResult = await Promise.race([
            (msg as any).downloadMedia({ highQuality: false }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Download timeout after ${timeoutMs}ms (attempt 2)`)), timeoutMs)
            )
          ]);
        } else {
          // Última tentativa com timeout ainda menor
          const finalTimeout = Math.max(10000, timeoutMs / 2);
          downloadResult = await Promise.race([
            (msg as any).downloadMedia(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Download timeout after ${finalTimeout}ms (final attempt)`)), finalTimeout)
            )
          ]);
        }

        logger.info(`[VerifyMediaMessage] Download completed for ${msg.id.id}, processing result...`);

        // Verificar se o resultado é um Buffer (Baileys) ou objeto MediaData (WhatsApp Web.js)
        if (downloadResult) {
          if (Buffer.isBuffer(downloadResult)) {
            // Detectar mimetype baseado no tipo de mensagem
            let detectedMimetype = "application/octet-stream";
            
            if (msg.type === 'stickerMessage' && msg.message?.stickerMessage) {
              detectedMimetype = msg.message.stickerMessage.mimetype || "image/webp";
            } else {
              detectedMimetype =
                msg.message?.imageMessage?.mimetype ||
                msg.message?.videoMessage?.mimetype ||
                msg.message?.audioMessage?.mimetype ||
                msg.message?.documentMessage?.mimetype ||
                msg.message?.stickerMessage?.mimetype ||
                "application/octet-stream";
            }

            const fileExtension = getFileExtension(detectedMimetype);
            let baseFilename = '';
            
            // Tratamento específico para diferentes tipos de mídia
            if (msg.type === 'stickerMessage') {
              baseFilename = `sticker_${Date.now()}`;
            } else {
              baseFilename =
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                msg.message?.documentMessage?.fileName ||
                msg.body ||
                `media_${Date.now()}`;
            }

            // Garantir que o filename tenha a extensão correta
            const finalFilename = baseFilename.includes(".")
              ? baseFilename
              : `${baseFilename}.${fileExtension}`;

            media = {
              data: downloadResult,
              mimetype: detectedMimetype,
              filename: finalFilename,
            } as MediaData;

            logger.info(`[VerifyMediaMessage] Successfully processed download for ${msg.id.id}, filename: ${finalFilename}`);
            break;
          } else if (downloadResult && downloadResult.data) {
            media = downloadResult as MediaData;
            logger.info(`[VerifyMediaMessage] Successfully processed object download for ${msg.id.id}`);
            break;
          } else {
            logger.warn(
              `[VerifyMediaMessage] Media downloaded but invalid format for message ID: ${
                msg.id.id
              } on attempt ${retryCount + 1}`
            );
            logger.warn(
              `[VerifyMediaMessage] Download result type: ${typeof downloadResult}, keys: ${Object.keys(
                downloadResult || {}
              )}`
            );
            // Continue para a próxima tentativa
            retryCount++;
          }
        } else {
          logger.warn(`[VerifyMediaMessage] Download returned null for ${msg.id.id}, attempt ${retryCount + 1}`);
          retryCount++;
        }
      } catch (err) {
        lastError = err;
        retryCount++;
        logger.warn(
          `[VerifyMediaMessage] Attempt ${retryCount} failed for message ID: ${msg.id.id}. Error: ${err.message}`
        );

        if (retryCount >= maxRetries) {
          logger.error(
            `[VerifyMediaMessage] ERR_WAPP_DOWNLOAD_MEDIA:: Failed after ${maxRetries} attempts for message ID: ${
              msg.id.id
            } (type: ${msg.type}). Last error: ${lastError?.message || "Unknown error"}`
          );
          
          // Para stickers, criar mensagem indicativa
          const fallbackBody = msg.type === 'stickerMessage' 
            ? "📄 Figurinha" 
            : msg.body || "Mídia não disponível";
          
          // Criar mensagem mesmo sem mídia para evitar reprocessamento
          const messageData = {
            messageId: msg.id.id,
            ticketId: ticket.id,
            contactId: msg.fromMe ? undefined : contact.id,
            body: fallbackBody,
            fromMe: msg.fromMe,
            read: msg.fromMe,
            mediaType: msg.type === 'stickerMessage' ? 'image' : getMediaType(undefined),
            quotedMsgId: quotedMsg?.id,
            timestamp: msg.timestamp,
            status: msg.fromMe ? "sended" : "received",
          };

          const message = await CreateMessageService({
            messageData,
            tenantId: ticket.tenantId,
          });
          
          processingMessages.delete(msg.id.id);
          return message;
        }

        // Esperar um pouco antes de tentar novamente, com tempo crescente
        const waitTime = 1000 * Math.pow(2, retryCount - 1); // Exponential backoff
        logger.info(`[VerifyMediaMessage] Waiting ${waitTime}ms before retry ${retryCount + 1} for message ${msg.id.id}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (!media) {
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: No media data for message ID: ${
          msg.id.id
        }. Last error: ${lastError?.message || "Unknown error"}`
      );
      return;
    }

    if (!media.data) {
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: No media data content for message ID: ${msg.id.id}`
      );
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: Media object keys: ${Object.keys(media)}`
      );
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: Media mimetype: ${media.mimetype}`
      );
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: Media filename: ${media.filename}`
      );
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: Message type: ${msg.type}, hasMedia: ${msg.hasMedia}`
      );
      return;
    }

    // Verificar se o tipo de mídia é válido
    if (!media.mimetype) {
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: Invalid mimetype for message ID: ${msg.id.id}`
      );
      return;
    }

    const ext = getFileExtension(media.mimetype);
    if (!ext) {
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: Could not determine file extension for mimetype ${media.mimetype} in message ID: ${msg.id.id}`
      );
      return;
    }

    // Criar nome de arquivo seguro
    const timestamp = new Date().getTime();
    const filename = createSafeFilename(media.filename || msg.body || '', timestamp, ext);
    
    logger.info(
      `[VerifyMediaMessage] Created safe filename: ${filename} for message ID: ${msg.id.id}`
    );

    let fileData: Buffer;
    try {
      if (typeof media.data === "string") {
        fileData = Buffer.from(media.data, "base64");
      } else if (Buffer.isBuffer(media.data)) {
        fileData = media.data;
      } else {
        logger.error(
          `ERR_WAPP_DOWNLOAD_MEDIA:: Invalid media data type for message ID: ${msg.id.id}`
        );
        return;
      }
    } catch (err) {
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: Error processing media data for message ID: ${msg.id.id}: ${err}`
      );
      return;
    }

    // Verificar se o diretório existe
    const publicDir = join(__dirname, "..", "..", "..", "..", "public");
    const receivedDir = join(publicDir, "received");
    try {
      await fs.promises.access(publicDir);
      // Verificar se o diretório received existe
      try {
        await fs.promises.access(receivedDir);
      } catch (err) {
        // Se não existir, criar o diretório received
        await fs.promises.mkdir(receivedDir, { recursive: true });
      }
    } catch (err) {
      try {
        // Criar diretório public e received
        await fs.promises.mkdir(publicDir, { recursive: true });
        await fs.promises.mkdir(receivedDir, { recursive: true });
      } catch (mkdirErr) {
        logger.error(
          `ERR_WAPP_DOWNLOAD_MEDIA:: Could not create directories: ${mkdirErr}`
        );
        return;
      }
    }

    try {
      const filePath = join(receivedDir, filename);
      await writeFileAsync(filePath, fileData);
    } catch (err) {
      logger.error(
        `ERR_WAPP_DOWNLOAD_MEDIA:: Error saving media file for message ID: ${msg.id.id}: ${err}`
      );
      return;
    }

    const messageData = {
      messageId: msg.id.id,
      ticketId: ticket.id,
      contactId: msg.fromMe ? undefined : contact.id,
      body: msg.body || filename,
      fromMe: msg.fromMe,
      read: msg.fromMe,
      mediaUrl: `received/${filename}`,
      mediaType: getMediaType(media.mimetype),
      quotedMsgId: quotedMsg?.id,
      timestamp: msg.timestamp,
      status: msg.fromMe ? "sended" : "received",
      dataPayload: msg.dataPayload,
    };

    const message = await CreateMessageService({
      messageData,
      tenantId: ticket.tenantId,
    });

    // Criar mensagem descritiva para o preview
    const displayMessage = createMediaPreviewMessage(msg.body, filename, media.mimetype);

    // CORREÇÃO: Não recalcular unreadMessages aqui pois já foi definido corretamente 
    // pelo FindOrCreateTicketService baseado no chat.unreadCount
    await ticket.update({
      lastMessage: displayMessage,
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

    processingMessages.delete(msg.id.id);
    return message;
  } catch (err) {
    logger.error(
      `[VerifyMediaMessage] Unexpected error processing media for ticket ${ticket.id}, message ID: ${msg.id.id}: ${err}`
    );
    logger.error(`[VerifyMediaMessage] Error stack: ${err.stack}`);
    processingMessages.delete(msg.id.id);
  }
};

export default VerifyMediaMessage;
