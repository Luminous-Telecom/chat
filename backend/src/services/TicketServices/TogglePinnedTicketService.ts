import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";

interface Request {
  ticketId: number;
  tenantId: number;
}

const TogglePinnedTicketService = async ({
  ticketId,
  tenantId,
}: Request): Promise<Ticket> => {
  const ticket = await Ticket.findOne({
    where: {
      id: ticketId,
      tenantId,
    },
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // Alterna o status de fixado
  ticket.isPinned = !ticket.isPinned;
  await ticket.save();

  return ticket;
};

export default TogglePinnedTicketService; 