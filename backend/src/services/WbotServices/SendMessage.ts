import { join } from "path";
import { proto } from "@whiskeysockets/baileys";
import Message from "../../models/Message";
import { logger } from "../../utils/logger";
import { getBaileys } from "../../libs/baileys";
import socketEmit from "../../helpers/socketEmit";
import { WASocket } from "@whiskeysockets/baileys";
import fs from "fs/promises";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

const SendMessage = async (message: Message): Promise<void> => {
  logger.info(`SendMessage: ${message.id}`);
  const wbot = getBaileys(message.ticket.whatsappId) as Session;
  let sendedMessage;

  let quotedMsgSerializedId: string | undefined;
  const { ticket } = message;
  const contactNumber = message.contact.number;
  const typeGroup = ticket?.isGroup ? "g" : "s";
  const chatId = `${contactNumber}@${typeGroup}.us`;

  if (message.quotedMsg) {
    quotedMsgSerializedId = message.quotedMsg.messageId;
  }

  try {
    if (message.mediaType !== "chat" && message.mediaName) {
      const customPath = join(__dirname, "..", "..", "..", "public");
      const mediaPath = join(customPath, message.mediaName);
      const mediaBuffer = await fs.readFile(mediaPath);

      // Prepare media message based on type
      let messageContent: any = {};
      switch (message.mediaType) {
        case "image":
          messageContent = {
            image: {
              url: mediaPath,
              mimetype: message.mediaType,
              caption: message.body
            }
          };
          break;
        case "video":
          messageContent = {
            video: {
              url: mediaPath,
              mimetype: message.mediaType,
              caption: message.body
            }
          };
          break;
        case "audio":
          messageContent = {
            audio: {
              url: mediaPath,
              mimetype: message.mediaType,
              ptt: true
            }
          };
          break;
        case "document":
          messageContent = {
            document: {
              url: mediaPath,
              mimetype: message.mediaType,
              fileName: message.mediaName,
              caption: message.body
            }
          };
          break;
        default:
          throw new Error(`Unsupported media type: ${message.mediaType}`);
      }

      sendedMessage = await wbot.sendMessage(
        chatId,
        messageContent as any, // Type assertion needed due to Baileys type limitations
        {
          quoted: quotedMsgSerializedId ? {
            key: {
              remoteJid: chatId,
              fromMe: true,
              id: quotedMsgSerializedId
            }
          } : undefined
        }
      );
    } else {
      sendedMessage = await wbot.sendMessage(
        chatId,
        { text: message.body } as any, // Type assertion needed due to Baileys type limitations
        {
          quoted: quotedMsgSerializedId ? {
            key: {
              remoteJid: chatId,
              fromMe: true,
              id: quotedMsgSerializedId
            }
          } : undefined
        }
      );
    }

    // Update message with sent status
    const messageToUpdate = {
      ...message,
      messageId: sendedMessage.key.id,
      status: "sended"
    };

    await Message.update(messageToUpdate, { where: { id: message.id } });

    // Emit message update event
    socketEmit({
      tenantId: message.ticket.tenantId,
      type: "message:update",
      payload: { ...message.toJSON(), ...messageToUpdate }
    });

    logger.info("Message sent successfully", sendedMessage.key.id);
  } catch (err) {
    logger.error(`Error sending message: ${err}`);
    throw err;
  }
};

export default SendMessage;
