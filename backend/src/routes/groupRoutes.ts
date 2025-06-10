import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as GroupController from "../controllers/GroupController";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import Group, { GroupContact } from "../models/Group";

const groupRoutes = Router();

groupRoutes.get("/", isAuth, GroupController.index);

groupRoutes.post("/", isAuth, async (req, res) => {
  try {
    const { name, contacts, whatsappId } = req.body;

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Criar grupo no WhatsApp
    const group = await wbot.groupCreate(name, contacts.map((c: Contact) => c.number + '@s.whatsapp.net'));

    // Salvar grupo no banco
    const savedGroup = await Group.create({
      name: group.subject,
      whatsappId,
      groupId: group.id
    });

    // Adicionar contatos ao grupo
    await savedGroup.addContacts(contacts);

    return res.json(savedGroup);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

groupRoutes.put("/:groupId", isAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, contacts, whatsappId } = req.body;

    const group = await Group.findByPk(groupId, {
      include: ["contacts", "whatsapp"]
    });

    if (!group) {
      throw new AppError("ERR_NO_GROUP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Atualizar nome do grupo
    if (name && name !== group.name) {
      await wbot.groupUpdateSubject(group.groupId, name);
      await group.update({ name });
    }

    // Atualizar participantes
    if (contacts) {
      const currentContacts = group.contacts.map(c => c.number + '@s.whatsapp.net');
      const newContacts = contacts.map((c: Contact) => c.number + '@s.whatsapp.net');

      // Remover contatos que não estão mais no grupo
      const toRemove = currentContacts.filter(c => !newContacts.includes(c));
      if (toRemove.length > 0) {
        await wbot.groupParticipantsUpdate(group.groupId, toRemove, 'remove');
      }

      // Adicionar novos contatos
      const toAdd = newContacts.filter(c => !currentContacts.includes(c));
      if (toAdd.length > 0) {
        await wbot.groupParticipantsUpdate(group.groupId, toAdd, 'add');
      }

      // Atualizar contatos no banco
      await group.setContacts(contacts);
    }

    return res.json(group);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

groupRoutes.delete("/:groupId", isAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { whatsappId } = req.body;

    const group = await Group.findByPk(groupId);
    if (!group) {
      throw new AppError("ERR_NO_GROUP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Deletar grupo no WhatsApp
    await wbot.groupLeave(group.groupId);

    // Deletar grupo no banco
    await group.destroy();

    return res.json({ message: "Group deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default groupRoutes;