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
    console.log(`[CAMPAIGN JOB] Sending to ${data.number}${data.mediaUrl ? ' with media' : ''}`);
    
    try {
      /// feito por está apresentando problema com o tipo
      const wbot = getBaileysSession(data.whatsappId);

      // Log simples do status da sessão
      console.log(`[CAMPAIGN JOB] Using session ${data.whatsappId}`);

      if (!wbot) {
        console.error(`[CAMPAIGN JOB] ❌ Session not available for ID: ${data.whatsappId}`);
        throw new Error(
          `WhatsApp session not found for ID: ${data.whatsappId}`
        );
      }

      // Verificar se a mensagem não está vazia
      if (!data.message || data.message.trim() === '') {
        console.error(`[CAMPAIGN JOB] ❌ Empty message for campaign job`);
        throw new Error('Message is empty or undefined');
      }

      let message = {} as any;
      if (data.mediaUrl) {
        const customPath = join(__dirname, "..", "..", "public");
        const mediaPath = join(customPath, data.mediaName);
        
        let mediaBuffer;
        try {
          mediaBuffer = readFileSync(mediaPath);
          console.log(`[CAMPAIGN JOB] Media file loaded: ${data.mediaName} (${mediaBuffer.length} bytes)`);
        } catch (fileError) {
          console.error(`[CAMPAIGN JOB] ❌ Error reading media file:`, fileError.message);
          throw new Error(`Media file not found: ${mediaPath}`);
        }

        // Determine media type and specific mimetype based on file extension
        const fileExtension = data.mediaName.split(".").pop()?.toLowerCase();
        let mediaType = "document";
        let mimetype = "application/octet-stream";
        
        if (["jpg", "jpeg"].includes(fileExtension || "")) {
          mediaType = "image";
          mimetype = "image/jpeg";
        } else if (fileExtension === "png") {
          mediaType = "image";
          mimetype = "image/png";
        } else if (fileExtension === "gif") {
          mediaType = "image";
          mimetype = "image/gif";
        } else if (fileExtension === "webp") {
          mediaType = "image";
          mimetype = "image/webp";
        } else if (fileExtension === "mp4") {
          mediaType = "video";
          mimetype = "video/mp4";
        } else if (["avi", "mov", "mkv"].includes(fileExtension || "")) {
          mediaType = "video";
          mimetype = "video/*";
        } else if (fileExtension === "mp3") {
          mediaType = "audio";
          mimetype = "audio/mpeg";
        } else if (["wav", "ogg", "m4a"].includes(fileExtension || "")) {
          mediaType = "audio";
          mimetype = "audio/*";
        }

        const mediaMessage = {
          [mediaType]: mediaBuffer,
          caption: data.message,
          fileName: data.mediaName,
          mimetype: mimetype,
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
          mediaName: data.mediaName || null,
          timestamp: message.timestamp,
          jobId: data.options?.jobId || data.jobId,
        },
        { where: { id: data.campaignContact.id } }
      );

      console.log(`[CAMPAIGN JOB] ✅ Sent to ${data.number} - ID: ${message?.key?.id || message?.id?.id}`);

      return message;
    } catch (error) {
      console.error(`[CAMPAIGN JOB] ❌ Failed to send to ${data.number}: ${error.message}`);
      
      // Atualizar o contato com erro (sem messageId)
      await CampaignContacts.update(
        {
          body: `ERROR: ${error.message}`,
          jobId: data.options?.jobId || data.jobId,
        },
        { where: { id: data.campaignContact.id } }
      );
      
      logger.error(`Error enviar message campaign: ${error}`);
      throw new Error(error);
    }
  },
};
