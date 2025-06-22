import { Sequelize } from "sequelize-typescript";
import Campaign from "../../models/Campaign";
import CampaignContacts from "../../models/CampaignContacts";

interface Request {
  tenantId: string | number;
  isActive?: string | boolean | null;
}

const ListCampaignService = async ({
  tenantId,
}: Request): Promise<Campaign[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    tenantId,
  };

  const campaignData = await Campaign.findAll({
    where,
    attributes: {
      include: [
        // Total de contatos únicos na campanha
        [
          Sequelize.literal(
            '(select count(distinct "contactId") from "CampaignContacts" as "w" where "w"."campaignId" = "Campaign"."id")'
          ),
          "contactsCount",
        ],
        // Contatos pendentes de envio (ACK = 0)
        [
          Sequelize.literal(
            '(select count(*) from "CampaignContacts" as "w" where "w"."campaignId" = "Campaign"."id" and "w"."ack" = 0)'
          ),
          "pendentesEnvio",
        ],
        // Contatos pendentes de entrega (ACK = 1)
        [
          Sequelize.literal(
            '(select count(*) from "CampaignContacts" as "w" where "w"."campaignId" = "Campaign"."id" and "w"."ack" = 1)'
          ),
          "pendentesEntrega",
        ],
        // Contatos que receberam a última mensagem (ACK = 2)
        [
          Sequelize.literal(
            '(select count(*) from "CampaignContacts" as "w" where "w"."campaignId" = "Campaign"."id" and "w"."ack" = 2)'
          ),
          "recebidas",
        ],
        // Contatos que leram a última mensagem (ACK = 3)
        [
          Sequelize.literal(
            '(select count(*) from "CampaignContacts" as "w" where "w"."campaignId" = "Campaign"."id" and "w"."ack" = 3)'
          ),
          "lidas",
        ],
      ],
    },
    include: [
      {
        model: CampaignContacts,
        attributes: [],
      },
    ],
    group: ["Campaign.id"],
    order: [["start", "ASC"]],
  });

  return campaignData;
};

export default ListCampaignService;
