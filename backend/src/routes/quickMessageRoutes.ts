import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as QuickMessageController from "../controllers/QuickMessageController";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import { getBaileys } from "../libs/baileys";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";
import { proto } from "@whiskeysockets/baileys";
import * as MessageController from "../controllers/MessageController";
import CreateMessageService from "../services/MessageServices/CreateMessageService";

const quickMessageRoutes = Router();

quickMessageRoutes.get("/", isAuth, QuickMessageController.index);

quickMessageRoutes.get("/:quickMessageId", isAuth, QuickMessageController.show);

quickMessageRoutes.post("/", isAuth, QuickMessageController.store);

quickMessageRoutes.put("/:quickMessageId", isAuth, QuickMessageController.update);

quickMessageRoutes.delete("/:quickMessageId", isAuth, QuickMessageController.remove);

quickMessageRoutes.post("/:quickMessageId/test", isAuth, async (req, res) => {
  try {
    const { quickMessageId } = req.params;
    const { whatsappId, testNumber } = req.body;

    const quickMessage = await QuickMessageController.show(req, res);
    if (!quickMessage) {
      throw new AppError("ERR_NO_QUICKMESSAGE_FOUND");
    }

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Enviar mensagem de teste
    const message = quickMessage.message;
    const mediaUrl = quickMessage.mediaUrl;
    const mediaType = quickMessage.mediaType;

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
              fileName: quickMessage.mediaName || 'document'
            }
          };
          break;
      }
    }

    await wbot.sendMessage(
      testNumber + '@s.whatsapp.net',
      messageContent
    );

    return res.json({ message: "Quick message test successful" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

quickMessageRoutes.post("/:quickMessageId/send", isAuth, async (req, res) => {
  const { quickMessageId } = req.params;
  const { ticketId } = req.body;
  const { tenantId } = req.user;

  try {
    const quickMessage = await QuickMessageController.show(req, res);
    if (!quickMessage) {
      throw new AppError("ERR_NO_QUICK_MESSAGE_FOUND", 404);
    }

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND", 404);
    }

    if (!ticket.whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND", 404);
    }

    const wbot = getBaileys(ticket.whatsapp.id);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION", 404);
    }

    // Enviar mensagem
    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@s.whatsapp.net`,
      { text: quickMessage.message }
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_MESSAGE", 500);
    }

    // Criar registro da mensagem
    const message = await CreateMessageService({
      messageData: {
        messageId: sentMessage.key.id!,
        ticketId: ticket.id,
        contactId: ticket.contact.id,
        body: quickMessage.message,
        fromMe: true,
        read: true,
        mediaType: "chat",
        timestamp: Date.now()
      },
      tenantId
    });

    return res.send(message);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
});

export default quickMessageRoutes;