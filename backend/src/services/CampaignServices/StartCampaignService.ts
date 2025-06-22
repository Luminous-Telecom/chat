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
  if (campaign.message1 && campaign.message1.trim()) {
    availableMessages.push({ message: campaign.message1, index: 1 });
  }
  if (campaign.message2 && campaign.message2.trim()) {
    availableMessages.push({ message: campaign.message2, index: 2 });
  }
  if (campaign.message3 && campaign.message3.trim()) {
    availableMessages.push({ message: campaign.message3, index: 3 });
  }

  // Se não há mensagens disponíveis, usar message1 como fallback
  if (availableMessages.length === 0) {
    availableMessages.push({ message: campaign.message1 || "", index: 1 });
  }

  // Selecionar uma mensagem aleatória das disponíveis
  const randomIndex = randomInteger(0, availableMessages.length - 1);
  const selectedMessage = availableMessages[randomIndex];

  return {
    whatsappId: campaign.sessionId,
    message: selectedMessage.message,
    number: campaignContact.contact.number,
    mediaUrl: campaign.mediaUrl,
    mediaName: cArquivoName(campaign.mediaUrl),
    messageRandom: `message${selectedMessage.index}`,
    campaignContact,
    options,
  };
};

const nextDayHoursValid = (date: Date) => {
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

  const start = parse("08:00", "HH:mm", dateVerify);
  const end = parse("20:00", "HH:mm", dateVerify);

  const isValidHour = isWithinInterval(dateVerify, { start, end });

  const isDateBefore = isBefore(start, dateVerify);
  const isDateAfter = isAfter(end, dateVerify);

  // fora do intervalo e menor que a hora inicial
  if (!isValidHour && isDateBefore) {
    dateVerify = setMinutes(setHours(dateVerify, 8), 30);
  }

  // fora do intervalo, maior que a hora final e no mesmo dia
  if (!isValidHour && isDateAfter && diffDays === 0) {
    dateVerify = addDays(setHours(dateVerify, 8), 1);
  }

  // fora do intervalo, maior que a hora final e dia diferente
  if (!isValidHour && isDateAfter && diffDays > 0) {
    dateVerify = setHours(dateVerify, 8);
  }

  return dateVerify;
};

const calcDelay = (nextDate: Date, delay: number) => {
  const diffSeconds = differenceInSeconds(nextDate, new Date());
  // se a diferença for negativa, a hora em que a tarefa está sendo
  // programada é menor que a
  // if (diffSeconds < 0)
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
  const data = campaignContacts.map((campaignContact: CampaignContacts) => {
    dateDelay = addSeconds(dateDelay, timeDelay / 1000);
    return mountMessageData(campaign, campaignContact, {
      ...options,
      jobId: `campaginId_${campaign.id}_contact_${campaignContact.contactId}_id_${campaignContact.id}`,
      delay: calcDelay(dateDelay, timeDelay),
    });
  });

  Queue.add("SendMessageWhatsappCampaign", data);

  await campaign.update({
    status: "scheduled",
  });
};

export default StartCampaignService;
