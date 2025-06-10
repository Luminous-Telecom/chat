/* eslint-disable @typescript-eslint/no-explicit-any */
import { join } from "path";
import { proto } from "@whiskeysockets/baileys";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";
import { getWbot } from "../libs/wbot";
import CampaignContacts from "../models/CampaignContacts";
import { readFileSync } from "fs";

export default {
  key: "SendMessageWhatsappCampaign",
  options: {
    delay: 15000,
    attempts: 10,
    removeOnComplete: true,
    // removeOnFail: true,
    backoff: {
      type: "fixed",
      delay: 60000 * 5 // 5 min
    }
  },
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async handle({ data }: any) {
    try {
      const wbot = getWbot(data.whatsappId);
      let message: proto.IWebMessageInfo | undefined;

      if (data.mediaUrl) {
        const customPath = join(__dirname, "..", "..", "public");
        const mediaPath = join(customPath, data.mediaName);
        const mediaData = readFileSync(mediaPath);
        const mimeType = data.mediaName.endsWith('.mp3') ? 'audio/mp3' : 
                        data.mediaName.endsWith('.mp4') ? 'video/mp4' :
                        data.mediaName.endsWith('.jpg') || data.mediaName.endsWith('.jpeg') ? 'image/jpeg' :
                        data.mediaName.endsWith('.png') ? 'image/png' :
                        'application/octet-stream';

        // Send as audio if it's an audio file, otherwise send as document
        if (mimeType.startsWith('audio/')) {
          message = await wbot.sendMessage(
            `${data.number}@s.whatsapp.net`,
            { 
              audio: mediaData,
              mimetype: mimeType,
              ptt: true, // send as voice note
              caption: data.message
            }
          );
        } else {
          message = await wbot.sendMessage(
            `${data.number}@s.whatsapp.net`,
            { 
              document: mediaData,
              mimetype: mimeType,
              fileName: data.mediaName,
              caption: data.message
            }
          );
        }
      } else {
        message = await wbot.sendMessage(
          `${data.number}@s.whatsapp.net`,
          { text: data.message }
        );
      }

      if (!message) {
        throw new AppError("Failed to send message", 500);
      }

      await CampaignContacts.update(
        {
          messageId: message.key.id,
          messageRandom: data.messageRandom,
          body: data.message,
          mediaName: data.mediaName,
          timestamp: message.messageTimestamp,
          jobId: data.jobId
        },
        { where: { id: data.campaignContact.id } }
      );

      return message;
    } catch (error) {
      logger.error(`Error enviar message campaign: ${error}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Send WhatsApp campaign message job failed: ${error.message || error}`, 500);
    }
  }
};
