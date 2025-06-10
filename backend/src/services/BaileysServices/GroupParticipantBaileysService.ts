import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { getBaileys } from "../../libs/baileys";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface AddGroupParticipantRequest {
  ticket: Ticket;
  participants: string[];
}

interface RemoveGroupParticipantRequest {
  ticket: Ticket;
  participants: string[];
}

interface GetGroupParticipantsRequest {
  ticket: Ticket;
}

interface GroupParticipant {
  id: string;
  admin?: "admin" | "superadmin";
  name?: string;
  pushName?: string;
}

const AddGroupParticipant = async ({
  ticket,
  participants
}: AddGroupParticipantRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_WBOT_NOT_FOUND");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Verificar se o usuário tem permissão para adicionar participantes
    const groupInfo = await wbot.groupMetadata(ticket.contact.number);
    
    if (!wbot.user?.id) {
      throw new AppError("ERR_WBOT_USER_NOT_FOUND");
    }
    
    const isAdmin = groupInfo.participants.find(
      p => p.id === wbot.user!.id && (p.admin === "admin" || p.admin === "superadmin")
    );

    if (!isAdmin && groupInfo.owner !== wbot.user!.id) {
      throw new AppError("ERR_NOT_GROUP_ADMIN");
    }

    // Adicionar participantes
    await wbot.groupParticipantsUpdate(
      ticket.contact.number,
      participants,
      "add"
    );

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
    logger.error(`AddGroupParticipant | Error: ${err}`);
    throw new AppError("ERR_ADDING_GROUP_PARTICIPANT");
  }
};

const RemoveGroupParticipant = async ({
  ticket,
  participants
}: RemoveGroupParticipantRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_WBOT_NOT_FOUND");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Verificar se o usuário tem permissão para remover participantes
    const groupInfo = await wbot.groupMetadata(ticket.contact.number);
    
    if (!wbot.user?.id) {
      throw new AppError("ERR_WBOT_USER_NOT_FOUND");
    }
    
    const isAdmin = groupInfo.participants.find(
      p => p.id === wbot.user!.id && (p.admin === "admin" || p.admin === "superadmin")
    );

    if (!isAdmin && groupInfo.owner !== wbot.user!.id) {
      throw new AppError("ERR_NOT_GROUP_ADMIN");
    }

    // Remover participantes
    await wbot.groupParticipantsUpdate(
      ticket.contact.number,
      participants,
      "remove"
    );

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
    logger.error(`RemoveGroupParticipant | Error: ${err}`);
    throw new AppError("ERR_REMOVING_GROUP_PARTICIPANT");
  }
};

const GetGroupParticipants = async ({
  ticket
}: GetGroupParticipantsRequest): Promise<GroupParticipant[]> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_WBOT_NOT_FOUND");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Obter informações do grupo
    const groupInfo = await wbot.groupMetadata(ticket.contact.number);

    if (!groupInfo) {
      throw new AppError("ERR_GROUP_NOT_FOUND");
    }

    // Obter informações detalhadas dos participantes
    const detailedParticipants = groupInfo.participants.map((p) => {
      return {
        id: p.id,
        admin: p.admin || undefined,
        name: undefined,
        pushName: undefined
      };
    });

    return detailedParticipants;
  } catch (err) {
    logger.error(`GetGroupParticipants | Error: ${err}`);
    throw new AppError("ERR_GETTING_GROUP_PARTICIPANTS");
  }
};

export {
  AddGroupParticipant,
  RemoveGroupParticipant,
  GetGroupParticipants
};