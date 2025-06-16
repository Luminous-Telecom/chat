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
    COALESCE(w.name, 'Não informado') as whatsapp,
    COUNT(t.id) as qtd
  FROM "Tickets" t
  LEFT JOIN "Whatsapps" w ON w.id = t."whatsappId"
  WHERE 
    t."tenantId" = :tenantId 
    AND date_trunc('day', t."createdAt") BETWEEN :startDate AND :endDate
  GROUP BY w.name
  ORDER BY qtd DESC
`;

const queryAdmin = `
  SELECT 
    COALESCE(w.name, 'Não informado') as whatsapp,
    COUNT(t.id) as qtd
  FROM "Tickets" t
  LEFT JOIN "Whatsapps" w ON w.id = t."whatsappId"
  WHERE 
    t."tenantId" = :tenantId 
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

  return data;
};

export default DashTicketsInstances;
