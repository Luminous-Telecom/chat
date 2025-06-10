import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";
import uploadConfig from "../config/upload";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";

const upload = multer(uploadConfig);

const contactRoutes = express.Router();

contactRoutes.post(
  "/import",
  isAuth,
  ImportPhoneContactsController.store
);

contactRoutes.post(
  "/upload",
  isAuth,
  upload.array("file"),
  ContactController.upload
);

contactRoutes.post(
  "/export",
  isAuth,
  ContactController.exportContacts
);

contactRoutes.get("/", isAuth, ContactController.index);

contactRoutes.get("/:contactId", isAuth, ContactController.show);

contactRoutes.post("/", isAuth, ContactController.store);

contactRoutes.post("/sync", isAuth, ContactController.syncContacts);

contactRoutes.put("/:contactId", isAuth, ContactController.update);

contactRoutes.delete("/:contactId", isAuth, ContactController.remove);

contactRoutes.put(
  "/tags/:contactId",
  isAuth,
  ContactController.updateContactTags
);

contactRoutes.put(
  "/wallet/:contactId",
  isAuth,
  ContactController.updateContactWallet
);

contactRoutes.post("/:contactId/block", isAuth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { whatsappId } = req.body;

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

    // Bloquear contato no WhatsApp
    await wbot.updateBlockStatus(contact.number + '@s.whatsapp.net', 'block');

    // Atualizar contato
    await contact.update({ isBlocked: true });

    return res.json(contact);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

contactRoutes.post("/:contactId/unblock", isAuth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { whatsappId } = req.body;

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

    // Desbloquear contato no WhatsApp
    await wbot.updateBlockStatus(contact.number + '@s.whatsapp.net', 'unblock');

    // Atualizar contato
    await contact.update({ isBlocked: false });

    return res.json(contact);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default contactRoutes;
