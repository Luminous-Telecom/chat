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
      // Para Baileys, precisamos implementar uma busca de mensagem diferente
      // Por enquanto, retornamos undefined pois o método específico para buscar
      // mensagens históricas no Baileys requer implementação customizada
      logger.warn(`GetWbotMessage: Busca de mensagem ${messageId} não implementada para Baileys`);
      return undefined;
    } catch (error) {
      logger.error('Error fetching message:', error);
      return undefined;
    }
  };

  try {
    const msgFound = await fetchWbotMessagesGradually();

    if (!msgFound) {
      console.error(
        `Cannot found message within ${totalMessages} last messages`
      );
      return undefined;
    }

    return msgFound;
  } catch (err) {
    logger.error(err);
    throw new AppError("ERR_FETCH_WAPP_MSG");
  }
};

export default GetWbotMessage;
