import { differenceInHours, parseJSON } from "date-fns";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { getTbot } from "../libs/tbot";
// import { getInstaBot } from "../libs/InstaBot";
import GetWbotMessage from "./GetWbotMessage";
import GetTicketWbot from "./GetTicketWbot";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";

const DeleteMessageSystem = async (
  id: string,
  messageId: string,
  tenantId: string | number
): Promise<void> => {
  const message = await Message.findOne({
    where: { id },
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact"],
        where: { tenantId },
      },
    ],
  });

  if (!message) {
    throw new AppError("Mensagem não encontrada com este ID.");
  }

  const diffHoursDate = differenceInHours(
    new Date(),
    parseJSON(message?.createdAt)
  );
  
  if (diffHoursDate > 2) {
    throw new AppError(`Não é possível deletar mensagens enviadas há mais de 2 horas. Esta mensagem foi enviada há ${diffHoursDate} horas.`, 400);
  }

  const { ticket } = message;

  if (ticket.channel === "whatsapp") {
    try {
      const wbot = await GetTicketWbot(ticket);
      const chatId = `${ticket.contact.number}@${
        ticket.isGroup ? "g" : "c"
      }.us`;

      console.log(
        "[DEBUG DELETE SYSTEM] Attempting WhatsApp deletion for chatId:",
        chatId,
        "messageId:",
        messageId
      );

      // Tentar buscar a mensagem no store
      const messageToDelete = await GetWbotMessage(ticket, messageId);

      if (messageToDelete) {
        console.log(
          "[DEBUG DELETE SYSTEM] Message found in store, attempting deletion with key:",
          JSON.stringify(messageToDelete.key)
        );

        // Tentar deletar usando a chave da mensagem encontrada
        await wbot.sendMessage(chatId, { delete: messageToDelete.key });
        console.log(
          "[DEBUG DELETE SYSTEM] Message deletion request sent successfully"
        );
      } else {
        console.log(
          "[DEBUG DELETE SYSTEM] Message not found in store, trying alternative deletion method"
        );

        // Se não encontrou no store, tentar criar uma chave baseada no messageId
        const messageKey = {
          remoteJid: chatId,
          fromMe: message.fromMe,
          id: messageId,
        };

        console.log(
          "[DEBUG DELETE SYSTEM] Attempting deletion with constructed key:",
          JSON.stringify(messageKey)
        );
        await wbot.sendMessage(chatId, { delete: messageKey });
        console.log("[DEBUG DELETE SYSTEM] Alternative deletion request sent");
      }

      // Aguardar um pouco para garantir que a exclusão foi processada
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.error("[DEBUG DELETE SYSTEM] WhatsApp deletion failed:", error);
      console.log(
        "[DEBUG DELETE SYSTEM] Continuing with database deletion only"
      );
    }
  }

  if (ticket.channel === "telegram") {
    const telegramBot = await getTbot(ticket.whatsappId);
    if (message.messageId) {
      await telegramBot.telegram.deleteMessage(
        ticket.contact.telegramId,
        +message.messageId
      );
    }
  }

  if (ticket.channel === "instagram") {
    // const chatId = ticket.contact.instagramPK;
    // const instaBot = await getInstaBot(ticket.whatsappId);
    // const threadEntity = await instaBot.entity.directThread([chatId]);
    // if (!threadEntity.threadId) return;
    // await threadEntity.deleteItem(message.messageId);
    return;
  }

  // não possui suporte para apagar mensagem
  if (ticket.channel === "messenger") {
    return;
  }

  await message.update({ isDeleted: true });
  console.log("[DEBUG DELETE SYSTEM] Message updated with isDeleted: true");
  console.log("[DEBUG DELETE SYSTEM] Updated message:", {
    id: message.id,
    isDeleted: message.isDeleted,
  });

  const io = getIO();
  const eventData = {
    action: "update",
    message,
    ticket,
    contact: ticket.contact,
  };

  console.log(
    "[DEBUG DELETE SYSTEM] Emitting socket events with data:",
    eventData
  );
  console.log(
    "[DEBUG DELETE SYSTEM] Emitting to channel: tenant:" +
      tenantId +
      ":appMessage"
  );

  // Emitir diretamente para o canal que o frontend está escutando
  io.emit(`tenant:${tenantId}:appMessage`, eventData);

  console.log("[DEBUG DELETE SYSTEM] Primary emit completed");

  // Também emitir para os canais adicionais para garantir compatibilidade
  console.log("[DEBUG DELETE SYSTEM] Emitting to additional channels:", {
    channel1: `${tenantId}-${ticket.id.toString()}`,
    channel2: `${tenantId}-${ticket.status}`,
    channel3: `${tenantId}-notification`,
    event: `${tenantId}-appMessage`,
  });

  io.to(`${tenantId}-${ticket.id.toString()}`)
    .to(`${tenantId}-${ticket.status}`)
    .to(`${tenantId}-notification`)
    .emit(`${tenantId}-appMessage`, eventData);

  console.log("[DEBUG DELETE SYSTEM] All socket events emitted successfully");
};

export default DeleteMessageSystem;
