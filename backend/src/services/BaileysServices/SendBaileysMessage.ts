import { WASocket, proto } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";

interface Session extends WASocket {
  id: number;
}

interface Request {
  ticket: Ticket;
  body: string;
  quotedMsg?: Message;
  userId?: number;
}

const SendBaileysMessage = async ({
  ticket,
  body,
  quotedMsg,
  userId,
}: Request): Promise<any> => {
  const wbot = await GetTicketWbot(ticket);

  try {
    const chatId = `${ticket.contact.number}@${
      ticket.isGroup ? "g" : "s"
    }.whatsapp.net`;

    const messageOptions: any = {
      quoted: quotedMsg
        ? {
            key: {
              remoteJid: chatId,
              id: quotedMsg.messageId,
            },
          }
        : undefined,
    };

    const sendMessage = await wbot.sendMessage(
      chatId,
      { text: body },
      messageOptions
    );

    await ticket.update({
      lastMessage: body,
      lastMessageAt: new Date().getTime(),
    });

    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sendMessage.key.id,
          userId,
          ticketId: ticket.id,
        });
      }
    } catch (error) {
      logger.error(`Error criar log mensagem ${error}`);
    }

    return sendMessage as proto.WebMessageInfo;
  } catch (err) {
    logger.error(`SendBaileysMessage | Error: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendBaileysMessage;
