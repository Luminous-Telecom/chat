import { BaileysMessage } from '../types/baileys';
import Ticket from "../models/Ticket";
import GetTicketWbot from "./GetTicketWbot";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { proto } from "@whiskeysockets/baileys";

export const GetWbotMessage = async (
  ticket: Ticket,
  messageId: string,
  totalMessages = 100
): Promise<BaileysMessage | undefined> => {
  const wbot = await GetTicketWbot(ticket);
  const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

  try {
    // Get message from Baileys' message store
    const messageStore = (wbot as any).store?.messages?.get(chatId);
    if (!messageStore) {
      logger.warn(`[GetWbotMessage] No message store found for chat ${chatId}`);
      return undefined;
    }

    // Try to get the specific message
    const message = messageStore.get(messageId) as BaileysMessage | undefined;
    if (message) {
      logger.info(`[GetWbotMessage] Message found in store: ${messageId}`);
      return message;
    }

    // If not found directly, search in recent messages
    const messages = Array.from(messageStore.values()) as BaileysMessage[];
    const sortedMessages = messages
      .sort((a, b) => {
        const timestampA = Number(a.messageTimestamp) || 0;
        const timestampB = Number(b.messageTimestamp) || 0;
        return timestampB - timestampA;
      })
      .slice(0, totalMessages);

    const msgFound = sortedMessages.find(msg => msg.key.id === messageId);
    
    if (msgFound) {
      logger.info(`[GetWbotMessage] Message found in recent messages: ${messageId}`);
      return msgFound;
    }

    logger.warn(`[GetWbotMessage] Cannot find message ${messageId} in store or recent messages`);
    return undefined;
  } catch (err) {
    logger.error(`[GetWbotMessage] Error: ${err}`);
    throw new AppError("ERR_FETCH_WAPP_MSG");
  }
};

export default GetWbotMessage;
