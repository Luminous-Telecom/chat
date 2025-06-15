import { QueryTypes } from "sequelize";
import sequelize from "../../database";

interface Request {
  startDate: string;
  endDate: string;
  tenantId: string | number;
  userId: string | number;
  userProfile: string;
}

const query = `
  SELECT 
    w.name as whatsapp,
    COUNT(t.id) as qtd
  FROM "Tickets" t
  INNER JOIN "Whatsapps" w ON w.id = t."whatsappId"
  INNER JOIN "LogTickets" lt ON lt."ticketId" = t.id
  WHERE 
    t."tenantId" = :tenantId 
    AND lt."userId" = :userId
    AND (lt."type" LIKE 'open' OR lt."type" LIKE 'receivedTransfer')
    AND date_trunc('day', t."createdAt") BETWEEN :startDate AND :endDate
  GROUP BY w.name
  ORDER BY qtd DESC
`;

const queryAdmin = `
  SELECT 
    w.name as whatsapp,
    COUNT(t.id) as qtd
  FROM "Tickets" t
  INNER JOIN "Whatsapps" w ON w.id = t."whatsappId"
  INNER JOIN "LogTickets" lt ON lt."ticketId" = t.id
  WHERE 
    t."tenantId" = :tenantId 
    AND (lt."type" LIKE 'open' OR lt."type" LIKE 'receivedTransfer')
    AND date_trunc('day', t."createdAt") BETWEEN :startDate AND :endDate
  GROUP BY w.name
  ORDER BY qtd DESC
`;

const DashTicketsInstances = async ({
  startDate,
  endDate,
  tenantId,
  userId,
  userProfile
}: Request): Promise<any[]> => {
  console.log("Executando query com parâmetros:", {
    tenantId,
    userId,
    startDate,
    endDate,
    userProfile
  });

  const data = await sequelize.query(
    userProfile === "admin" ? queryAdmin : query,
    {
      replacements: {
        tenantId,
        startDate,
        endDate,
        userId
      },
      type: QueryTypes.SELECT,
      logging: console.log
    }
  );

  console.log("Dados retornados:", data);
  return data;
};

export default DashTicketsInstances;
