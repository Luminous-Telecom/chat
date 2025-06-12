/* eslint-disable prefer-destructuring */
import fs from "fs";
import { promisify } from "util";
import { join } from "path";
import axios from "axios";
import mime from "mime";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import socketEmit from "../../helpers/socketEmit";
import Queue from "../../libs/Queue";
import SendMessageSystemProxy from "../../helpers/SendMessageSystemProxy";
import Contact from "../../models/Contact";
import UserMessagesLog from "../../models/UserMessagesLog";
import AppError from "../../errors/AppError";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";

const writeFileAsync = promisify(fs.writeFile);

interface MessageData {
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  mediaName?: string;
  originalName?: string;
  timestamp?: number;
  internalId?: string;
  userId?: string | number;
  quotedMsgId?: string;
  quotedMsg?: any;
  scheduleDate?: string | Date;
  sendType?: string;
  status?: string;
  idFront?: string;
  id?: string;
  tenantId: string | number;
  ack?: number;
  messageId?: string;
}

interface MessageRequest {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  messageId?: string;
}

interface Request {
  msg: MessageRequest | any;
  scheduleDate?: string | Date;
  sendType: string;
  status: string;
  tenantId: string | number;
  medias?: Express.Multer.File[];
  ticket: Ticket;
  userId?: number | string;
  idFront?: string;
}

interface CustomFile extends Express.Multer.File {
  mediaType?: string;
}

const downloadMedia = async (msg: any): Promise<any> => {
  try {
    // Verificar se a URL de mídia é válida
    if (!msg.mediaUrl) {
      throw new Error('No media URL provided');
    }

    const request = await axios.get(msg.mediaUrl, {
      responseType: "stream",
      timeout: 30000, // 30 segundos de timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MediaDownloader/1.0)'
      }
    });
    
    const cType = request.headers["content-type"];
    if (!cType) {
      throw new Error('No content-type header received');
    }
    
    const tMine: any = mime;
    const fileExt = tMine.extension(cType) || 'bin';
    const mediaName = uuidv4();
    const dir = join(__dirname, "..", "..", "..", "public");
    
    // Verificar se o diretório existe, criar se necessário
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const fileName = `${mediaName}.${fileExt}`;
    const mediaPath = join(dir, fileName);
    const mediaData = {
      originalname: fileName,
      filename: fileName,
      mediaType: fileExt
    };
    await new Promise((resolve, reject) => {
      request.data
        .pipe(fs.createWriteStream(mediaPath))
        .on("finish", async () => {
          resolve(mediaData);
        })
        .on("error", (error: any) => {
          console.error("ERROR DOWNLOAD", error.message || 'Unknown error');
          // Tentar remover o arquivo se existir
          try {
            if (fs.existsSync(mediaPath)) {
              fs.unlinkSync(mediaPath);
            }
          } catch (unlinkError) {
            console.error("Error removing failed download file:", unlinkError.message);
          }
          reject(new Error(error));
        });
    });
    return mediaData;
  } catch (error) {
    if (error.response.status === 404) {
      const payload = {
        ack: -1,
        body: msg.body,
        messageId: "",
        number: msg.number,
        externalKey: msg.externalKey,
        error: error.message,
        authToken: msg.apiConfig.authToken,
        type: "hookMessageStatus"
      };
      if (msg?.apiConfig?.urlMessageStatus) {
        Queue.add("WebHooksAPI", {
          url: msg.apiConfig.urlMessageStatus,
          type: payload.type,
          payload
        });
      }
      return {};
    }
    throw new Error(error);
  }
};

const CreateMessageSystemService = async ({
  msg,
  tenantId,
  ticket,
  userId,
  medias,
  sendType,
  scheduleDate,
  status,
  idFront
}: Request): Promise<void> => {
  try {
    // Buscar a mensagem citada para obter o messageId do WhatsApp
    let quotedMsgMessageId: string | undefined;
    if (msg.quotedMsg?.id) {
      const quotedMessage = await Message.findByPk(msg.quotedMsg.id);
      if (quotedMessage) {
        quotedMsgMessageId = quotedMessage.messageId;
        logger.info(`[CreateMessageSystemService] Found quoted message WhatsApp ID: ${quotedMsgMessageId}`);
      }
    }

    const baseMessageData: MessageData = {
      ticketId: ticket.id,
      body: msg.body,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      mediaType: "chat",
      mediaUrl: undefined,
      timestamp: new Date().getTime(),
      quotedMsgId: msg.quotedMsg?.id,  // Manter o ID interno para referência
      quotedMsg: { ...msg.quotedMsg, messageId: quotedMsgMessageId },  // Incluir o messageId do WhatsApp
      userId,
      scheduleDate,
      sendType,
      status: status || "pending",
      idFront,
      tenantId,
      ack: 0,
      messageId: msg.messageId || null
    };

    if (medias && medias.length > 0) {
      await processMediaMessages(medias, baseMessageData, ticket, tenantId, userId);
    } else {
      await processTextMessage(baseMessageData, ticket, tenantId, userId);
    }

  } catch (error) {
    logger.error(`[CreateMessageSystemService] Erro ao criar mensagem:`, error.message || 'Erro desconhecido');
    logger.error(`[CreateMessageSystemService] Stack trace:`, error.stack);
    throw new Error(`Erro ao criar mensagem: ${error.message || 'Erro desconhecido'}`);
  }
};

const processMediaMessages = async (
  medias: CustomFile[],
  messageData: MessageData,
  ticket: Ticket,
  tenantId: string | number,
  userId?: string | number
): Promise<void> => {
  await Promise.all(
    medias.map(async (media: CustomFile, index: number) => {
      try {
        // Preparar arquivo
        if (!media.filename) {
          const ext = media.mimetype.split("/")[1].split(";")[0];
          media.filename = `${new Date().getTime()}_${index}.${ext}`;
        }

        await writeFileAsync(
          join(__dirname, "..", "..", "..", "..", "public", media.filename),
          media.buffer,
          "base64"
        );

        // Preparar dados da mensagem de mídia
        const mediaMessageData = {
          ...messageData,
          mediaType: media.mimetype.split("/")[0],
          mediaName: media.filename,
          originalName: media.originalname,
          body: media.originalname,
          mediaUrl: media.filename,
          userId
        };

        // Enviar mensagem e obter a mensagem criada
        let sentMessage: any = {};
        if (!mediaMessageData.scheduleDate) {
          sentMessage = await SendWhatsAppMedia({ media, ticket, userId });
        } else {
          // Se for mensagem agendada, criar sem enviar
          sentMessage = await Message.create({
            ...mediaMessageData,
            status: "pending",
            messageId: null,
            ack: 0
          });
        }

        // Buscar mensagem completa e notificar
        await finalizeMessage(sentMessage.id, ticket, tenantId);

        // Registrar atividade do usuário se houver userId
        if (userId) {
          await UserMessagesLog.create({
            messageId: sentMessage.id,
            userId,
            tenantId
          });
        }

      } catch (err) {
        logger.error(`[CreateMessageSystemService] Error processing media ${index}:`, err);
        throw err;
      }
    })
  );
};

const processTextMessage = async (
  messageData: MessageData,
  ticket: Ticket,
  tenantId: string | number,
  userId?: string | number
): Promise<void> => {
  try {
    // Verificar se o ticket tem whatsappId
    if (!ticket.whatsappId) {
      logger.error(`[CreateMessageSystemService] Ticket ${ticket.id} has no whatsappId`);
      throw new AppError("ERR_TICKET_NO_WHATSAPP_ID");
    }

    // Buscar o contato
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      logger.error(`[CreateMessageSystemService] Contact not found for ticket ${ticket.id}`);
      throw new AppError("ERR_CONTACT_NOT_FOUND");
    }

    // Enviar mensagem e obter a mensagem criada
    let sentMessage: any = {};
    if (!messageData.scheduleDate) {
      const quotedMsg = messageData?.quotedMsg?.id ? 
        (await Message.findByPk(messageData.quotedMsg.id)) as Message | undefined : 
        undefined;

      sentMessage = await SendWhatsAppMessage(
        contact,
        ticket,
        messageData.body,
        quotedMsg
      );
    } else {
      // Se for mensagem agendada, criar sem enviar
      sentMessage = await Message.create({
        ...messageData,
        status: "pending",
        messageId: null,
        ack: 0,
        mediaType: "chat",
        userId
      });
    }

    // Buscar mensagem completa e notificar
    await finalizeMessage(sentMessage.id, ticket, tenantId);

    // Registrar atividade do usuário se houver userId
    if (userId) {
      await UserMessagesLog.create({
        messageId: sentMessage.id,
        userId,
        tenantId
      });
    }

  } catch (error) {
    logger.error(`[CreateMessageSystemService] Erro ao processar mensagem de texto:`, error.message || 'Erro desconhecido');
    logger.error(`[CreateMessageSystemService] Stack trace:`, error.stack);
    throw new Error(`Erro ao processar mensagem de texto: ${error.message || 'Erro desconhecido'}`);
  }
};

const extractMessageId = (sentMessage: any, fallbackId?: string): string | null => {
  // Tentar extrair messageId de diferentes estruturas de retorno
  const messageId = sentMessage?.id?.id || 
                   sentMessage?.messageId || 
                   sentMessage?.key?.id ||
                   sentMessage?.id ||
                   fallbackId ||
                   null;

  return messageId;
};

const finalizeMessage = async (
  messageId: string,
  ticket: Ticket,
  tenantId: string | number
): Promise<void> => {
  try {
    // Buscar mensagem completa
    const messageCreated = await Message.findByPk(messageId, {
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

    if (!messageCreated) {
      throw new Error("ERR_CREATING_MESSAGE_SYSTEM");
    }

    // Atualizar ticket
    await ticket.update({
      lastMessage: messageCreated.body,
      lastMessageAt: new Date().getTime(),
      answered: true
    });

    // Emitir eventos para o frontend
    socketEmit({
      tenantId,
      type: "chat:create",
      payload: messageCreated
    });

    // Emitir evento de status usando chat:ack que é um tipo válido
    socketEmit({
      tenantId,
      type: "chat:ack",
      payload: {
        id: messageCreated.id,
        messageId: messageCreated.messageId,
        ack: messageCreated.ack,
        status: messageCreated.status,
        fromMe: messageCreated.fromMe,
        ticket: {
          id: ticket.id,
          status: ticket.status,
          unreadMessages: ticket.unreadMessages,
          answered: ticket.answered
        }
      }
    });

  } catch (err) {
    logger.error(`[CreateMessageSystemService] Error finalizing message:`, err);
    throw err;
  }
};

export default CreateMessageSystemService;