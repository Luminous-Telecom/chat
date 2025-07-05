import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import Tag from "../../models/Tag";

interface Request {
  tags: number[] | string[];
  ticketId: string;
  tenantId: string | number;
}

interface TagType {
  tagId: number | string;
  ticketId: number | string;
  tenantId: number | string;
}

const UpdateTicketTagsService = async ({
  tags,
  ticketId,
  tenantId,
}: Request): Promise<Ticket> => {
  await TicketTag.destroy({
    where: {
      tenantId,
      ticketId,
    },
  });

  const ticketTags: TagType[] = [];
  tags.forEach((tag: any) => {
    ticketTags.push({
      tagId: !tag.id ? tag : tag.id,
      ticketId,
      tenantId,
    });
  });

  await TicketTag.bulkCreate(ticketTags as any);

  const ticket = await Ticket.findOne({
    where: { id: ticketId, tenantId },
    include: [
      {
        model: Tag,
        as: "tags",
        through: { attributes: [] }
      }
    ],
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  return ticket;
};

export default UpdateTicketTagsService; 