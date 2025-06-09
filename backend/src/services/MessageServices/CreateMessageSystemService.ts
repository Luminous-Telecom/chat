/* eslint-disable prefer-destructuring */
import fs from "fs";
// import { promisify } from "util";
import { join } from "path";
import axios from "axios";
import mime from "mime";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger";
// import MessageOffLine from "../../models/MessageOffLine";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import socketEmit from "../../helpers/socketEmit";
import Queue from "../../libs/Queue";
import { pupa } from "../../utils/pupa";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { getInstaBot } from "../../libs/InstaBot";
import InstagramSendMessagesSystem from "../InstagramBotServices/InstagramSendMessagesSystem";
import TelegramSendMessagesSystem from "../TbotServices/TelegramSendMessagesSystem";
import { getTbot } from "../../libs/tbot";
import SendMessageSystemProxy from "../../helpers/SendMessageSystemProxy";

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
  // status?: string;
  scheduleDate?: string | Date;
  sendType?: string;
  status?: string;
  idFront?: string;
  id?: string;
  tenantId: string | number;
}

interface MessageRequest {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
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

// const writeFileAsync = promisify(writeFile);

const downloadMedia = async (msg: any): Promise<any> => {
  try {
    const request = await axios.get(msg.mediaUrl, {
      responseType: "stream"
    });
    const cType = request.headers["content-type"];
    const tMine: any = mime;
    const fileExt = tMine.extension(cType);
    const mediaName = uuidv4();
    const dir = join(__dirname, "..", "..", "..", "public");
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
          console.error("ERROR DONWLOAD", error);
          fs.rmdirSync(mediaPath, { recursive: true });
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
  medias,
  ticket,
  userId,
  scheduleDate,
  sendType,
  status,
  idFront
}: Request): Promise<void> => {
  const messageData: MessageData = {
    ticketId: ticket.id,
    body: Array.isArray(msg.body) ? undefined : msg.body,
    contactId: ticket.contactId,
    fromMe: sendType === "API" ? true : msg?.fromMe,
    read: true,
    mediaType: "chat",
    mediaUrl: undefined,
    mediaName: undefined,
    originalName: undefined,
    timestamp: new Date().getTime(),
    quotedMsgId: msg?.quotedMsg?.id,
    quotedMsg: msg?.quotedMsg,
    userId,
    scheduleDate,
    sendType,
    status,
    tenantId,
    idFront
  };

  try {
    // Alter template message
    if (msg.body && !Array.isArray(msg.body)) {
      messageData.body = pupa(msg.body || "", {
        // greeting: será considerado conforme data/hora da mensagem internamente na função pupa
        protocol: ticket.protocol,
        name: ticket.contact.name
      });
    }
    if (sendType === "API" && msg.mediaUrl) {
      medias = [];
      const mediaData = await downloadMedia(msg);
      medias.push(mediaData);
    }

    if (sendType === "API" && !msg.mediaUrl && msg.media) {
      medias = [];
      medias.push(msg.media);
    }

    if (medias) {
      logger.info(`Processing ${medias.length} media files`);
      await Promise.all(
        medias.map(async (media: Express.Multer.File | any) => {
          try {
            logger.info(`Processing media: ${JSON.stringify({
              originalname: media.originalname,
              filename: media.filename,
              mimetype: media.mimetype,
              path: media.path,
              size: media.size
            })}`);
            
            if (!media.filename) {
              const ext = media.mimetype.split("/")[1].split(";")[0];
              media.filename = `${new Date().getTime()}.${ext}`;
            }
          } catch (err) {
            logger.error(`Error processing media filename: ${err}`);
          }

          messageData.mediaType = media.mimetype.split("/")[0];
          messageData.mediaName = media.filename;
          messageData.originalName = media.originalname;

          let message: any = {};

          if (!messageData.scheduleDate) {
            /// enviar mensagem > run time
            logger.info(`Sending message via proxy for ticket ${ticket.id}`);
            try {
              message = await SendMessageSystemProxy({
                ticket,
                messageData,
                media,
                userId
              });
              logger.info(`Message sent successfully: ${JSON.stringify(message)}`);
            } catch (proxyError) {
              logger.error(`Error in SendMessageSystemProxy: ${proxyError}`);
              throw proxyError;
            }
            ///
          }

          logger.info(`Creating message in database with data: ${JSON.stringify({
            ...messageData,
            userId,
            messageId: message.id?._serialized || message.messageId || null,
            body: media.originalname,
            mediaUrl: media.filename,
            mediaType: media.mediaType || media.mimetype.substr(0, media.mimetype.indexOf("/"))
          })}`);
          
          const msgCreated = await Message.create({
            ...messageData,
            userId,
            messageId: message.id?._serialized || message.messageId || null,
            body: media.originalname,
            mediaUrl: media.filename,
            mediaType: media.mediaType || media.mimetype.substr(0, media.mimetype.indexOf("/"))
          });
          
          logger.info(`Message created successfully with ID: ${msgCreated.id}`);

          const messageCreated = await Message.findByPk(msgCreated.id, {
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

          await ticket.update({
            lastMessage: messageCreated.body,
            lastMessageAt: new Date().getTime()
          });

          socketEmit({
            tenantId,
            type: "chat:create",
            payload: messageCreated
          });
        })
      );
    } else {
      let message: any = {};

      if (!messageData.scheduleDate) {
        /// enviar mensagem > run time
        message = await SendMessageSystemProxy({
          ticket,
          messageData,
          media: null,
          userId
        });
        ///
      }

      // Extract messageId properly - ensure it's a string
      let extractedMessageId = null;
      if (message.id) {
        if (typeof message.id === 'string') {
          extractedMessageId = message.id;
        } else if (message.id.id && typeof message.id.id === 'string') {
          extractedMessageId = message.id.id;
        } else if (message.id._serialized && typeof message.id._serialized === 'string') {
          extractedMessageId = message.id._serialized;
        }
      } else if (message.messageId && typeof message.messageId === 'string') {
        extractedMessageId = message.messageId;
      }

      const msgCreated = await Message.create({
        ...messageData,
        userId,
        messageId: extractedMessageId,
        mediaType: "chat"
      });

      const messageCreated = await Message.findByPk(msgCreated.id, {
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
        // throw new AppError("ERR_CREATING_MESSAGE", 501);
        throw new Error("ERR_CREATING_MESSAGE_SYSTEM");
      }

      await ticket.update({
        lastMessage: messageCreated.body,
        lastMessageAt: new Date().getTime(),
        answered: true
      });

      socketEmit({
        tenantId,
        type: "chat:create",
        payload: messageCreated
      });
    }
  } catch (error) {
    logger.error("CreateMessageSystemService", error);
    throw error;
  }
};

export default CreateMessageSystemService;
