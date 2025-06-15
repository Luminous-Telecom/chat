import { QueryTypes, Op, fn, col, literal, WhereOptions } from "sequelize";
import sequelize from "../../database";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  tenantId: number;
  startDate: string;
  endDate: string;
}

interface TicketCount {
  whatsapp: string;
  qtd: number;
  percentual: number;
}

interface RawTicket {
  whatsapp: string;
  qtd: string;
}

const GetDashTicketsInstancesService = async ({
  tenantId,
  startDate,
  endDate
}: Request): Promise<TicketCount[]> => {
  const tickets = await Ticket.findAll({
    attributes: [
      [literal("Whatsapp.name"), "whatsapp"],
      [fn("COUNT", col("Ticket.id")), "qtd"]
    ],
    include: [
      {
        model: Whatsapp,
        attributes: []
      }
    ],
    where: {
      tenantId,
      createdAt: {
        [Op.between]: [+new Date(startDate), +new Date(endDate)]
      }
    } as WhereOptions,
    group: ["whatsapp"],
    raw: true
  }) as unknown as RawTicket[];

  const total = tickets.reduce((acc, ticket) => acc + Number(ticket.qtd), 0);

  return tickets.map(ticket => ({
    whatsapp: ticket.whatsapp,
    qtd: Number(ticket.qtd),
    percentual: Number(((Number(ticket.qtd) * 100) / total).toFixed(2))
  }));
};

export default GetDashTicketsInstancesService; 