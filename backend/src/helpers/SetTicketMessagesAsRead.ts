import { getBaileys } from "../libs/baileys";
import Ticket from "../models/Ticket";
import { WASocket, proto } from "@whiskeysockets/baileys";
import { logger } from "../utils/logger";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import socketEmit from "./socketEmit";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  const wbot = getBaileys(ticket.whatsappId) as Session;

  try {
    // Primeiro atualiza as mensagens no banco
    await ticket.update({ unreadMessages: 0 });

    // Use Baileys' read receipt method with proper message key
    const messageKey: proto.IMessageKey = {
      remoteJid: `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.us`,
      fromMe: false
    };
    await wbot.readMessages([messageKey]);

    // Recarrega o ticket para garantir dados atualizados
    const ticketReloaded = await ShowTicketService({ id: ticket.id, tenantId: ticket.tenantId });

    if (ticketReloaded?.unreadMessages !== 0) {
      await ticketReloaded.update({ unreadMessages: 0 });
    }

    socketEmit({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReloaded
    });
  } catch (err) {
    logger.error(`Error setting messages as read: ${err}`);
  }
};

export default SetTicketMessagesAsRead;
