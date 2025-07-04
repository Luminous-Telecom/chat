/* eslint-disable @typescript-eslint/no-explicit-any */
import { join } from "path";
import { readFileSync } from "fs";
import { logger } from "../utils/logger";
import { getBaileysSession } from "../libs/baileys";
import CampaignContacts from "../models/CampaignContacts";
import { getIO } from "../libs/socket";

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
      if ((wbot as any).connection !== "open") {
        console.error(`[CAMPAIGN JOB] ❌ Session not connected for ID: ${data.whatsappId}`);
        throw new Error(`WhatsApp session not connected for ID: ${data.whatsappId}`);
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
          mimetype,
        };

        message = await wbot.sendMessage(`${data.number}@c.us`, mediaMessage);
      } else {
        message = await wbot.sendMessage(`${data.number}@c.us`, { text: data.message }, {
          quotedMessageId: undefined,
          linkPreview: false,
          sendAudioAsVoice: false,
        });
      }

      const messageId = message?.key?.id || message?.id?.id || null;
      
      // Buscar o registro único do contato e sobrescrever com a mensagem atual
      // USAR TRANSAÇÃO para evitar condições de corrida
      const sequelize = require('../database').default;
      const transaction = await sequelize.transaction();
      
      try {
        const campaignContact = await CampaignContacts.findOne({
          where: {
            campaignId: data.campaignContact.campaignId,
            contactId: data.campaignContact.contactId
          },
          lock: true, // Lock pessimista para evitar concorrência
          transaction
        });

        if (campaignContact) {
          // CORREÇÃO: Manter o ACK mais alto entre o atual e 1 (enviado)
          const currentAck = campaignContact.ack || 0;
          const newAck = Math.max(currentAck, 1); // Nunca diminuir o ACK
          
          console.log(`[CAMPAIGN JOB] 🔄 BEFORE UPDATE - Contact ${campaignContact.id}:`);
          console.log(`[CAMPAIGN JOB]    Current messageId: ${campaignContact.messageId}`);
          console.log(`[CAMPAIGN JOB]    Current messageRandom: ${campaignContact.messageRandom}`);
          console.log(`[CAMPAIGN JOB]    Current ACK: ${currentAck}`);
          console.log(`[CAMPAIGN JOB]    New messageId: ${messageId}`);
          console.log(`[CAMPAIGN JOB]    New messageRandom: ${data.messageRandom}`);
          console.log(`[CAMPAIGN JOB]    New ACK will be: ${newAck} (max of ${currentAck} and 1)`);
          
          await campaignContact.update({
            messageId,
            messageRandom: data.messageRandom, // Atualizar para a mensagem atual
            body: data.message,
            mediaName: data.mediaName || null,
            timestamp: message.timestamp,
            ack: newAck, // Manter o ACK mais alto
          }, { transaction });

          // Commit da transação
          await transaction.commit();

          console.log(`[CAMPAIGN JOB] ✅ AFTER UPDATE - Contact ${campaignContact.id}:`);
          console.log(`[CAMPAIGN JOB]    Final messageId: ${messageId}`);
          console.log(`[CAMPAIGN JOB]    Final messageRandom: ${data.messageRandom}`);
          console.log(`[CAMPAIGN JOB]    Final ACK: ${newAck} (COMMITTED)`);
          console.log(`[CAMPAIGN JOB]    ACK Change: ${currentAck} → ${newAck}`);
        } else {
          await transaction.rollback();
          console.error(`[CAMPAIGN JOB] CampaignContact not found for campaignId: ${data.campaignContact.campaignId}, contactId: ${data.campaignContact.contactId}`);
        }
      } catch (error) {
        await transaction.rollback();
        console.error(`[CAMPAIGN JOB] ❌ Transaction error:`, error);
        throw error;
      }

      // Emitir evento WebSocket para atualização em tempo real
      const io = getIO();
      const tenantId = data.campaignContact.campaign?.tenantId || 1;
      io.to(tenantId.toString()).emit(`${tenantId}:campaignUpdate`, {
        type: "campaign:ack",
        payload: {
          campaignId: data.campaignContact.campaignId,
          contactId: data.campaignContact.contactId,
          messageId,
          messageRandom: data.messageRandom,
          ack: 1,
          status: "sended",
          campaignContactId: data.campaignContact.id,
        },
      });

      console.log(`[CAMPAIGN JOB] Emitted socket event for campaign ${data.campaignContact.campaignId}, contact ${data.campaignContact.contactId}, message ${data.messageRandom}, ACK: 1`);

      console.log(`[CAMPAIGN JOB] ✅ Sent to ${data.number} - ID: ${message?.key?.id || message?.id?.id}`);

      return message;
    } catch (error) {
      console.error(`[CAMPAIGN JOB] ❌ Failed to send to ${data.number}: ${error.message}`);
      
      // Buscar o registro do contato e atualizar com erro
      const campaignContact = await CampaignContacts.findOne({
        where: {
          campaignId: data.campaignContact.campaignId,
          contactId: data.campaignContact.contactId
        }
      });

      if (campaignContact) {
        await campaignContact.update({
          body: `ERROR: ${error.message}`,
        });
      }
      
      logger.error(`Error enviar message campaign: ${error}`);
      throw new Error(error);
    }
  },
};
