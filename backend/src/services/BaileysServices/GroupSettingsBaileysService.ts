import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { getBaileys } from "./BaileysService";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface UpdateGroupSettingsRequest {
  ticket: Ticket;
  settings: {
    messages?: boolean;
    editInfo?: boolean;
    invite?: boolean;
    restrict?: boolean;
    ephemeral?: number;
    noFrequentlyForwarded?: boolean;
  };
}

interface UpdateGroupMessagesSettingsRequest {
  ticket: Ticket;
  settings: {
    adminsOnly?: boolean;
    allMembers?: boolean;
  };
}

interface UpdateGroupEditInfoSettingsRequest {
  ticket: Ticket;
  settings: {
    adminsOnly?: boolean;
    allMembers?: boolean;
  };
}

interface UpdateGroupInviteSettingsRequest {
  ticket: Ticket;
  settings: {
    adminsOnly?: boolean;
    allMembers?: boolean;
  };
}

const UpdateGroupSettings = async ({
  ticket,
  settings
}: UpdateGroupSettingsRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);

    if (!wbot) {
      throw new AppError("ERR_WBOT_NOT_FOUND");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Atualizar configurações de restrição (only supported setting)
    if (settings.restrict !== undefined) {
      await wbot.groupSettingUpdate(
        ticket.contact.number,
        settings.restrict ? "locked" : "unlocked"
      );
    }

    // Note: Other settings (messages, editInfo, invite, ephemeral, noFrequentlyForwarded)
    // are not supported by the current Baileys groupSettingUpdate API

    // Emitir evento de atualização do ticket
    const io = getIO();
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:ticket`,
      {
        action: "update",
        ticket,
        contact: ticket.contact
      }
    );
  } catch (err) {
    logger.error(`UpdateGroupSettings | Error: ${err}`);
    throw new AppError("ERR_UPDATING_GROUP_SETTINGS");
  }
};

const UpdateGroupMessagesSettings = async ({
  ticket,
  settings
}: UpdateGroupMessagesSettingsRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);

    if (!wbot) {
      throw new AppError("ERR_WBOT_NOT_FOUND");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Note: Message settings are not supported by the current Baileys groupSettingUpdate API
    // The groupSettingUpdate method only supports: "announcement", "not_announcement", "locked", "unlocked"

    // Emitir evento de atualização do ticket
    const io = getIO();
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:ticket`,
      {
        action: "update",
        ticket,
        contact: ticket.contact
      }
    );
  } catch (err) {
    logger.error(`UpdateGroupMessagesSettings | Error: ${err}`);
    throw new AppError("ERR_UPDATING_GROUP_MESSAGES_SETTINGS");
  }
};

const UpdateGroupEditInfoSettings = async ({
  ticket,
  settings
}: UpdateGroupEditInfoSettingsRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);

    if (!wbot) {
      throw new AppError("ERR_WBOT_NOT_FOUND");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Note: Edit info settings are not supported by the current Baileys groupSettingUpdate API
    // The groupSettingUpdate method only supports: "announcement", "not_announcement", "locked", "unlocked"

    // Emitir evento de atualização do ticket
    const io = getIO();
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:ticket`,
      {
        action: "update",
        ticket,
        contact: ticket.contact
      }
    );
  } catch (err) {
    logger.error(`UpdateGroupEditInfoSettings | Error: ${err}`);
    throw new AppError("ERR_UPDATING_GROUP_EDIT_INFO_SETTINGS");
  }
};

const UpdateGroupInviteSettings = async ({
  ticket,
  settings
}: UpdateGroupInviteSettingsRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);

    if (!wbot) {
      throw new AppError("ERR_WBOT_NOT_FOUND");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Note: Invite settings are not supported by the current Baileys groupSettingUpdate API
    // The groupSettingUpdate method only supports: "announcement", "not_announcement", "locked", "unlocked"

    // Emitir evento de atualização do ticket
    const io = getIO();
    io.to(`tenant:${ticket.tenantId}:${ticket.id}`).emit(
      `tenant:${ticket.tenantId}:ticket`,
      {
        action: "update",
        ticket,
        contact: ticket.contact
      }
    );
  } catch (err) {
    logger.error(`UpdateGroupInviteSettings | Error: ${err}`);
    throw new AppError("ERR_UPDATING_GROUP_INVITE_SETTINGS");
  }
};

export {
  UpdateGroupSettings,
  UpdateGroupMessagesSettings,
  UpdateGroupEditInfoSettings,
  UpdateGroupInviteSettings
};