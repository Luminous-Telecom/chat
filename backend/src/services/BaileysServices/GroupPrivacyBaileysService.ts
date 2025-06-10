import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { getBaileys } from "./BaileysService";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface UpdateGroupPrivacyRequest {
  ticket: Ticket;
  settings: {
    announce?: boolean;
    restrict?: boolean;
    noFrequentlyForwarded?: boolean;
    ephemeral?: number;
  };
}

interface UpdateGroupInviteRequest {
  ticket: Ticket;
  inviteCode?: string;
  revokeInvite?: boolean;
}

const UpdateGroupPrivacy = async ({
  ticket,
  settings
}: UpdateGroupPrivacyRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Atualizar configurações de privacidade
    if (settings.announce !== undefined) {
      await wbot.groupSettingUpdate(
        ticket.contact.number,
        settings.announce ? "announcement" : "not_announcement"
      );
    }

    if (settings.restrict !== undefined) {
      await wbot.groupSettingUpdate(
        ticket.contact.number,
        settings.restrict ? "locked" : "unlocked"
      );
    }

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
    logger.error(`UpdateGroupPrivacy | Error: ${err}`);
    throw new AppError("ERR_UPDATING_GROUP_PRIVACY");
  }
};

const UpdateGroupInvite = async ({
  ticket,
  inviteCode,
  revokeInvite
}: UpdateGroupInviteRequest): Promise<string | void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    if (revokeInvite) {
      // Revogar código de convite atual
      await wbot.groupRevokeInvite(ticket.contact.number);
      return;
    }

    if (inviteCode) {
      // Note: Baileys doesn't support setting a specific invite code
      // We can only generate a new one or revoke the current one
      // Generating a new invite code instead
      const newCode = await wbot.groupInviteCode(ticket.contact.number);
      return newCode;
    }

    // Gerar novo código de convite
    const code = await wbot.groupInviteCode(ticket.contact.number);
    return code;
  } catch (err) {
    logger.error(`UpdateGroupInvite | Error: ${err}`);
    throw new AppError("ERR_UPDATING_GROUP_INVITE");
  }
};

export {
  UpdateGroupPrivacy,
  UpdateGroupInvite
};