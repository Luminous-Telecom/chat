import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as TagController from "../controllers/TagController";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import Tags from "../models/Tag";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import ContactTag from "../models/ContactTag";

const tagRoutes = Router();

tagRoutes.get("/", isAuth, TagController.index);

tagRoutes.post("/", isAuth, TagController.store);

tagRoutes.put("/:tagId", isAuth, TagController.update);

tagRoutes.delete("/:tagId", isAuth, TagController.remove);

tagRoutes.post("/:tagId/contacts/:contactId", isAuth, async (req, res) => {
  try {
    const { tagId, contactId } = req.params;
    const { whatsappId } = req.body;

    const tag = await Tags.findByPk(tagId);
    if (!tag) {
      throw new AppError("ERR_NO_TAG_FOUND");
    }

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

    // Adicionar tag ao contato
    await ContactTag.create({
      contactId: contact.id,
      tagId: tag.id
    });

    // Enviar mensagem de confirmação
    await wbot.sendMessage(
      contact.number + '@s.whatsapp.net',
      { text: `Você foi marcado com a tag: ${tag.tag}` }
    );

    return res.json({ message: "Tag added successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

tagRoutes.delete("/:tagId/contacts/:contactId", isAuth, async (req, res) => {
  try {
    const { tagId, contactId } = req.params;
    const { whatsappId } = req.body;

    const tag = await Tags.findByPk(tagId);
    if (!tag) {
      throw new AppError("ERR_NO_TAG_FOUND");
    }

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

    // Remover tag do contato
    await ContactTag.destroy({
      where: {
        contactId: contact.id,
        tagId: tag.id
      }
    });

    // Enviar mensagem de confirmação
    await wbot.sendMessage(
      contact.number + '@s.whatsapp.net',
      { text: `A tag ${tag.tag} foi removida do seu contato` }
    );

    return res.json({ message: "Tag removed successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default tagRoutes;
