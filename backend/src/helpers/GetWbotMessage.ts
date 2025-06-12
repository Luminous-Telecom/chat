import { BaileysMessage } from '../types/baileys';
import Ticket from "../models/Ticket";
import GetTicketWbot from "./GetTicketWbot";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";

export const GetWbotMessage = async (
  ticket: Ticket,
  messageId: string,
  totalMessages = 100
): Promise<BaileysMessage | undefined> => {
  const wbot = await GetTicketWbot(ticket);
  const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

  const fetchWbotMessagesGradually = async (): Promise<BaileysMessage | undefined> => {
    try {
      // Buscar mensagens do histórico usando o método fetchMessages do Baileys
      const messages = await (wbot as any).fetchMessages(chatId, totalMessages);
      
      // Procurar a mensagem específica pelo ID
      const msgFound = messages.find((msg: BaileysMessage) => msg.key.id === messageId);
      
      if (msgFound) {
        logger.info(`[GetWbotMessage] Message found in history: ${messageId}`);
        return msgFound;
      }

      logger.warn(`[GetWbotMessage] Message not found in history: ${messageId}`);
      return undefined;
    } catch (error) {
      logger.error('[GetWbotMessage] Error fetching message:', error);
      return undefined;
    }
  };

  try {
    const msgFound = await fetchWbotMessagesGradually();

    if (!msgFound) {
      logger.warn(`[GetWbotMessage] Cannot find message within ${totalMessages} last messages`);
      return undefined;
    }

    return msgFound;
  } catch (err) {
    logger.error('[GetWbotMessage] Error:', err);
    throw new AppError("ERR_FETCH_WAPP_MSG");
  }
};

export default GetWbotMessage;
