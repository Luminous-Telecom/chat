import { getMessengerBot } from "../libs/messengerBot";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import socketEmit from "./socketEmit";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  await Message.update(
    { read: true },
    {
      where: {
        ticketId: ticket.id,
        read: false
      }
    }
  );

  await ticket.update({ unreadMessages: 0 });

  try {
    if (ticket.channel === "whatsapp") {
      const wbot = await GetTicketWbot(ticket);
      
      // Implementação do Baileys para marcar mensagens como lidas
      try {
        const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.whatsapp.net`;
        
        // Buscar mensagens não lidas
        const unreadMessages = await Message.findAll({
          where: {
            ticketId: ticket.id,
            read: false,
            fromMe: false
          },
          order: [["createdAt", "DESC"]],
          limit: 100 // Limitar a quantidade para evitar sobrecarga
        });

        // Marcar cada mensagem como lida
        for (const message of unreadMessages) {
          if (message.messageId) {
            try {
              await wbot.chatModify(
                { 
                  markRead: true, 
                  lastMessages: [{
                    key: {
                      remoteJid: chatId,
                      id: message.messageId,
                      fromMe: false
                    },
                    messageTimestamp: message.timestamp || Date.now()
                  }]
                },
                chatId
              );
              logger.info(`Message ${message.messageId} marked as read`);
            } catch (err) {
              logger.warn(`Could not mark message ${message.messageId} as read: ${err}`);
            }
          }
        }
      } catch (err) {
        logger.warn(`Error marking messages as read for Baileys: ${err}`);
      }
    }
    if (ticket.channel === "messenger") {
      const messengerBot = getMessengerBot(ticket.whatsappId);
      messengerBot.markSeen(ticket.contact.messengerId);
    }
  } catch (err) {
    logger.warn(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
    );
    // throw new Error("ERR_WAPP_NOT_INITIALIZED");
  }

  const ticketReload = await ShowTicketService({
    id: ticket.id,
    tenantId: ticket.tenantId
  });

  socketEmit({
    tenantId: ticket.tenantId,
    type: "ticket:update",
    payload: ticketReload
  });
};

export default SetTicketMessagesAsRead;
