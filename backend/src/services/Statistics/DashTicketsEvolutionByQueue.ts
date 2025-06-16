import { QueryTypes } from "sequelize";
import sequelize from "../../database";

interface Request {
  startDate: string;
  endDate: string;
  tenantId: string | number;
  userId: string | number;
  userProfile: string;
}

const queryAdmin = `
  SELECT 
    date_trunc('day', t."createdAt") as date,
    COALESCE(q.queue, 'Não informado') as queue,
    COUNT(*) as count
  FROM "Tickets" t
  LEFT JOIN "Queues" q ON t."queueId" = q.id
  WHERE t."tenantId" = :tenantId
    AND date_trunc('day', t."createdAt") BETWEEN :startDate AND :endDate
  GROUP BY date_trunc('day', t."createdAt"), q.queue
  ORDER BY date_trunc('day', t."createdAt"), q.queue
`;

const query = `
  SELECT 
    date_trunc('day', t."createdAt") as date,
    COALESCE(q.queue, 'Não informado') as queue,
    COUNT(*) as count
  FROM "Tickets" t
  LEFT JOIN "Queues" q ON t."queueId" = q.id
  WHERE t."tenantId" = :tenantId
    AND t."userId" = :userId
    AND date_trunc('day', t."createdAt") BETWEEN :startDate AND :endDate
  GROUP BY date_trunc('day', t."createdAt"), q.queue
  ORDER BY date_trunc('day', t."createdAt"), q.queue
`;

const DashTicketsEvolutionByQueue = async ({
  startDate,
  endDate,
  tenantId,
  userId,
  userProfile
}: Request): Promise<any[]> => {
  const data = await sequelize.query(
    userProfile === "admin" ? queryAdmin : query,
    {
      replacements: {
        tenantId,
        startDate,
        endDate,
        userId
      },
      type: QueryTypes.SELECT
    }
  );

  // Transformar os dados para o formato esperado pelo frontend
  const transformedData = data.reduce((acc: any[], curr: any) => {
    const existingDate = acc.find(item => item.date === curr.date);
    if (existingDate) {
      existingDate.queues[curr.queue] = curr.count;
    } else {
      acc.push({
        date: curr.date,
        queues: {
          [curr.queue]: curr.count
        }
      });
    }
    return acc;
  }, []);

  return transformedData;
};

export default DashTicketsEvolutionByQueue; 