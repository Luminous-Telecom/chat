import CampaignContacts from "../../models/CampaignContacts";
import Contact from "../../models/Contact";
import { Sequelize } from "sequelize";

interface Request {
  tenantId: string | number;
  campaignId: string | number;
}

const ListCampaignContactsService = async ({
  campaignId,
  tenantId,
}: Request): Promise<Contact[]> => {
  const contactsData = await Contact.findAll({
    where: {
      tenantId,
    },
    include: [
      {
        model: CampaignContacts,
        as: "campaignContacts",
        where: { campaignId },
        required: true,
      },
    ],
    order: [["name", "ASC"]],
  });

  return contactsData;
};

export default ListCampaignContactsService;
