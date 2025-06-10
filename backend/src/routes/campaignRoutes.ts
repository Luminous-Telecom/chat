import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as CampaignController from "../controllers/CampaignController";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import Campaign from "../models/Campaign";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import CampaignContacts from "../models/CampaignContacts";

const campaignRoutes = Router();

campaignRoutes.get("/", isAuth, CampaignController.index);

campaignRoutes.get("/:campaignId", isAuth, CampaignController.show);

campaignRoutes.post("/", isAuth, CampaignController.store);

campaignRoutes.put("/:campaignId", isAuth, CampaignController.update);

campaignRoutes.delete("/:campaignId", isAuth, CampaignController.remove);

campaignRoutes.post("/:campaignId/start", isAuth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { whatsappId } = req.body;

    const campaign = await Campaign.findByPk(campaignId, {
      include: ["contacts", "whatsapp"]
    });

    if (!campaign) {
      throw new AppError("ERR_NO_CAMPAIGN_FOUND");
    }

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Atualizar status da campanha
    await campaign.update({ status: "RUNNING" });

    // Enviar mensagens
    const contacts = campaign.contacts;
    const message = campaign.message1;
    const mediaUrl = campaign.mediaUrl;
    const mediaType = campaign.mediaType;

    let messageContent: any = { conversation: message };

    if (mediaUrl) {
      switch (mediaType) {
        case 'image':
          messageContent = { imageMessage: { url: mediaUrl } };
          break;
        case 'video':
          messageContent = { videoMessage: { url: mediaUrl } };
          break;
        case 'audio':
          messageContent = { audioMessage: { url: mediaUrl } };
          break;
        case 'document':
          messageContent = { 
            documentMessage: { 
              url: mediaUrl,
              fileName: campaign.mediaName || 'document'
            }
          };
          break;
      }
    }

    // Enviar mensagens com delay para evitar bloqueio
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const DELAY_BETWEEN_MESSAGES = 2000; // 2 segundos

    for (const contact of contacts) {
      try {
        await wbot.sendMessage(
          contact.number + '@s.whatsapp.net',
          messageContent
        );

        // Registrar envio
        await CampaignContacts.create({
          campaignId,
          contactId: contact.id,
          body: campaign.message1,
          messageRandom: campaign.message1,
          ack: 0,
          timestamp: Date.now()
        });

        // Aguardar delay
        await delay(DELAY_BETWEEN_MESSAGES);
      } catch (err) {
        // Registrar erro
        await CampaignContacts.create({
          campaignId,
          contactId: contact.id,
          body: campaign.message1,
          messageRandom: campaign.message1,
          ack: -1,
          timestamp: Date.now()
        });
      }
    }

    // Finalizar campanha
    await campaign.update({ 
      status: "COMPLETED",
      completedAt: Date.now()
    });

    return res.json({ 
      message: "Campaign started successfully",
      sentCount: contacts.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

campaignRoutes.post("/:campaignId/stop", isAuth, async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      throw new AppError("ERR_NO_CAMPAIGN_FOUND");
    }

    // Atualizar status da campanha
    await campaign.update({ 
      status: "STOPPED",
      stoppedAt: Date.now()
    });

    return res.json({ message: "Campaign stopped successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default campaignRoutes;
