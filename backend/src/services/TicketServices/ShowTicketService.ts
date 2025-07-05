import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import TicketParticipant from "../../models/TicketParticipant";
import Tag from "../../models/Tag";

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
          "tags"
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
        model: Tag,
        as: "tags",
        through: { attributes: [] }
      },
    ],
  });

  if (!ticket || ticket.tenantId !== tenantId) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  return ticket;
};

export default ShowTicketService;
