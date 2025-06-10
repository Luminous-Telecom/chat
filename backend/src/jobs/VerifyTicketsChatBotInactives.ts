/* eslint-disable @typescript-eslint/no-explicit-any */
import FindUpdateTicketsInactiveChatBot from "../services/TicketServices/FindUpdateTicketsInactiveChatBot";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";

export default {
  key: "VerifyTicketsChatBotInactives",
  options: {
    // attempts: 0,
    removeOnComplete: false,
    removeOnFail: false,
    jobId: "VerifyTicketsChatBotInactives",
    repeat: {
      every: 5 * 60 * 1000
    }
  },
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async handle() {
    try {
      logger.info("FindUpdateTicketsInactiveChatBot Initiated");
      await FindUpdateTicketsInactiveChatBot();
      //logger.info("Finalized FindUpdateTicketsInactiveChatBot");
    } catch (error) {
      logger.error({ message: "Error send messages", error });
      if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Verify tickets chatbot inactives job failed: ${error.message || error}`, 500);
    }
  }
};
