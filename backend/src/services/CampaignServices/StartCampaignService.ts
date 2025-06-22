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

const mountMessageData = (
  campaign: Campaign,
  campaignContact: CampaignContacts,
  messageIndex: number,
  // eslint-disable-next-line @typescript-eslint/ban-types
  options: object | undefined
) => {
  // Função helper para validar se uma mensagem é válida
  const isValidMessage = (msg: string | null | undefined): boolean => {
    return !!(msg && msg.trim() && msg.trim() !== 'null' && msg.trim() !== 'undefined');
  };

  let message = '';
  let mediaUrl: string | null = null;
  let mediaName: string | null = null;

  if (messageIndex === 1) {
    // Primeira mensagem - pode ter mídia
    if (isValidMessage(campaign.message1)) {
      message = campaign.message1;
    } else {
      console.error(`[CAMPAIGN] No valid message1 found for campaign ${campaign.id}`);
      message = "Mensagem da campanha";
    }
    
    // Se há mídia, incluir na primeira mensagem
    if (campaign.mediaUrl) {
      mediaUrl = campaign.mediaUrl;
      mediaName = cArquivoName(campaign.mediaUrl);
    }
  } else if (messageIndex === 2 && isValidMessage(campaign.message2)) {
    message = campaign.message2 || '';
  } else if (messageIndex === 3 && isValidMessage(campaign.message3)) {
    message = campaign.message3 || '';
  } else {
    return null; // Mensagem não existe ou é inválida
  }

  console.log(`[CAMPAIGN] Preparing message ${messageIndex} for campaign ${campaign.id}: "${message.substring(0, 30)}..."`);

  return {
    whatsappId: campaign.sessionId,
    message,
    number: campaignContact.contact.number,
    mediaUrl,
    mediaName,
    messageRandom: `message${messageIndex}`,
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

  // Limpar registros existentes da campanha
  await CampaignContacts.destroy({
    where: { campaignId }
  });

  // Recriar apenas contatos únicos
  const uniqueContacts = [...new Map(campaignContacts.map(cc => [cc.contactId, cc])).values()];

  // Criar UM registro por contato (será atualizado a cada mensagem enviada)
  for (const campaignContact of uniqueContacts) {
    await CampaignContacts.create({
      campaignId: campaign.id,
      contactId: campaignContact.contactId,
      messageRandom: "message1", // Sempre começamos com message1
      ack: 0,
      body: campaign.message1,
      mediaName: cArquivoName(campaign.mediaUrl),
      messageId: null,
      timestamp: null,
    });
  }

  // Recarregar os registros criados com a relação contact
  const newCampaignContacts = await CampaignContacts.findAll({
    where: { campaignId },
    include: ["contact"]
  });

  const timeDelay = campaign.delay ? campaign.delay * 1000 : 30000; // Aumentei de 20s para 30s
  let dateDelay = zonedTimeToUtc(campaign.start, "America/Sao_Paulo");
  
  console.log(`[CAMPAIGN] Starting campaign ${campaignId}: ${campaign.name}`);
  
  // Ajusta a data inicial se necessário (só aplica validação se businessHoursOnly estiver ativo)
  const originalDateDelay = dateDelay;
  dateDelay = await nextDayHoursValid(dateDelay, campaign, Number(tenantId));
  
  if (originalDateDelay.getTime() !== dateDelay.getTime()) {
    console.log(`[CAMPAIGN] Date adjusted due to business hours restrictions`);
  }

  // Função helper para validar se uma mensagem é válida
  const isValidMessage = (msg: string | null | undefined): boolean => {
    return !!(msg && msg.trim() && msg.trim() !== 'null' && msg.trim() !== 'undefined');
  };

  const data: any[] = [];
  
  for (const campaignContact of newCampaignContacts) {
    // Para cada contato, criar jobs para cada mensagem que existe
    for (let messageIndex = 1; messageIndex <= 3; messageIndex++) {
      let shouldCreateJob = false;
      
      // Verificar se deve criar job para esta mensagem
      if (messageIndex === 1 && isValidMessage(campaign.message1)) {
        shouldCreateJob = true;
      } else if (messageIndex === 2 && isValidMessage(campaign.message2)) {
        shouldCreateJob = true;
      } else if (messageIndex === 3 && isValidMessage(campaign.message3)) {
        shouldCreateJob = true;
      }
      
      if (shouldCreateJob) {
        dateDelay = addSeconds(dateDelay, timeDelay / 1000);
        
        // Aplica validação de horário se necessário
        dateDelay = await nextDayHoursValid(dateDelay, campaign, Number(tenantId));
        
        const messageData = mountMessageData(campaign, campaignContact, messageIndex, {
          ...options,
          jobId: `campaginId_${campaign.id}_contact_${campaignContact.contactId}_msg_${messageIndex}`,
          delay: calcDelay(dateDelay, timeDelay),
        });
        
        if (messageData) {
          data.push(messageData);
        }
      }
    }
  }

  console.log(`[CAMPAIGN] Scheduling ${data.length} message(s)...`);
  
  await Queue.add("SendMessageWhatsappCampaign", data);
  
  console.log(`[CAMPAIGN] Campaign ${campaignId} scheduled successfully`);

  await campaign.update({
    status: "scheduled",
  });
};

export default StartCampaignService;
