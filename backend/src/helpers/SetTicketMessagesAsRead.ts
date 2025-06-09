import { getMessengerBot } from "../libs/messengerBot";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import socketEmit from "./socketEmit";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  try {
    // Primeiro atualiza as mensagens no banco
    await Message.update(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );

    // Atualiza o contador do ticket
    await ticket.update({ unreadMessages: 0 });

    // Tenta marcar como lido no WhatsApp/Messenger
    try {
      if (ticket.channel === "whatsapp") {
        const wbot = await GetTicketWbot(ticket);
        await wbot.sendSeen(`${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`);
      } else if (ticket.channel === "messenger") {
        const messengerBot = getMessengerBot(ticket.whatsappId);
        await messengerBot.markSeen(ticket.contact.messengerId);
      }
    } catch (err) {
      logger.error(`Could not mark messages as read in ${ticket.channel}: ${err}`);
    }

    // Recarrega o ticket para garantir dados atualizados
    const ticketReload = await ShowTicketService({
      id: ticket.id,
      tenantId: ticket.tenantId
    });

    // Emite evento de atualização
    socketEmit({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });
  } catch (err) {
    logger.error(`Error in SetTicketMessagesAsRead: ${err}`);
    throw err; // Propaga o erro para ser tratado pelo chamador
  }
};

export default SetTicketMessagesAsRead;
