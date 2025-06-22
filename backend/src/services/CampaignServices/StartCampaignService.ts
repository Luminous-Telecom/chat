import { JobOptions } from "bull";
import {
  setHours,
  setMinutes,
  addSeconds,
  isWithinInterval,
  parse,
  getDay,
  addDays,
  differenceInSeconds,
  startOfDay,
  isAfter,
  isBefore,
  differenceInDays,
} from "date-fns";
import { zonedTimeToUtc } from "date-fns-tz";
import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";
import CampaignContacts from "../../models/CampaignContacts";
import Queue from "../../libs/Queue";
import { validateBusinessHours } from "../../utils/businessHoursHelper";

interface Request {
  campaignId: string | number;
  tenantId: number | string;
  // eslint-disable-next-line @typescript-eslint/ban-types
  options?: JobOptions;
}

// const isValidDate = (date: Date) => {
//   return (
//     startOfDay(new Date(date)).getTime() >= startOfDay(new Date()).getTime()
//   );
// };

const cArquivoName = (url: string | null) => {
  if (!url) return "";
  const split = url.split("/");
  const name = split[split.length - 1];
  return name;
};

const randomInteger = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const mountMessageData = (
  campaign: Campaign,
  campaignContact: CampaignContacts,
  // eslint-disable-next-line @typescript-eslint/ban-types
  options: object | undefined
) => {
  // Criar array apenas com mensagens que existem e não estão vazias
  const availableMessages: { message: string, index: number }[] = [];
  
  // Função helper para validar se uma mensagem é válida
  const isValidMessage = (msg: string | null | undefined): boolean => {
    return !!(msg && msg.trim() && msg.trim() !== 'null' && msg.trim() !== 'undefined');
  };
  
  if (isValidMessage(campaign.message1)) {
    availableMessages.push({ message: campaign.message1, index: 1 });
  }
  if (isValidMessage(campaign.message2)) {
    availableMessages.push({ message: campaign.message2, index: 2 });
  }
  if (isValidMessage(campaign.message3)) {
    availableMessages.push({ message: campaign.message3, index: 3 });
  }

  // Se não há mensagens disponíveis, tentar usar message1 como fallback ou erro
  if (availableMessages.length === 0) {
    if (isValidMessage(campaign.message1)) {
      availableMessages.push({ message: campaign.message1, index: 1 });
    } else {
      // Se nem message1 é válida, usar uma mensagem padrão
      console.error(`[CAMPAIGN] No valid messages found for campaign ${campaign.id}`);
      availableMessages.push({ message: "Mensagem da campanha", index: 1 });
    }
  }

  // Selecionar uma mensagem aleatória das disponíveis
  const randomIndex = randomInteger(0, availableMessages.length - 1);
  const selectedMessage = availableMessages[randomIndex];

  // Log da mensagem selecionada
  console.log(`[CAMPAIGN] Selected message ${selectedMessage.index} for campaign ${campaign.id}: "${selectedMessage.message.substring(0, 30)}..."`);

  return {
    whatsappId: campaign.sessionId,
    message: selectedMessage.message,
    number: campaignContact.contact.number,
    mediaUrl: campaign.mediaUrl,
    mediaName: campaign.mediaUrl ? cArquivoName(campaign.mediaUrl) : null,
    messageRandom: `message${selectedMessage.index}`,
    campaignContact,
    options,
  };
};

const nextDayHoursValid = async (date: Date, campaign: Campaign, tenantId: number) => {
  // Se businessHoursOnly está DESATIVADO, retorna a data original sem qualquer modificação
  if (!campaign.businessHoursOnly) {
    return date;
  }

  // Só aplica validações se businessHoursOnly estiver ATIVO
  let dateVerify = date;
  const dateNow = new Date();
  const diffDays = differenceInDays(dateVerify, new Date());
  
  // se dia for menor que o atual
  if (diffDays < 0) {
    dateVerify = addDays(dateVerify, diffDays * -1);
  }

  // se a hora for menor que a atual ao programar a campanha
  if (dateVerify.getTime() < dateNow.getTime()) {
    dateVerify = setMinutes(
      setHours(dateVerify, dateNow.getHours()),
      dateNow.getMinutes()
    );
  }

  const validation = await validateBusinessHours(dateVerify, tenantId);
  if (!validation.isValidTime || !validation.isValidDay) {
    return validation.nextValidDateTime;
  }
  
  return dateVerify;
};

const calcDelay = (nextDate: Date, delay: number) => {
  const now = new Date();
  const diffSeconds = differenceInSeconds(nextDate, now);
  
  // Se a diferença for negativa, significa que a data é no passado
  if (diffSeconds < 0) {
    console.log(`[CAMPAIGN] WARNING: Scheduled time is in the past! Sending immediately.`);
    return 0; // Enviar imediatamente se a data já passou
  }
  
  return diffSeconds * 1000 + delay;
};

const StartCampaignService = async ({
  campaignId,
  tenantId,
  options,
}: Request): Promise<void> => {
  const campaign = await Campaign.findOne({
    where: { id: campaignId, tenantId },
    include: ["session"],
  });

  if (!campaign) {
    throw new AppError("ERROR_CAMPAIGN_NOT_EXISTS", 404);
  }



  // if (!isValidDate(campaign.start)) {
  //   throw new AppError("ERROR_CAMPAIGN_DATE_NOT_VALID", 404);
  // }

  const campaignContacts = await CampaignContacts.findAll({
    where: { campaignId },
    include: ["contact"],
  });

  if (!campaignContacts) {
    throw new AppError("ERR_CAMPAIGN_CONTACTS_NOT_EXISTS", 404);
  }

  const timeDelay = campaign.delay ? campaign.delay * 1000 : 20000;
  // const today = zonedTimeToUtc(new Date(), "America/Sao_Paulo");
  // let dateDelay = setHours(
  //   setMinutes(
  //     zonedTimeToUtc(campaign.start, "America/Sao_Paulo"),
  //     today.getMinutes() + 1
  //   ),
  //   today.getHours()
  // );
  let dateDelay = zonedTimeToUtc(campaign.start, "America/Sao_Paulo");
  
  console.log(`[CAMPAIGN] Starting campaign ${campaignId}: ${campaign.name}`);
  
  // Ajusta a data inicial se necessário (só aplica validação se businessHoursOnly estiver ativo)
  const originalDateDelay = dateDelay;
  dateDelay = await nextDayHoursValid(dateDelay, campaign, Number(tenantId));
  
  if (originalDateDelay.getTime() !== dateDelay.getTime()) {
    console.log(`[CAMPAIGN] Date adjusted due to business hours restrictions`);
  }

  const data = await Promise.all(
    campaignContacts.map(async (campaignContact: CampaignContacts) => {
      dateDelay = addSeconds(dateDelay, timeDelay / 1000);
      
      // Aplica validação de horário se necessário
      dateDelay = await nextDayHoursValid(dateDelay, campaign, Number(tenantId));
      
      return mountMessageData(campaign, campaignContact, {
        ...options,
        jobId: `campaginId_${campaign.id}_contact_${campaignContact.contactId}_id_${campaignContact.id}`,
        delay: calcDelay(dateDelay, timeDelay),
      });
    })
  );

  console.log(`[CAMPAIGN] Scheduling ${data.length} message(s)...`);
  
  await Queue.add("SendMessageWhatsappCampaign", data);
  
  console.log(`[CAMPAIGN] Campaign ${campaignId} scheduled successfully`);

  await campaign.update({
    status: "scheduled",
  });
};

export default StartCampaignService;
