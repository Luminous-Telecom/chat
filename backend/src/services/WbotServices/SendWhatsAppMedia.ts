import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
import mime from "mime-types";
import Message from "../../models/Message";

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
    logger.info(`[SendWhatsAppMedia] Iniciando envio de mídia: ${media.filename}`);
    
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

    let sentMessage;
    const isAudio = mimeType && mimeType.startsWith("audio/");

    // Criar a mensagem no banco de dados primeiro
    const messageData = {
      ticketId: ticket.id,
      body: body || media.originalname || media.filename,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      mediaType: mimeType.split('/')[0],
      mediaUrl: media.filename,
      mediaName: media.filename,
      originalName: media.originalname,
      timestamp: new Date().getTime(),
      status: "pending",
      ack: 0,
      messageId: null,
      tenantId: ticket.tenantId
    };

    // Criar a mensagem no banco
    const dbMessage = await Message.create(messageData);
    logger.info(`[SendWhatsAppMedia] Mensagem criada no banco com ID: ${dbMessage.id}`);

    if (isAudio) {
      try {
        logger.info("[SendWhatsAppMedia] Tentando enviar como áudio de voz");
        // Tenta enviar como áudio de voz primeiro
        sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
          audio: fileBuffer,
          mimetype: mimeType,
          ptt: true, // Força como áudio de voz
          sendAudioAsVoice: true
        });
        logger.info("[SendWhatsAppMedia] Enviado como áudio de voz");
        
        // Log detalhado da resposta
        logger.info("[SendWhatsAppMedia] Resposta completa do WhatsApp:", JSON.stringify(sentMessage, null, 2));

        // Tentar extrair o ID da mensagem de diferentes formas
        let messageId: string | null = null;
        if (sentMessage) {
          if (typeof sentMessage === 'string') {
            messageId = sentMessage;
          } else if (sentMessage.id) {
            if (typeof sentMessage.id === 'string') {
              messageId = sentMessage.id;
            } else if (sentMessage.id.id) {
              messageId = sentMessage.id.id;
            } else if (sentMessage.id._serialized) {
              messageId = sentMessage.id._serialized;
            }
          } else if (sentMessage.key && sentMessage.key.id) {
            messageId = sentMessage.key.id;
          }
        }

        logger.info("[SendWhatsAppMedia] ID extraído da mensagem:", messageId);

        // Atualizar a mensagem no banco com o ID do WhatsApp
        if (messageId) {
          await dbMessage.update({
            messageId,
            status: "sended",
            ack: 1
          });
          logger.info(`[SendWhatsAppMedia] Mensagem atualizada com ID do WhatsApp: ${messageId}`);
        } else {
          logger.error("[SendWhatsAppMedia] WhatsApp não retornou ID da mensagem!");
          throw new AppError("ERR_WAPP_MESSAGE_ID_NOT_FOUND");
        }
      } catch (voiceError) {
        logger.warn(`[SendWhatsAppMedia] Falha ao enviar como áudio de voz: ${voiceError.message}`);
        logger.info("[SendWhatsAppMedia] Tentando enviar como documento");
        // Se falhar, tenta enviar como documento
        sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
          document: fileBuffer,
          fileName: media.filename,
          mimetype: mimeType,
          caption: body
        });
        logger.info("[SendWhatsAppMedia] Enviado como documento");

        // Log detalhado da resposta
        logger.info("[SendWhatsAppMedia] Resposta completa do WhatsApp:", JSON.stringify(sentMessage, null, 2));

        // Tentar extrair o ID da mensagem de diferentes formas
        let messageId: string | null = null;
        if (sentMessage) {
          if (typeof sentMessage === 'string') {
            messageId = sentMessage;
          } else if (sentMessage.id) {
            if (typeof sentMessage.id === 'string') {
              messageId = sentMessage.id;
            } else if (sentMessage.id.id) {
              messageId = sentMessage.id.id;
            } else if (sentMessage.id._serialized) {
              messageId = sentMessage.id._serialized;
            }
          } else if (sentMessage.key && sentMessage.key.id) {
            messageId = sentMessage.key.id;
          }
        }

        logger.info("[SendWhatsAppMedia] ID extraído da mensagem:", messageId);

        // Atualizar a mensagem no banco com o ID do WhatsApp
        if (messageId) {
          await dbMessage.update({
            messageId,
            status: "sended",
            ack: 1,
            mediaType: "document"
          });
          logger.info(`[SendWhatsAppMedia] Mensagem atualizada com ID do WhatsApp: ${messageId}`);
        } else {
          logger.error("[SendWhatsAppMedia] WhatsApp não retornou ID da mensagem!");
          throw new AppError("ERR_WAPP_MESSAGE_ID_NOT_FOUND");
        }
      }
    } else if (mimeType && mimeType.startsWith("image/")) {
      sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
        image: fileBuffer,
        caption: body
      });
      // Atualizar a mensagem no banco
      if (sentMessage?.id) {
        const messageId = typeof sentMessage.id === 'string' ? sentMessage.id : sentMessage.id.id;
        await dbMessage.update({
          messageId,
          status: "sended",
          ack: 1
        });
      }
    } else if (mimeType && mimeType.startsWith("video/")) {
      sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
        video: fileBuffer,
        caption: body
      });
      // Atualizar a mensagem no banco
      if (sentMessage?.id) {
        const messageId = typeof sentMessage.id === 'string' ? sentMessage.id : sentMessage.id.id;
        await dbMessage.update({
          messageId,
          status: "sended",
          ack: 1
        });
      }
    } else {
      sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
        document: fileBuffer,
        fileName: media.filename,
        mimetype: mimeType,
        caption: body
      });
      // Atualizar a mensagem no banco
      if (sentMessage?.id) {
        const messageId = typeof sentMessage.id === 'string' ? sentMessage.id : sentMessage.id.id;
        await dbMessage.update({
          messageId,
          status: "sended",
          ack: 1
        });
      }
    }

    // Registrar atividade do usuário se houver userId
    if (ticket.userId) {
      await UserMessagesLog.create({
        messageId: dbMessage.id,
        userId: ticket.userId,
        ticketId: ticket.id
      });
      logger.info(`[SendWhatsAppMedia] Log de usuário criado para mensagem ${dbMessage.id}`);
    }

    // Remover arquivo temporário se existir
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`[SendWhatsAppMedia] Arquivo temporário removido: ${filePath}`);
    }

    return dbMessage;
  } catch (err) {
    logger.error(`[SendWhatsAppMedia] Erro ao enviar mídia:`, err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
