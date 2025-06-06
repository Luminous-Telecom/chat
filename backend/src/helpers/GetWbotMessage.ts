import { Message as WbotMessage } from "whatsapp-web.js";
import Ticket from "../models/Ticket";
import GetTicketWbot from "./GetTicketWbot";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { isSessionClosedError } from "./HandleSessionError";

export const GetWbotMessage = async (
  ticket: Ticket,
  messageId: string,
  totalMessages = 100
): Promise<WbotMessage | undefined> => {
  try {
    const wbot = await GetTicketWbot(ticket);

    // Verificar se a sessão ainda está ativa
    if (!wbot || !wbot.pupPage || wbot.pupPage.isClosed()) {
      logger.warn('WhatsApp session is closed, skipping getChatById operation');
      return undefined;
    }

    const wbotChat = await wbot.getChatById(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`
    );

  let limit = 20;

  const fetchWbotMessagesGradually = async (): Promise<void | WbotMessage> => {
    const chatMessages = await wbotChat.fetchMessages({ limit });

    const msgFound = chatMessages.find(msg => msg.id.id === messageId);

    if (!msgFound && limit < totalMessages) {
      limit += 20;
      return fetchWbotMessagesGradually();
    }

    return msgFound;
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
  } catch (error) {
    if (isSessionClosedError(error)) {
      logger.warn('Session closed during getChatById operation, ignoring error');
      return undefined;
    }
    logger.error('Error in GetWbotMessage:', error);
    throw error;
  }
};

export default GetWbotMessage;
