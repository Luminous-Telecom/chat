import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import fs from "fs";

// import { WbotMessage } from '../../../types/baileys';
import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";

import Message from "../../../models/Message";
import VerifyQuotedMessage from "./VerifyQuotedMessage";
import CreateMessageService from "../../MessageServices/CreateMessageService";
import { logger } from "../../../utils/logger";

const writeFileAsync = promisify(writeFile);

const getMediaType = (mimetype: string | undefined): string => {
  if (!mimetype) return 'application';
  const [type] = mimetype.split('/');
  return type || 'application';
};

const getFileExtension = (mimetype: string | undefined): string => {
  if (!mimetype) return 'bin';
  const parts = mimetype.split('/');
  if (parts.length < 2) return 'bin';
  const [_, ext] = parts;
  const [cleanExt] = ext.split(';');
  return cleanExt || 'bin';
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
    const quotedMsg = await VerifyQuotedMessage(msg);
    
    // Verificar se a mensagem tem mídia antes de tentar baixar
    if (!msg.hasMedia) {
      logger.info(`Message ${msg.id.id} has no media content`);
      return;
    }

    // Tentar baixar a mídia com retry
    let media: MediaData | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && !media) {
      try {
        media = await (msg as any).downloadMedia() as MediaData;
        if (media) break;
      } catch (err) {
        retryCount++;
        if (retryCount === maxRetries) {
          logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: Failed after ${maxRetries} attempts for message ID: ${msg.id.id}`);
          return;
        }
        // Esperar um pouco antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    if (!media) {
      logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: No media data for message ID: ${msg.id.id}`);
      return;
    }

    if (!media.data) {
      logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: No media data content for message ID: ${msg.id.id}`);
      return;
    }

    // Verificar se o tipo de mídia é válido
    if (!media.mimetype) {
      logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: Invalid mimetype for message ID: ${msg.id.id}`);
      return;
    }

    const ext = getFileExtension(media.mimetype);
    if (!ext) {
      logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: Could not determine file extension for mimetype ${media.mimetype} in message ID: ${msg.id.id}`);
      return;
    }

    const filename = media.filename || `${new Date().getTime()}.${ext}`;

    let fileData: Buffer;
    try {
      if (typeof media.data === 'string') {
        fileData = Buffer.from(media.data, 'base64');
      } else if (Buffer.isBuffer(media.data)) {
        fileData = media.data;
      } else {
        logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: Invalid media data type for message ID: ${msg.id.id}`);
        return;
      }
    } catch (err) {
      logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: Error processing media data for message ID: ${msg.id.id}: ${err}`);
      return;
    }

    // Verificar se o diretório existe
    const publicDir = join(__dirname, "..", "..", "..", "..", "public");
    try {
      await fs.promises.access(publicDir);
    } catch (err) {
      try {
        await fs.promises.mkdir(publicDir, { recursive: true });
      } catch (mkdirErr) {
        logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: Could not create public directory: ${mkdirErr}`);
        return;
      }
    }

    try {
      const filePath = join(publicDir, filename);
      await writeFileAsync(filePath, fileData);
      logger.info(`Media file saved successfully: ${filename}`);
    } catch (err) {
      logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: Error saving media file for message ID: ${msg.id.id}: ${err}`);
      return;
    }

    const messageData = {
      messageId: msg.id.id,
      ticketId: ticket.id,
      contactId: msg.fromMe ? undefined : contact.id,
      body: msg.body || filename,
      fromMe: msg.fromMe,
      read: msg.fromMe,
      mediaUrl: filename,
      mediaType: getMediaType(media.mimetype),
      quotedMsgId: quotedMsg?.id,
      timestamp: msg.timestamp,
      status: msg.fromMe ? "sended" : "received"
    };

    const message = await CreateMessageService({ messageData, tenantId: ticket.tenantId });

    await ticket.update({
      lastMessage: msg.body || filename,
      lastMessageAt: new Date().getTime(),
      answered: msg.fromMe || false
    });

    return message;
  } catch (err) {
    logger.error(`ERR_WAPP_DOWNLOAD_MEDIA:: Unexpected error processing media for message ID: ${msg.id.id}: ${err}`);
    return;
  }
};

export default VerifyMediaMessage;
