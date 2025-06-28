/* eslint-disable array-callback-return */
// import AppError from "../../errors/AppError";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import CampaignContacts from "../../models/CampaignContacts";
import Campaign from "../../models/Campaign";

interface CampaignContact {
  campaignId: string | number;
  contactId: string | number;
}

interface Request {
  campaignContacts: CampaignContact[];
  campaignId: string | number;
}

interface CampaignContactData {
  campaignId: string | number;
  contactId: string | number;
}

const CreateCampaignContactsService = async ({
  campaignContacts,
  campaignId,
}: Request): Promise<void> => {
  const randomInteger = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // Buscar a campanha para verificar quais mensagens estão disponíveis
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  // Criar array apenas com mensagens que existem e não estão vazias
  const availableMessages: number[] = [];
  if (campaign.message1 && campaign.message1.trim()) {
    availableMessages.push(1);
  }
  if (campaign.message2 && campaign.message2.trim()) {
    availableMessages.push(2);
  }
  if (campaign.message3 && campaign.message3.trim()) {
    availableMessages.push(3);
  }

  // Se não há mensagens disponíveis, usar message1 como fallback
  if (availableMessages.length === 0) {
    availableMessages.push(1);
  }

  const isCreateds = await CampaignContacts.findAll({
    where: {
      campaignId,
    },
  });

  const data: CampaignContactData[] = campaignContacts.map((contact: any) => {
    // Selecionar uma mensagem aleatória das disponíveis
    const randomIndex = randomInteger(0, availableMessages.length - 1);
    const selectedMessageNumber = availableMessages[randomIndex];
    
    return {
      contactId: contact.id,
      campaignId,
      messageRandom: `message${selectedMessageNumber}`,
    };
  });

  // eslint-disable-next-line consistent-return
  const filterData = data.filter((d: any): any => {
    const isExists = isCreateds?.findIndex(
      (c: any) => d.contactId === c.contactId && +campaignId === c.campaignId
    );
    if (isExists === -1) {
      return d;
    }
  });

  const schema = Yup.array().of(
    Yup.object().shape({
      messageRandom: Yup.string().required(),
      campaignId: Yup.number().required(),
      contactId: Yup.number().required(),
    })
  );

  try {
    await schema.validate(filterData);
  } catch (error) {
    throw new AppError(error.message);
  }

  try {
    await CampaignContacts.bulkCreate(filterData as any);
  } catch (error) {
    throw new AppError(error.message);
  }
};

export default CreateCampaignContactsService;
