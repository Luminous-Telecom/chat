import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import Tag from "../../models/Tag";
import socketEmit from "../../helpers/socketEmit";
import ShowTicketService from "./ShowTicketService";

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

  // Buscar o ticket completo com todas as informações usando ShowTicketService
  const ticket = await ShowTicketService({ id: ticketId, tenantId });

  // Emitir evento de socket para atualizar o ticket na lista
  socketEmit({
    tenantId,
    type: "ticket:update",
    payload: ticket,
  });

  return ticket;
};

export default UpdateTicketTagsService; 