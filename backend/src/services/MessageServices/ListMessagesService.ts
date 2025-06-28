// import { Sequelize } from "sequelize-typescript";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import MessagesOffLine from "../../models/MessageOffLine";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";

interface Request {
  ticketId: string;
  tenantId: number | string;
  pageNumber?: string;
}

interface Response {
  messages: Message[];
  messagesOffLine: MessagesOffLine[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId,
  tenantId,
}: Request): Promise<Response> => {
  const ticket = await ShowTicketService({ id: ticketId, tenantId });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // await setMessagesAsRead(ticket);
  const limit = 30;
  const offset = limit * (+pageNumber - 1);

  // Executar consultas em paralelo para melhorar performance
  const [messagesResult, messagesOffLineResult] = await Promise.all([
    Message.findAndCountAll({
      where: { ticketId },
      limit,
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"],
        },
        {
          model: require("../../models/User").default,
          as: "user",
          attributes: ["id", "name", "email", "profilePicUrl"]
        }
      ],
      offset,
      order: [["createdAt", "DESC"]],
    }),
    // Só buscar mensagens offline na primeira página
    +pageNumber === 1 ? MessagesOffLine.findAndCountAll({
      where: { ticketId },
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"],
        },
        {
          model: require("../../models/User").default,
          as: "user",
          attributes: ["id", "name", "email", "profilePicUrl"]
        }
      ],
      order: [["createdAt", "DESC"]],
    }) : Promise.resolve({ rows: [] })
  ]);

  const { count, rows: messages } = messagesResult;
  const { rows: messagesOffLine } = messagesOffLineResult;

  const hasMore = count > offset + messages.length;

  return {
    messages: messages.reverse(),
    messagesOffLine,
    ticket,
    count,
    hasMore,
  };
};

export default ListMessagesService;
