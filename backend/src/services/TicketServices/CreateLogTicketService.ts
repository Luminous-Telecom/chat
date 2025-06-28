// import AppError from "../../errors/AppError";
// import socketEmit from "../../helpers/socketEmit";
import LogTicket from "../../models/LogTicket";

type logType =
  | "access"
  | "create"
  | "closed"
  | "transfered"
  | "receivedTransfer"
  | "open"
  | "pending"
  | "queue"
  | "userDefine"
  | "delete"
  | "chatBot"
  | "autoClose"
  | "retriesLimitQueue"
  | "retriesLimitUserDefine";

interface Request {
  type: logType;
  ticketId: number | string;
  userId?: number | string;
  queueId?: number | string;
}

const CreateLogTicketService = async ({
  type,
  userId,
  ticketId,
  queueId,
}: Request): Promise<void> => {
  const numericUserId = userId ? (typeof userId === 'string' ? parseInt(userId, 10) : userId) : null;
  const numericTicketId = typeof ticketId === 'string' ? parseInt(ticketId, 10) : ticketId;
  const numericQueueId = queueId ? (typeof queueId === 'string' ? parseInt(queueId, 10) : queueId) : null;

  await LogTicket.create({
    userId: numericUserId,
    ticketId: numericTicketId,
    type,
    queueId: numericQueueId,
  } as any);

  // socketEmit({
  //   tenantId,
  //   type: "ticket:update",
  //   payload: ticket
  // });
};

export default CreateLogTicketService;
