import { WAMessage, proto } from "@whiskeysockets/baileys";
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
}: Request): Promise<WAMessage> => {
  let quotedMsgSerializedId: string | undefined;
  if (quotedMsg) {
    logger.info(`[SendWhatsAppMessage] Processing quoted message: ${quotedMsg.id}`);
    
    // Usar o messageId do WhatsApp diretamente da mensagem citada
    if (quotedMsg.messageId) {
      quotedMsgSerializedId = quotedMsg.messageId;
      logger.info(`[SendWhatsAppMessage] Using WhatsApp message ID directly: ${quotedMsgSerializedId}`);
    } else {
      // Fallback: tentar buscar no cache
      const inCache: WAMessage | undefined = await GetWbotMessage(
        ticket,
        quotedMsg.messageId,
        200
      );
      if (inCache) {
        quotedMsgSerializedId = inCache?.key?.id || undefined;
        logger.info(`[SendWhatsAppMessage] Quoted message found in cache. Serialized ID: ${quotedMsgSerializedId}`);
      } else {
        logger.info(`[SendWhatsAppMessage] Quoted message not found in cache`);
      }
    }
  }

  const wbot = await GetTicketWbot(ticket);

  try {
    const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
    logger.info(`[SendWhatsAppMessage] Preparing to send message to chatId: ${chatId}`);
    
    // Ajustando a estrutura do objeto quoted para o formato correto do Baileys
    const messageOptions = {
      quoted: quotedMsgSerializedId ? {
        key: {
          remoteJid: chatId,
          fromMe: true,
          id: quotedMsgSerializedId,
          participant: ticket.isGroup ? chatId : undefined
        },
        message: {
          conversation: body
        }
      } : undefined,
      linkPreview: false
    };
    
    logger.info(`[SendWhatsAppMessage] Message options: ${JSON.stringify(messageOptions)}`);
    
    const sentMessage = await wbot.sendMessage(chatId, { text: body }, messageOptions);
    
    // Extrair o ID da mensagem e status
    let messageId: string | undefined;
    let messageStatus: proto.WebMessageInfo.Status | undefined;
    
    if (sentMessage?.key?.id) {
      messageId = sentMessage.key.id;
    } else if (sentMessage?.id?.id) {
      messageId = sentMessage.id.id;
    } else if (typeof sentMessage === 'string') {
      messageId = sentMessage;
    }
    
    messageStatus = sentMessage?.status || undefined;
    
    logger.info(`[SendWhatsAppMessage] Message sent successfully. Raw response: ${JSON.stringify(sentMessage)}`);
    logger.info(`[SendWhatsAppMessage] Extracted message ID: ${messageId}, Status: ${messageStatus}`);

    // Atualizar o status da mensagem
    const messageToUpdate = await Message.findOne({
      where: {
        ticketId: ticket.id,
        fromMe: true,
        messageId: null
      },
      order: [["createdAt", "DESC"]]
    });

    if (messageToUpdate) {
      const updateData: any = {
        messageId: messageId,
        status: !messageStatus || messageStatus === proto.WebMessageInfo.Status.PENDING ? 'pending' : 'sended',
        ack: !messageStatus || messageStatus === proto.WebMessageInfo.Status.PENDING ? 1 : 2
      };
      
      logger.info(`[SendWhatsAppMessage] Updating message in database: ${JSON.stringify(updateData)}`);
      
      await messageToUpdate.update(updateData);

      if (userId) {
        await UserMessagesLog.create({
          messageId: messageId,
          userId,
          ticketId: ticket.id
        });
      }
      
      logger.info(`[SendWhatsAppMessage] Message updated in database. ID: ${messageToUpdate.id}, Status: ${updateData.status}`);
    } else {
      logger.warn(`[SendWhatsAppMessage] No pending message found to update for ticket ${ticket.id}`);
    }

    // Atualizar o ticket
    await ticket.update({
      lastMessage: body,
      lastMessageAt: new Date().getTime()
    });

    return sentMessage;
  } catch (err) {
    logger.error(`SendWhatsAppMessage | Error: ${err}`);
    logger.error(`SendWhatsAppMessage | Error stack: ${err.stack}`);
    throw new Error("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
