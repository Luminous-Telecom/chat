import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as TicketController from "../controllers/TicketController";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import SendBaileysMessage from "../services/BaileysServices/SendBaileysMessage";
import User from "../models/User";

const ticketRoutes = Router();

ticketRoutes.get("/", isAuth, TicketController.index);

ticketRoutes.get("/:ticketId", isAuth, TicketController.show);

ticketRoutes.post("/", isAuth, async (req, res) => {
  try {
    const { contactId, whatsappId, body, mediaUrl, mediaType } = req.body;

    const contact = await Contact.findByPk(contactId);
    if (!contact) {
      throw new AppError("ERR_NO_CONTACT_FOUND");
    }

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Criar ticket
    const ticket = await Ticket.create({
      contactId,
      whatsappId,
      status: "open",
      userId: req.user.id
    });

    // Enviar mensagem inicial
    const messageData = {
      body,
      ticket,
      mediaUrl,
      mediaType
    };

    await SendBaileysMessage(messageData);

    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

ticketRoutes.put("/:ticketId", isAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, userId, tagId } = req.body;

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

    // Atualizar ticket
    await ticket.update({
      status,
      userId,
      tagId
    });

    // Notificar contato sobre mudança de status
    if (status === "closed") {
      await wbot.sendMessage(
        ticket.contact.number + '@s.whatsapp.net',
        { text: "Ticket fechado. Obrigado por entrar em contato!" }
      );
    } else if (status === "pending") {
      await wbot.sendMessage(
        ticket.contact.number + '@s.whatsapp.net',
        { text: "Ticket em espera. Retornaremos em breve." }
      );
    }

    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

ticketRoutes.delete("/:ticketId", isAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;

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

    // Notificar contato sobre exclusão
    await wbot.sendMessage(
      ticket.contact.number + '@s.whatsapp.net',
      { text: "Ticket excluído. Caso precise de mais ajuda, abra um novo ticket." }
    );

    // Excluir ticket
    await ticket.destroy();

    return res.json({ message: "Ticket deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

ticketRoutes.post("/:ticketId/transfer", isAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { userId } = req.body;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Contact, as: "contact" },
        { model: Whatsapp, as: "whatsapp" },
        { model: User, as: "user" }
      ]
    });

    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND");
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError("ERR_NO_USER_FOUND");
    }

    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Atualizar ticket
    await ticket.update({ userId });

    // Notificar contato sobre transferência
    await wbot.sendMessage(
      ticket.contact.number + '@s.whatsapp.net',
      { text: `Ticket transferido para ${user.name}. Em breve ele entrará em contato.` }
    );

    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

ticketRoutes.post("/:ticketId/close", isAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;

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

    // Atualizar ticket
    await ticket.update({ status: "closed" });

    // Notificar contato sobre fechamento
    await wbot.sendMessage(
      ticket.contact.number + '@s.whatsapp.net',
      { text: "Ticket fechado. Obrigado por entrar em contato!" }
    );

    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

ticketRoutes.post("/:ticketId/reopen", isAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;

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

    // Atualizar ticket
    await ticket.update({ status: "open" });

    // Notificar contato sobre reabertura
    await wbot.sendMessage(
      ticket.contact.number + '@s.whatsapp.net',
      { text: "Ticket reaberto. Em breve retornaremos o atendimento." }
    );

    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

ticketRoutes.post("/:ticketId/pause", isAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;

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

    // Atualizar ticket
    await ticket.update({ status: "pending" });

    // Notificar contato sobre pausa
    await wbot.sendMessage(
      ticket.contact.number + '@s.whatsapp.net',
      { text: "Ticket em espera. Retornaremos em breve." }
    );

    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default ticketRoutes;
