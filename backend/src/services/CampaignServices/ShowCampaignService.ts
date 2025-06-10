import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";

interface Request {
  campaignId: string;
  tenantId: string | number;
}

const ShowCampaignService = async ({
  campaignId,
  tenantId
}: Request): Promise<Campaign> => {
  const campaign = await Campaign.findOne({
    where: { id: campaignId, tenantId, isDeleted: false },
    include: ["contacts", "whatsapp"]
  });

  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  return campaign;
};

export default ShowCampaignService; 