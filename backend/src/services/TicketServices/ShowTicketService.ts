import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import TicketParticipant from "../../models/TicketParticipant";

interface Request {
  id: string | number;
  tenantId: string | number;
}
const ShowTicketService = async ({
  id,
  tenantId,
}: Request): Promise<Ticket> => {
  const ticket = await Ticket.findByPk(id, {
    include: [
      {
        model: Contact,
        as: "contact",
        include: [
          "extraInfo",
          "tags",
          {
            association: "wallets",
            attributes: ["id", "name"],
          },
        ],
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"],
      },
      {
        association: "whatsapp",
        attributes: ["id", "name"],
      },
      {
        model: TicketParticipant,
        as: "participants",
        where: { isActive: true },
        required: false,
        include: [
          {
            model: User,
            attributes: ["id", "name", "email"],
          },
        ],
      },
    ],
  });

  if (!ticket || ticket.tenantId !== tenantId) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  return ticket;
};

export default ShowTicketService;
