import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import UsersQueues from "../../models/UsersQueues";

interface Request {
  userId: string;
  tenantId: string | number;
}

interface QueueCount {
  queueId: number;
  queueName: string;
  count: number;
}

interface Response {
  queues: QueueCount[];
}

const CountUnreadTicketsByQueueService = async ({
  userId,
  tenantId
}: Request): Promise<Response> => {
  // Verificar se existem filas cadastradas
  const isExistsQueues = await Queue.count({ where: { tenantId } });
  
  if (!isExistsQueues) {
    return { queues: [] };
  }

  // Buscar filas do usuário
  const userQueues = await UsersQueues.findAll({
    where: {
      userId
    },
    include: [
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "queue"]
      }
    ]
  });

  const queuesIdsUser = userQueues.map(q => q.queueId);

  if (!queuesIdsUser.length) {
    return { queues: [] };
  }

  // Contar tickets não lidos por fila
  const queueCounts: QueueCount[] = [];

  for (const userQueue of userQueues) {
    const count = await Ticket.count({
      where: {
        queueId: userQueue.queueId,
        status: "pending",
        tenantId,
        unreadMessages: {
          [Op.gt]: 0
        }
      }
    });

    queueCounts.push({
      queueId: userQueue.queueId,
      queueName: userQueue.queue?.queue || "Sem fila",
      count
    });
  }

  return { queues: queueCounts };
};

export default CountUnreadTicketsByQueueService;