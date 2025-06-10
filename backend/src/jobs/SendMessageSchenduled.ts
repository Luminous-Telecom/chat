/* eslint-disable @typescript-eslint/no-explicit-any */
import SendMessagesSchenduleWbot from "../services/WbotServices/SendMessagesSchenduleWbot";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";

export default {
  key: "SendMessageSchenduled",
  options: {
    // attempts: 0,
    removeOnComplete: false,
    removeOnFail: false,
    jobId: "SendMessageSchenduled",
    repeat: {
      every: 1 * 60 * 1000
    }
  },
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async handle() {
    try {
      //logger.info("SendMessageSchenduled Initiated");
      await SendMessagesSchenduleWbot();
      //logger.info("Finalized SendMessageSchenduled");
    } catch (error) {
      logger.error({ message: "Error send messages", error });
      if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Send scheduled message job failed: ${error.message || error}`, 500);
    }
  }
};
