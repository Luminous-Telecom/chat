/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";
import { getWbot } from "../libs/wbot";

export default {
  key: "SendMessageWhatsappBusinessHours",
  options: {
    delay: 60000,
    attempts: 10,
    backoff: {
      type: "fixed",
      delay: 60000 * 5 // 5 min
    }
  },
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async handle({ data }: any) {
    try {
      const wbot = getWbot(data.ticket.whatsappId);
      const message = await wbot.sendMessage(
        `${data.ticket.contact.number}@${data.ticket.isGroup ? "g" : "s"}.whatsapp.net`,
        { text: data.tenant.messageBusinessHours }
      );

      const result = {
        message,
        messageBusinessHours: data.tenant.messageBusinessHours,
        ticket: data.ticket
      };

      return result;
    } catch (error) {
      logger.error(`Error enviar message business hours: ${error}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Send WhatsApp business hours message job failed: ${error.message || error}`, 500);
    }
  }
};
