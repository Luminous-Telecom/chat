/* eslint-disable @typescript-eslint/no-explicit-any */
import { join } from "path";
import { readFileSync } from "fs";
import { logger } from "../utils/logger";
import { getBaileysSession } from "../libs/baileys";
import CampaignContacts from "../models/CampaignContacts";

export default {
  key: "SendMessageWhatsappCampaign",
  options: {
    delay: 15000,
    attempts: 10,
    removeOnComplete: true,
    // removeOnFail: true,
    backoff: {
      type: "fixed",
      delay: 60000 * 5, // 5 min
    },
  },
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async handle({ data }: any) {
    try {
      /// feito por está apresentando problema com o tipo
      const wbot = getBaileysSession(data.whatsappId);

      if (!wbot) {
        throw new Error(
          `WhatsApp session not found for ID: ${data.whatsappId}`
        );
      }

      let message = {} as any;
      if (data.mediaUrl) {
        const customPath = join(__dirname, "..", "..", "public");
        const mediaPath = join(customPath, data.mediaName);
        const mediaBuffer = readFileSync(mediaPath);

        // Determine media type based on file extension
        const fileExtension = data.mediaName.split(".").pop()?.toLowerCase();
        let mediaType = "document";
        if (
          ["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension || "")
        ) {
          mediaType = "image";
        } else if (["mp4", "avi", "mov", "mkv"].includes(fileExtension || "")) {
          mediaType = "video";
        } else if (["mp3", "wav", "ogg", "m4a"].includes(fileExtension || "")) {
          mediaType = "audio";
        }

        const mediaMessage = {
          [mediaType]: mediaBuffer,
          caption: data.message,
          fileName: data.mediaName,
          mimetype: `${mediaType}/*`,
        };

        message = await wbot.sendMessage(`${data.number}@c.us`, mediaMessage);
      } else {
        message = await wbot.sendMessage(`${data.number}@c.us`, { text: data.message }, {
          quotedMessageId: undefined,
          linkPreview: false,
          sendAudioAsVoice: false,
        });
      }

      await CampaignContacts.update(
        {
          messageId: message?.key?.id || message?.id?.id || null,
          messageRandom: data.messageRandom,
          body: data.message,
          mediaName: data.mediaName,
          timestamp: message.timestamp,
          jobId: data.jobId,
        },
        { where: { id: data.campaignContact.id } }
      );

      return message;
    } catch (error) {
      logger.error(`Error enviar message campaign: ${error}`);
      throw new Error(error);
    }
  },
};
