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
import { GetSessionStatus } from "../WbotServices/StartWhatsAppSession";
import GetTicketWbot from "../../helpers/GetTicketWbot";

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// Função para dividir mensagens muito grandes
const splitLargeMessage = (
  body: string,
  maxLength = 4096
): string[] => {
  if (body.length <= maxLength) {
    return [body];
  }

  const messages: string[] = [];
  let currentMessage = '';
  const lines = body.split('\n');

  for (const line of lines) {
    // Se a linha individual é maior que o limite, dividir por palavras
    if (line.length > maxLength) {
      const words = line.split(' ');
      for (const word of words) {
        if ((currentMessage + word).length > maxLength) {
          if (currentMessage.trim()) {
            messages.push(currentMessage.trim());
            currentMessage = word + ' ';
          } else {
            // Palavra individual muito grande, dividir por caracteres
            for (let i = 0; i < word.length; i += maxLength) {
              messages.push(word.substring(i, i + maxLength));
            }
            currentMessage = '';
          }
        } else {
          currentMessage += word + ' ';
        }
      }
    } else {
      const newMessageLength = currentMessage.length + line.length + 1; // +1 para '\n'
      
      if (newMessageLength > maxLength) {
        if (currentMessage.trim()) {
          messages.push(currentMessage.trim());
          currentMessage = `${line}\n`;
        } else {
          currentMessage = `${line}\n`;
        }
      } else {
        currentMessage = `${currentMessage}${line}\n`;
      }
    }
  }

  // Adicionar a última mensagem se houver conteúdo
  if (currentMessage.trim()) {
    messages.push(currentMessage.trim());
  }

  return messages;
};

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
      throw new Error("No media URL provided");
    }

    const request = await axios.get(msg.mediaUrl, {
      responseType: "stream",
      timeout: 30000, // 30 segundos de timeout
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MediaDownloader/1.0)",
      },
    });

    const cType = request.headers["content-type"];
    if (!cType) {
      throw new Error("No content-type header received");
    }

    const tMine: any = mime;
    const fileExt = tMine.extension(cType) || "bin";
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
      mediaType: fileExt,
    };
    await new Promise((resolve, reject) => {
      request.data
        .pipe(fs.createWriteStream(mediaPath))
        .on("finish", async () => {
          resolve(mediaData);
        })
        .on("error", (error: any) => {
          console.error("ERROR DOWNLOAD", error.message || "Unknown error");
          // Tentar remover o arquivo se existir
          try {
            if (fs.existsSync(mediaPath)) {
              fs.unlinkSync(mediaPath);
            }
          } catch (unlinkError) {
            console.error(
              "Error removing failed download file:",
              unlinkError.message
            );
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
        type: "hookMessageStatus",
      };
      if (msg?.apiConfig?.urlMessageStatus) {
        Queue.add("WebHooksAPI", {
          url: msg.apiConfig.urlMessageStatus,
          type: payload.type,
          payload,
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
  idFront,
}: Request): Promise<void> => {
  try {
    // Buscar a mensagem citada para obter o messageId do WhatsApp
    let quotedMsgMessageId: string | undefined;
    if (msg.quotedMsg?.id) {
      const quotedMessage = await Message.findByPk(msg.quotedMsg.id);
      if (quotedMessage) {
        quotedMsgMessageId = quotedMessage.messageId || undefined;
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
      quotedMsgId: msg.quotedMsgId || msg.quotedMsg?.id || undefined,
      userId,
      scheduleDate,
      sendType,
      status: scheduleDate ? "pending" : "sended",
      idFront,
      tenantId,
      ack: scheduleDate ? 0 : 1,
      messageId: msg.messageId || null,
    };

    if (medias && medias.length > 0) {
      await processMediaMessages(
        medias,
        baseMessageData,
        ticket,
        tenantId,
        userId
      );
    } else {
      await processTextMessage(baseMessageData, ticket, tenantId, userId);
    }
  } catch (error) {
    logger.error(
      "[CreateMessageSystemService] Erro ao criar mensagem:",
      error.message || "Erro desconhecido"
    );
    logger.error("[CreateMessageSystemService] Stack trace:", error.stack);
    throw new Error(
      `Erro ao criar mensagem: ${error.message || "Erro desconhecido"}`
    );
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

        // Garantir que o diretório public/sent existe
        const sentDir = join(__dirname, "..", "..", "..", "public", "sent");
        try {
          await mkdirAsync(sentDir, { recursive: true });
        } catch (err) {
          logger.error(
            "[CreateMessageSystemService] Error creating sent directory:",
            err
          );
          // Se não conseguir criar o diretório, tentar usar o diretório temporário
          const tempDir = join(process.cwd(), "backend", "public", "sent");
          await mkdirAsync(tempDir, { recursive: true });
          media.path = join(tempDir, media.filename);
        }

        // Só salvar o arquivo se não tivermos o buffer
        if (!media.buffer && media.path) {
          const filePath = join(sentDir, media.filename);
          await writeFileAsync(filePath, fs.readFileSync(media.path), "binary");
          media.path = filePath; // Atualizar o path para o novo local
        }

        // Preparar dados da mensagem de mídia
        const mediaMessageData = {
          ...messageData,
          mediaType: media.mimetype.split("/")[0],
          mediaName: media.filename,
          originalName: media.originalname,
          body: media.filename, // Usar apenas o filename sem prefixo
          mediaUrl: `sent/${media.filename}`, // Manter sent/ apenas na URL interna
          userId: typeof userId === 'string' ? parseInt(userId, 10) : userId,
        };

        // Enviar mensagem e obter a mensagem criada
        let sentMessage: any = {};
        if (!mediaMessageData.scheduleDate) {
          const contact = await Contact.findByPk(ticket.contactId);
          if (!contact) {
            throw new AppError("ERR_CONTACT_NOT_FOUND");
          }
          sentMessage = await SendWhatsAppMedia(
            media,
            contact.number,
            ticket,
            media.filename // Usar apenas o filename sem prefixo
          );
        } else {
          // Se for mensagem agendada, criar sem enviar
          sentMessage = await Message.create({
            ...mediaMessageData,
            status: "pending",
            messageId: null,
            ack: 0,
          } as any);
        }

        // Extrair o ID da mensagem
        const messageId = sentMessage.id?.id || sentMessage.id;
        if (!messageId) {
          throw new Error("ERR_MESSAGE_ID_NOT_FOUND");
        }

        // Buscar mensagem completa e notificar
        await finalizeMessage(messageId, ticket, tenantId);

        // Registrar atividade do usuário se houver userId
        if (userId) {
          await UserMessagesLog.create({
            messageId,
            userId: Number(userId),
          } as any);
        }
      } catch (err) {
        logger.error(
          `[CreateMessageSystemService] Error processing media ${index}:`,
          err
        );
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
    // Buscar o contato
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      logger.error(
        `[CreateMessageSystemService] Contact not found for ticket ${ticket.id}`
      );
      throw new AppError("ERR_CONTACT_NOT_FOUND");
    }

    // Dividir mensagem se for muito grande
    const messageParts = splitLargeMessage(messageData.body);

    // Enviar cada parte da mensagem
    for (let i = 0; i < messageParts.length; i++) {
      const partBody = messageParts[i];
      const isLastPart = i === messageParts.length - 1;
      
      // Criar dados da mensagem para esta parte
      const partMessageData = {
        ...messageData,
        // Adicionar indicador de parte se houver múltiplas partes
        body: messageParts.length > 1 ? `(${i + 1}/${messageParts.length}) ${partBody}` : partBody,
      };

      let sentMessage: any = {};
      if (!messageData.scheduleDate) {
        // Buscar o objeto da mensagem citada usando quotedMsgId (apenas na primeira parte)
        let quotedMsg: Message | undefined;
        if (messageData.quotedMsgId && i === 0) {
          const found = await Message.findByPk(messageData.quotedMsgId);
          if (found) quotedMsg = found;
        }

        sentMessage = await SendWhatsAppMessage(
          contact,
          ticket,
          partMessageData.body,
          quotedMsg,
          undefined, // media parameter
          userId // userId parameter para adicionar assinatura
        );
      } else {
        // Se for mensagem agendada, criar sem enviar
        sentMessage = await Message.create({
          ...partMessageData,
          status: "pending",
          messageId: null,
          ack: 0,
          mediaType: "chat",
          userId: typeof userId === 'string' ? parseInt(userId, 10) : userId,
        } as any);
      }

      // Extrair o ID da mensagem
      const messageId = sentMessage.id?.id || sentMessage.id;
      if (!messageId) {
        throw new Error("ERR_MESSAGE_ID_NOT_FOUND");
      }

      // Buscar mensagem completa e notificar
      await finalizeMessage(messageId, ticket, tenantId);

      // Registrar atividade do usuário se houver userId
      if (userId) {
        await UserMessagesLog.create({
          messageId,
          userId: typeof userId === 'string' ? parseInt(userId, 10) : userId,
          tenantId,
        } as any);
      }

      // Pequena pausa entre mensagens para evitar spam
      if (!isLastPart && !messageData.scheduleDate) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    logger.error(
      "[CreateMessageSystemService] Erro ao processar mensagem de texto:",
      error.message || "Erro desconhecido"
    );
    logger.error("[CreateMessageSystemService] Stack trace:", error.stack);
    throw new Error(
      `Erro ao processar mensagem de texto: ${
        error.message || "Erro desconhecido"
      }`
    );
  }
};

const finalizeMessage = async (
  messageId: string | number,
  ticket: Ticket,
  tenantId: string | number
): Promise<void> => {
  try {
    // Garantir que messageId é uma string ou número
    const id = String(messageId);

    // Buscar mensagem completa
    const messageCreated = await Message.findByPk(id, {
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
          include: ["contact"],
        },
        {
          model: require("../../models/User").default,
          as: "user",
          attributes: ["id", "name", "email", "profilePicUrl"]
        }
      ],
    });

    if (!messageCreated) {
      throw new Error("ERR_CREATING_MESSAGE_SYSTEM");
    }

    // Atualizar ticket com lastMessage limpo
    let cleanLastMessage = messageCreated.body;
    if (cleanLastMessage && cleanLastMessage.startsWith('sent/')) {
      cleanLastMessage = cleanLastMessage.replace('sent/', '');
    }
    
    await ticket.update({
      lastMessage: cleanLastMessage,
      lastMessageAt: new Date().getTime(),
      lastMessageAck: messageCreated.fromMe ? 1 : 0, // Se enviado por nós, ACK inicial é 1 (enviado)
      lastMessageFromMe: messageCreated.fromMe,
      answered: true,
    });

    // Emitir eventos para o frontend
    socketEmit({
      tenantId,
      type: "chat:create",
      payload: messageCreated,
    });

    // Emitir evento de ACK
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
          answered: ticket.answered,
        },
      },
    });
  } catch (err) {
    logger.error("[CreateMessageSystemService] Error finalizing message:", err);
    throw err;
  }
};

export default CreateMessageSystemService;
