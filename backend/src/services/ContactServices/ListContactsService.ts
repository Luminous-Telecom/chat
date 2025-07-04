import { Sequelize, Op, QueryTypes } from "sequelize";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import sequelize from "../../database";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  tenantId: string | number;
  profile: string;
  userId: string | number;
}

interface Response {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1",
  tenantId,
  profile,
  userId,
}: Request): Promise<Response> => {
  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const where = `
    "Contact"."tenantId" = ${tenantId}
    and (LOWER("Contact"."name") like '%${searchParam.toLowerCase().trim()}%'
        or "Contact"."number" like '%${searchParam.toLowerCase().trim()}%')
  `;

  const queryCount = `
    select count(*)
    from "Contacts" as "Contact"
    where ${where}
  `;

  const query = `
    select
      "Contact"."id",
      "Contact"."name",
      "Contact"."number",
      "Contact"."email",
      "Contact"."profilePicUrl",
      "Contact"."pushname",
      "Contact"."telegramId",
      "Contact"."messengerId",
      "Contact"."instagramPK",
      "Contact"."isUser",
      "Contact"."isWAContact",
      "Contact"."isGroup",
      "Contact"."tenantId",
      "Contact"."createdAt",
      "Contact"."updatedAt"
    from
      "Contacts" as "Contact"
    where ${where}
    order by "Contact"."name" asc
    limit ${limit} offset ${offset}
  `;

  const contacts: Contact[] = await sequelize.query(query, {
    type: QueryTypes.SELECT,
  });

  const data: any = await sequelize.query(queryCount, {
    type: QueryTypes.SELECT,
  });

  const count = (data && data[0]?.count) || 0;
  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore,
  };
};

export default ListContactsService;
