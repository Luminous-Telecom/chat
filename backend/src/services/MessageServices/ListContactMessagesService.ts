import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";

interface Request {
  contactId: string | number;
  tenantId: number | string;
}

const ListContactMessagesService = async ({
  contactId,
  tenantId,
}: Request): Promise<Message[]> => {
  // Encontra todos os tickets do contato
  const tickets = await Ticket.findAll({
    where: {
      contactId,
      tenantId,
    },
    attributes: ["id"],
  });

  const ticketIds = tickets.map(t => t.id);

  if (ticketIds.length === 0) {
    return [];
  }

  // Busca todas as mensagens desses tickets
  const messages = await Message.findAll({
    where: {
      ticketId: {
        [Op.in]: ticketIds,
      },
    },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"],
      },
      {
        model: Message,
        as: "quotedMsg",
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "number"],
          },
        ],
      },
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "status", "createdAt"],
      },
    ],
    order: [["createdAt", "ASC"]],
  });

  return messages;
};

export default ListContactMessagesService; 