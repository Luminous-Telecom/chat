import { join } from "path";
import fs from "fs";
import { BaileysClient as Client } from "../../types/baileys";
import Message from "../../models/Message";
import MessagesOffLine from "../../models/MessageOffLine";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import { getIO } from "../../libs/socket";
import UserMessagesLog from "../../models/UserMessagesLog";

const SendOffLineMessagesWbot = async (
  wbot: Client,
  tenantId: number | string
): Promise<void> => {
  const messages = await MessagesOffLine.findAll({
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        where: { tenantId },
        include: ["contact"],
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"],
      },
    ],
    order: [["updatedAt", "ASC"]],
  });
  const io = getIO();
  await Promise.all(
    messages.map(async message => {
      logger.info(`Send Message OffLine: ${message}`);
      try {
        if (message.mediaType !== "chat" && message.mediaName) {
          const customPath = join(__dirname, "..", "..", "..", "public");
          const mediaPath = join(
            process.env.PATH_OFFLINE_MEDIA || customPath,
            message.mediaName
          );
          const buffer = await fs.promises.readFile(mediaPath);
          const mimetype =
            message.mediaType === "image" ? "image/jpeg" : "audio/mpeg";
          const caption =
            message.mediaType === "image" ? message.body : undefined;
          const { number } = message.ticket.contact;
          const sendMessage = await wbot.sendMessage(
            `${number}@${message.ticket.isGroup ? "g" : "c"}.us`,
            { image: buffer, mimetype, caption },
            { sendAudioAsVoice: true }
          );
          try {
            if (message.userId) {
              await UserMessagesLog.create({
                messageId: sendMessage?.key?.id || sendMessage?.id?.id || null,
                userId: message.userId,
                ticketId: message.ticketId,
              });
            }
          } catch (error) {
            logger.error(`Error criar log mensagem ${error}`);
          }
        } else {
          await SendWhatsAppMessage(
            message.contact,
            message.ticket,
            message.body,
            message.quotedMsg
          );
        }
        await MessagesOffLine.destroy({ where: { id: message.id } });

        // Emitir para o canal correto que o frontend está escutando
        io.emit(`tenant:${tenantId}:appMessage`, {
          action: "delete",
          message,
        });

        // Também emitir para o canal antigo para compatibilidade
        io.to(`${tenantId}-${message.ticketId.toString()}`).emit(
          `${tenantId}-appMessage`,
          {
            action: "delete",
            message,
          }
        );
      } catch (error) {
        logger.error(`Error enviar messageOffLine: ${error}`);
      }
    })
  );
};

export default SendOffLineMessagesWbot;
