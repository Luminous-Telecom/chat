import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
import mime from "mime-types";
import Message from "../../models/Message";
import socketEmit from "../../helpers/socketEmit";

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
    const mediaType = mimeType.startsWith("image/") ? "image" : 
                     mimeType.startsWith("video/") ? "video" : 
                     mimeType.startsWith("audio/") ? "audio" : "document";

    // Criar a mensagem no banco de dados primeiro
    const messageData = {
      ticketId: ticket.id,
      body: body || media.originalname || media.filename,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      mediaType: mediaType,
      mediaUrl: `sent/${media.filename}`,
      mediaName: media.filename,
      originalName: media.originalname,
      timestamp: new Date().getTime(),
      status: "sended",
      ack: 1,
      messageId: null,
      tenantId: ticket.tenantId
    };

    // Criar a mensagem no banco
    const dbMessage = await Message.create(messageData);
    logger.info(`[SendWhatsAppMedia] Mensagem criada no banco com ID: ${dbMessage.id} como ${mediaType}`);

    // Emitir evento de criação da mensagem (apenas ack 1, status sended)
    socketEmit({
      tenantId: ticket.tenantId,
      type: "chat:ack",
      payload: {
        id: dbMessage.id,
        messageId: null,
        status: "sended",
        ack: 1,
        fromMe: true,
        mediaUrl: dbMessage.mediaUrl,
        mediaType: mediaType,
        body: dbMessage.body,
        timestamp: dbMessage.timestamp
      }
    });

    if (isAudio) {
      try {
        logger.info("[SendWhatsAppMedia] Tentando enviar como áudio");
        // Enviar como áudio normal (não como voz)
        sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
          audio: fileBuffer,
          mimetype: mimeType,
          ptt: false // Não forçar como áudio de voz
        });
        logger.info("[SendWhatsAppMedia] Enviado como áudio");
        
        // Log detalhado da resposta
        logger.info("[SendWhatsAppMedia] Resposta completa do WhatsApp:", JSON.stringify(sentMessage, null, 2));

        // Tentar extrair o ID da mensagem
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
          const updateData = {
            messageId,
            status: "sended",
            ack: 1,
            mediaType: "audio" // Manter como áudio
          };
          
          logger.info("[SendWhatsAppMedia] Dados para atualização:", JSON.stringify(updateData, null, 2));
          
          await dbMessage.update(updateData);
          logger.info(`[SendWhatsAppMedia] Mensagem atualizada com ID do WhatsApp: ${messageId}`);
        } else {
          logger.error("[SendWhatsAppMedia] WhatsApp não retornou ID da mensagem!");
          throw new AppError("ERR_WAPP_MESSAGE_ID_NOT_FOUND");
        }
      } catch (audioError) {
        logger.warn(`[SendWhatsAppMedia] Falha ao enviar como áudio: ${audioError.message}`);
        logger.info("[SendWhatsAppMedia] Tentando enviar como documento");
        // Se falhar, tenta enviar como documento
        sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
          document: fileBuffer,
          fileName: media.filename,
          mimetype: mimeType,
          caption: body
        });
        logger.info("[SendWhatsAppMedia] Enviado como documento");

        // Atualizar a mensagem no banco
        if (sentMessage?.id) {
          const messageId = typeof sentMessage.id === 'string' ? sentMessage.id : sentMessage.id.id;
          const updateData = {
            messageId,
            status: "sended",
            ack: 1,
            mediaType: "document" // Atualizar para documento já que falhou como áudio
          };
          
          await dbMessage.update(updateData);
          logger.info(`[SendWhatsAppMedia] Mensagem atualizada como documento com ID: ${messageId}`);
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
        const mediaType = mimeType.startsWith("image/") ? "image" : 
                         mimeType.startsWith("video/") ? "video" : 
                         mimeType.startsWith("audio/") ? "audio" : "document";
                         
        const updateData = {
          messageId,
          status: "sended",
          ack: 1,
          mediaType
        };
        
        logger.info("[SendWhatsAppMedia] Dados para atualização:", JSON.stringify(updateData, null, 2));
        
        await dbMessage.update(updateData);
        logger.info(`[SendWhatsAppMedia] Mensagem atualizada com ID do WhatsApp: ${messageId}`);
      }
    } else if (mimeType && mimeType.startsWith("video/")) {
      sentMessage = await wbot.sendMessage(`${numberToSend}@c.us`, {
        video: fileBuffer,
        caption: body
      });
      // Atualizar a mensagem no banco
      if (sentMessage?.id) {
        const messageId = typeof sentMessage.id === 'string' ? sentMessage.id : sentMessage.id.id;
        const mediaType = mimeType.startsWith("image/") ? "image" : 
                         mimeType.startsWith("video/") ? "video" : 
                         mimeType.startsWith("audio/") ? "audio" : "document";
                         
        const updateData = {
          messageId,
          status: "sended",
          ack: 1,
          mediaType
        };
        
        logger.info("[SendWhatsAppMedia] Dados para atualização:", JSON.stringify(updateData, null, 2));
        
        await dbMessage.update(updateData);
        logger.info(`[SendWhatsAppMedia] Mensagem atualizada com ID do WhatsApp: ${messageId}`);
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
        const mediaType = mimeType.startsWith("image/") ? "image" : 
                         mimeType.startsWith("video/") ? "video" : 
                         mimeType.startsWith("audio/") ? "audio" : "document";
                         
        const updateData = {
          messageId,
          status: "sended",
          ack: 1,
          mediaType
        };
        
        logger.info("[SendWhatsAppMedia] Dados para atualização:", JSON.stringify(updateData, null, 2));
        
        await dbMessage.update(updateData);
        logger.info(`[SendWhatsAppMedia] Mensagem atualizada com ID do WhatsApp: ${messageId}`);
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

    // Não precisamos mais remover o arquivo pois ele já está na pasta correta
    logger.info(`[SendWhatsAppMedia] Arquivo salvo em: ${media.path}`);

    return dbMessage;
  } catch (err) {
    logger.error(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
