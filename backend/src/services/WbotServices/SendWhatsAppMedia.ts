import fs from "fs";
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

const SendWhatsAppMedia = async ({
  media,
  ticket,
  userId
}: Request): Promise<any> => {
  try {
    const wbot = await GetTicketWbot(ticket);
    const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
    const fileBuffer = fs.readFileSync(media.path);
    const mimetype = mime.lookup(media.originalname) || undefined;
    const options: any = { caption: media.originalname };
    let content: any = {};

    if (mimetype && mimetype.toString().startsWith("image")) {
      content = { image: fileBuffer, mimetype, caption: media.originalname };
    } else if (mimetype && mimetype.toString().startsWith("video")) {
      content = { video: fileBuffer, mimetype, caption: media.originalname };
    } else if (mimetype && mimetype.toString().startsWith("audio")) {
      content = { audio: fileBuffer, mimetype };
    } else {
      content = { document: fileBuffer, mimetype, fileName: media.originalname };
    }

    const sendMessage = await (wbot as any).sendMessage(chatId, content, options);

    // Atualizar o status da mensagem para enviada
    const messageToUpdate = await Message.findOne({
      where: {
        ticketId: ticket.id,
        status: "pending"
      },
      order: [["createdAt", "DESC"]]
    });

    if (messageToUpdate) {
      await messageToUpdate.update({
        messageId: sendMessage.id.id,
        status: "sended",
        ack: 2
      });
    }

    await ticket.update({
      lastMessage: media.filename,
      lastMessageAt: new Date().getTime()
    });
    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sendMessage.id.id,
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error criar log mensagem ${error}`);
    }
    fs.unlinkSync(media.path);

    return sendMessage;
  } catch (err) {
    logger.error(`SendWhatsAppMedia | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
