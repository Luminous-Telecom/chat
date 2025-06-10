import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as WebHooksController from "../controllers/WebHooksController";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";

const webhookRoutes = Router();

// Note: These routes would need proper controller methods
// webhookRoutes.get("/", isAuth, WebHooksController.index);
// webhookRoutes.get("/:webhookId", isAuth, WebHooksController.show);
// webhookRoutes.post("/", isAuth, WebHooksController.store);
// webhookRoutes.put("/:webhookId", isAuth, WebHooksController.update);
// webhookRoutes.delete("/:webhookId", isAuth, WebHooksController.remove);

webhookRoutes.post("/:webhookId/test", isAuth, async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { whatsappId } = req.body;

    // Note: Webhook model doesn't exist, this would need to be created
    // const webhook = await Webhook.findByPk(webhookId);
    // if (!webhook) {
    //   throw new AppError("ERR_NO_WEBHOOK_FOUND");
    // }
    
    // For now, using mock webhook data
    const webhook = {
      testNumber: null,
      url: "http://example.com/webhook",
      secret: "test-secret"
    };

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Enviar mensagem de teste
    const testNumber = webhook.testNumber || whatsapp.number;
    await wbot.sendMessage(
      testNumber + '@s.whatsapp.net',
      { text: "Teste de webhook - " + new Date().toLocaleString() }
    );

    // Simular evento de webhook
    const testEvent = {
      type: "message",
      data: {
        key: {
          remoteJid: testNumber + '@s.whatsapp.net',
          fromMe: false,
          id: "test_" + Date.now()
        },
        message: {
          extendedTextMessage: {
            text: "Teste de webhook"
          }
        },
        messageTimestamp: Date.now(),
        status: "received"
      }
    };

    // Enviar evento para o webhook
    await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": webhook.secret
      },
      body: JSON.stringify(testEvent)
    });

    return res.json({ message: "Webhook test successful" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default webhookRoutes;