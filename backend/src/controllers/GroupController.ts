import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import Group from "../models/Group";
import Whatsapp from "../models/Whatsapp";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;

  const groups = await Group.findAll({
    where: { tenantId },
    include: [
      {
        model: Whatsapp,
        attributes: ["name", "number"]
      }
    ]
  });

  return res.status(200).json(groups);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { name, whatsappId, groupId } = req.body;

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, tenantId }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WHATSAPP_FOUND", 404);
  }

  const wbot = getBaileys(whatsappId);
  if (!wbot) {
    throw new AppError("ERR_NO_WHATSAPP_SESSION", 404);
  }

  // Verify if group exists in WhatsApp
  try {
    const groupInfo = await wbot.groupMetadata(groupId);
    if (!groupInfo) {
      throw new AppError("ERR_GROUP_NOT_FOUND", 404);
    }
  } catch (err) {
    throw new AppError("ERR_GROUP_NOT_FOUND", 404);
  }

  const group = await Group.create({
    name,
    groupId,
    whatsappId,
    tenantId
  });

  const io = getIO();
  io.emit(`${tenantId}:group`, {
    action: "create",
    group
  });

  return res.status(200).json(group);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { name } = req.body;

  const group = await Group.findOne({
    where: { id, tenantId }
  });

  if (!group) {
    throw new AppError("ERR_GROUP_NOT_FOUND", 404);
  }

  await group.update({ name });

  const io = getIO();
  io.emit(`${tenantId}:group`, {
    action: "update",
    group
  });

  return res.status(200).json(group);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const group = await Group.findOne({
    where: { id, tenantId }
  });

  if (!group) {
    throw new AppError("ERR_GROUP_NOT_FOUND", 404);
  }

  await group.destroy();

  const io = getIO();
  io.emit(`${tenantId}:group`, {
    action: "delete",
    groupId: id
  });

  return res.status(200).json({ message: "Group deleted" });
}; 