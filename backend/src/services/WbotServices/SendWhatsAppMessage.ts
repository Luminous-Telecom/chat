import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import SerializeWbotMsgId from "../../helpers/SerializeWbotMsgId";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UserMessagesLog from "../../models/UserMessagesLog";
import { logger } from "../../utils/logger";
// import { StartWhatsAppSessionVerify } from "./StartWhatsAppSessionVerify";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  userId?: number | string | undefined;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  userId
}: Request): Promise<WbotMessage> => {
  let quotedMsgSerializedId: string | undefined;
  if (quotedMsg) {
    await GetWbotMessage(ticket, quotedMsg.id);
    quotedMsgSerializedId = SerializeWbotMsgId(ticket, quotedMsg);
  }

  const wbot = await GetTicketWbot(ticket);

  try {
    const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
    const messageOptions = {
      quoted: quotedMsgSerializedId ? {
        key: {
          remoteJid: chatId,
          id: quotedMsgSerializedId
        }
      } : undefined,
      linkPreview: false
    };

    const sendMessage = await wbot.sendMessage(
      chatId,
      { text: body },
      messageOptions
    );

    await ticket.update({
      lastMessage: body,
      lastMessageAt: new Date().getTime()
    });

    try {
      if (userId) {
        await UserMessagesLog.create({
          messageId: sendMessage.key.id,
          userId,
          ticketId: ticket.id
        });
      }
    } catch (error) {
      logger.error(`Error criar log mensagem ${error}`);
    }

    return sendMessage;
  } catch (err) {
    logger.error(`SendWhatsAppMessage | Error: ${err}`);
    // await StartWhatsAppSessionVerify(ticket.whatsappId, err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
