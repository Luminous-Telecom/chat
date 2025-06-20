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

// Cache para mensagens em processamento
const processingMessages = new Set<string>();

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
  try {
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
      processingMessages.delete(msg.id.id);
      return existingMessage;
    }

    const quotedMsg = await VerifyQuotedMessage(msg, ticket);

    // Verificar se a mensagem tem mídia antes de tentar baixar
    // Permitir tentativa de download mesmo se hasMedia for false para alguns tipos de mensagem
    const mediaTypes = ["image", "video", "audio", "document", "sticker"];
    if (!msg.hasMedia && !mediaTypes.includes(msg.type)) {
      logger.warn(
        `[VerifyMediaMessage] Message ${msg.id.id} has no media content for ticket ${ticket.id}`
      );
      return;
    }

    // Tentar baixar a mídia com retry
    let media: MediaData | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    let lastError: any = null;

    while (retryCount < maxRetries && !media) {
      try {
        // Tentar diferentes métodos de download
        let downloadResult: any = null;
        if (retryCount === 0) {
          downloadResult = await (msg as any).downloadMedia();
        } else if (retryCount === 1) {
          // Tentar com opções específicas
          downloadResult = await (msg as any).downloadMedia({
            highQuality: false,
          });
        } else {
          // Última tentativa com timeout maior
          downloadResult = await Promise.race([
            (msg as any).downloadMedia(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Download timeout")), 30000)
            ),
          ]);
        }

        // Verificar se o resultado é um Buffer (Baileys) ou objeto MediaData (WhatsApp Web.js)
        if (downloadResult) {
          if (Buffer.isBuffer(downloadResult)) {
            const detectedMimetype =
              msg.message?.imageMessage?.mimetype ||
              msg.message?.videoMessage?.mimetype ||
              msg.message?.audioMessage?.mimetype ||
              msg.message?.documentMessage?.mimetype ||
              "application/octet-stream";

            const fileExtension = getFileExtension(detectedMimetype);
            const baseFilename =
              msg.message?.imageMessage?.caption ||
              msg.message?.videoMessage?.caption ||
              msg.message?.documentMessage?.fileName ||
              `media_${Date.now()}`;

            // Garantir que o filename tenha a extensão correta
            const finalFilename = baseFilename.includes(".")
              ? baseFilename
              : `${baseFilename}.${fileExtension}`;

            media = {
              data: downloadResult,
              mimetype: detectedMimetype,
              filename: finalFilename,
            } as MediaData;
            break;
          } else if (downloadResult.data) {
            media = downloadResult as MediaData;
            break;
          } else {
            logger.warn(
              `Media downloaded but invalid format for message ID: ${
                msg.id.id
              } on attempt ${retryCount + 1}`
            );
            logger.warn(
              `Download result type: ${typeof downloadResult}, keys: ${Object.keys(
                downloadResult || {}
              )}`
            );
          }
        }
      } catch (err) {
        lastError = err;
        retryCount++;
        logger.warn(
          `Attempt ${retryCount} failed for message ID: ${msg.id.id}. Error: ${err.message}`
        );

        if (retryCount === maxRetries) {
          logger.error(
            `ERR_WAPP_DOWNLOAD_MEDIA:: Failed after ${maxRetries} attempts for message ID: ${
              msg.id.id
            }. Last error: ${lastError?.message || "Unknown error"}`
          );
          // Criar mensagem mesmo sem mídia para evitar reprocessamento
          const messageData = {
            messageId: msg.id.id,
            ticketId: ticket.id,
            contactId: msg.fromMe ? undefined : contact.id,
            body: msg.body || "Mídia não disponível",
            fromMe: msg.fromMe,
            read: msg.fromMe,
            mediaType: msg.type,
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
        const waitTime = 1000 * Math.pow(2, retryCount); // Exponential backoff
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

    // Calcular contador de mensagens não lidas
    const currentUnread = await Message.count({
      where: { ticketId: ticket.id, read: false, fromMe: false },
    });

    // Incrementar contador se mensagem não for própria
    const newUnreadCount = msg.fromMe ? currentUnread : currentUnread + 1;

    await ticket.update({
      lastMessage: msg.body || filename,
      lastMessageAt: new Date().getTime(),
      answered: msg.fromMe || false,
      unreadMessages: newUnreadCount,
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
