/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { join } from "path";
import { proto } from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import { readFileSync } from "fs";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { sleepRandomTime } from "../../utils/sleepRandomTime";
import Contact from "../../models/Contact";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import { Session } from "../../libs/wbot";
// import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

const SendMessagesSystemWbot = async (
  wbot: Session,
  tenantId: number | string
): Promise<void> => {
  const where = {
    fromMe: true,
    messageId: { [Op.is]: null },
    status: "pending",
    [Op.or]: [
      {
        scheduleDate: {
          [Op.lte]: new Date()
        }
      },
      {
        scheduleDate: { [Op.is]: null }
      }
    ]
  };
  const messages = await Message.findAll({
    where,
    include: [
      {
        model: Contact,
        as: "contact",
        where: {
          tenantId,
          number: {
            [Op.notIn]: ["", "null"]
          }
        }
      },
      {
        model: Ticket,
        as: "ticket",
        where: {
          tenantId,
          [Op.or]: {
            status: { [Op.ne]: "closed" },
            isFarewellMessage: true
          },
          channel: "whatsapp",
          whatsappId: wbot.id
        },
        include: ["contact"]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ],
    order: [["createdAt", "ASC"]]
  });
  let sendedMessage: proto.IWebMessageInfo | undefined;

  // logger.info(
  //   `SystemWbot SendMessages | Count: ${messages.length} | Tenant: ${tenantId} `
  // );

  for (const message of messages) {
    let quotedMsgSerializedId: string | undefined;
    const { ticket } = message;
    const contactNumber = ticket.contact.number;
    const typeGroup = ticket?.isGroup ? "g" : "s";
    const chatId = `${contactNumber}@${typeGroup}.whatsapp.net`;

    if (message.quotedMsg && message.quotedMsgId) {
      const quotedMsg = await Message.findOne({
        where: { id: message.quotedMsgId }
      });
      if (quotedMsg?.messageId) {
        quotedMsgSerializedId = quotedMsg.messageId;
      }
    }

    try {
      if (message.mediaType !== "chat" && message.mediaName) {
        const customPath = join(__dirname, "..", "..", "..", "public");
        const mediaPath = join(customPath, message.mediaName);
        const mediaData = readFileSync(mediaPath);
        const mimeType = message.mediaName.endsWith('.mp3') ? 'audio/mp3' : 
                        message.mediaName.endsWith('.mp4') ? 'video/mp4' :
                        message.mediaName.endsWith('.jpg') || message.mediaName.endsWith('.jpeg') ? 'image/jpeg' :
                        message.mediaName.endsWith('.png') ? 'image/png' :
                        'application/octet-stream';

        // Send as audio if it's an audio file, otherwise send as document
        if (mimeType.startsWith('audio/')) {
          sendedMessage = await wbot.sendMessage(
            chatId,
            { 
              audio: mediaData,
              mimetype: mimeType,
              ptt: true, // send as voice note
              caption: message.body
            },
            { quoted: quotedMsgSerializedId ? { key: { id: quotedMsgSerializedId } } : undefined }
          );
        } else {
          sendedMessage = await wbot.sendMessage(
            chatId,
            { 
              document: mediaData,
              mimetype: mimeType,
              fileName: message.mediaName,
              caption: message.body
            },
            { quoted: quotedMsgSerializedId ? { key: { id: quotedMsgSerializedId } } : undefined }
          );
        }
        logger.info("sendMessage media");
      } else {
        sendedMessage = await wbot.sendMessage(
          chatId,
          { text: message.body },
          { quoted: quotedMsgSerializedId ? { key: { id: quotedMsgSerializedId } } : undefined }
        );
        logger.info("sendMessage text");
      }

      if (!sendedMessage) {
        throw new Error("Failed to send message");
      }

      // enviar old_id para substituir no front a mensagem corretamente
      const messageToUpdate = {
        ...message,
        id: message.id,
        messageId: sendedMessage.key.id,
        status: "sended"
      };

      await Message.update(
        { ...messageToUpdate },
        { where: { id: message.id } }
      );

      logger.info("Message Update");
      // await SetTicketMessagesAsRead(ticket);

      // delay para processamento da mensagem
      await sleepRandomTime({
        minMilliseconds: Number(process.env.MIN_SLEEP_INTERVAL || 500),
        maxMilliseconds: Number(process.env.MAX_SLEEP_INTERVAL || 2000)
      });

      logger.info("sendMessage", sendedMessage.key.id);
    } catch (error) {
      const idMessage = message.id;
      const ticketId = message.ticket.id;

      if (error.code === "ENOENT") {
        await Message.destroy({
          where: { id: message.id }
        });
      }

      logger.error(
        `Error message is (tenant: ${tenantId} | Ticket: ${ticketId})`
      );
      logger.error(`Error send message (id: ${idMessage})::${error}`);
    }
  }
};

export default SendMessagesSystemWbot;
