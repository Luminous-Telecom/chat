import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as MessageController from "../controllers/MessageController";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import SendBaileysMessage from "../services/BaileysServices/SendBaileysMessage";
import SendBaileysInteractiveMessage from "../services/BaileysServices/SendBaileysInteractiveMessage";
import SendBaileysTemplateMessage from "../services/BaileysServices/SendBaileysTemplateMessage";
import SendBaileysReaction from "../services/BaileysServices/SendBaileysReaction";
import { getIO } from "../libs/socket";
import { getBaileys } from "../libs/baileys";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";
import { proto } from "@whiskeysockets/baileys";
import Message from "../models/Message";

const messageRoutes = Router();

messageRoutes.get("/", isAuth, MessageController.index);

messageRoutes.get("/:messageId", isAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByPk(messageId, {
      include: [
        { model: Ticket, as: "ticket", include: [{ model: Contact, as: "contact" }] }
      ]
    });
    if (!message) {
      throw new AppError("ERR_NO_MESSAGE_FOUND");
    }
    return res.json(message);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

messageRoutes.post("/:ticketId/messages", isAuth, async (req, res) => {
  const { ticketId } = req.params;
  const { body, quotedMsg, mediaUrl, mediaType, mediaName } = req.body;
  const { tenantId, id: userId } = req.user;

  try {
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

    let messageContent: proto.IMessage = {};

    if (mediaUrl) {
      if (mediaType?.startsWith('image/')) {
        messageContent = {
          imageMessage: {
            url: mediaUrl,
            mimetype: mediaType,
            caption: body
          }
        };
      } else if (mediaType?.startsWith('video/')) {
        messageContent = {
          videoMessage: {
            url: mediaUrl,
            mimetype: mediaType,
            caption: body
          }
        };
      } else if (mediaType?.startsWith('audio/')) {
        messageContent = {
          audioMessage: {
            url: mediaUrl,
            mimetype: mediaType,
            ptt: true
          }
        };
      } else {
        messageContent = {
          documentMessage: {
            url: mediaUrl,
            mimetype: mediaType || 'application/octet-stream',
            fileName: mediaName,
            caption: body
          }
        };
      }
    } else {
      messageContent = {
        conversation: body
      };
    }

    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@s.whatsapp.net`,
      messageContent as any, // Type assertion needed due to Baileys type limitations
      {
        quoted: quotedMsg ? {
          key: {
            remoteJid: `${ticket.contact.number}@s.whatsapp.net`,
            id: quotedMsg,
            fromMe: true
          }
        } : undefined
      }
    );

    if (!sentMessage) {
      throw new AppError("ERR_SENDING_MESSAGE", 500);
    }

    const message = await Message.create({
      messageId: sentMessage.key.id!,
      ticketId: ticket.id,
      contactId: ticket.contact.id,
      body,
      fromMe: true,
      read: true,
      mediaType: mediaType || "chat",
      mediaUrl,
      mediaName,
      quotedMsgId: quotedMsg,
      timestamp: Date.now(),
      status: "sent",
      tenantId
    });

    const io = getIO();
    io.to(ticketId.toString()).emit("appMessage", {
      action: "create",
      message,
      ticket,
      contact: ticket.contact
    });

    return res.send(message);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
});

messageRoutes.post("/interactive", isAuth, async (req, res) => {
  try {
    const { 
      ticketId, 
      body, 
      buttons, 
      list, 
      footer, 
      userId 
    } = req.body;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND");
    }

    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    const sentMessage = await SendBaileysInteractiveMessage({
      ticket,
      body,
      buttons,
      list,
      footer,
      userId
    });

    return res.json(sentMessage);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

messageRoutes.post("/template", isAuth, async (req, res) => {
  try {
    const { 
      ticketId, 
      templateName, 
      languageCode, 
      components, 
      userId 
    } = req.body;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND");
    }

    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    const sentMessage = await SendBaileysTemplateMessage({
      ticket,
      templateName,
      languageCode,
      components,
      userId
    });

    return res.json(sentMessage);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

messageRoutes.post("/reaction", isAuth, async (req, res) => {
  try {
    const { 
      ticketId, 
      messageId, 
      reaction, 
      userId 
    } = req.body;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND");
    }

    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    const sentMessage = await SendBaileysReaction({
      ticket,
      messageId,
      reaction,
      userId
    });

    return res.json(sentMessage);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

messageRoutes.delete("/:messageId", isAuth, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findByPk(messageId, {
      include: [
        { model: Ticket, as: "ticket", include: [{ model: Whatsapp, as: "whatsapp" }] }
      ]
    });

    if (!message) {
      throw new AppError("ERR_NO_MESSAGE_FOUND");
    }

    const wbot = getBaileys(message.ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Delete message in WhatsApp
    await wbot.sendMessage(
      `${message.ticket.contact.number}@s.whatsapp.net`,
      { 
        delete: { 
          id: message.messageId,
          fromMe: true,
          remoteJid: `${message.ticket.contact.number}@s.whatsapp.net`,
          participant: undefined
        } 
      }
    );

    // Delete message in database
    await message.destroy();

    return res.json({ message: "Message deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

messageRoutes.put("/:messageId", isAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { body } = req.body;

    const message = await Message.findByPk(messageId, {
      include: [
        { model: Ticket, as: "ticket", include: [{ model: Whatsapp, as: "whatsapp" }] }
      ]
    });

    if (!message) {
      throw new AppError("ERR_NO_MESSAGE_FOUND");
    }

    const wbot = getBaileys(message.ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Edit message in WhatsApp
    await wbot.sendMessage(
      `${message.ticket.contact.number}@${message.ticket.isGroup ? "g" : "s"}.us`,
      {
        text: body,
        edit: {
          remoteJid: `${message.ticket.contact.number}@${message.ticket.isGroup ? "g" : "s"}.us`,
          fromMe: true,
          id: message.messageId
        }
      }
    );

    // Update message in database
    await message.update({ body });

    return res.json(message);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default messageRoutes;
