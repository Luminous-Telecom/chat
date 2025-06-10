import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { getBaileys } from "../../libs/baileys";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

interface GetGroupInfoRequest {
  ticket: Ticket;
}

interface GetGroupParticipantsRequest {
  ticket: Ticket;
}

interface GetGroupInviteInfoRequest {
  ticket: Ticket;
  inviteCode: string;
}

interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  creation: number;
  owner: string;
  size: number;
  participants: {
    id: string;
    admin?: "admin" | "superadmin";
  }[];
  announce?: boolean;
  restrict?: boolean;
}

interface GroupParticipant {
  id: string;
  admin?: "admin" | "superadmin";
  name?: string;
  pushName?: string;
}

interface GroupInviteInfo {
  id: string;
  name: string;
  size: number;
  creation: number;
  owner: string;
  inviteCode: string;
  inviteCodeExp: number;
  participants: {
    id: string;
    name?: string;
    pushName?: string;
  }[];
}

const GetGroupInfo = async ({
  ticket
}: GetGroupInfoRequest): Promise<GroupInfo> => {
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

    return {
      id: groupInfo.id,
      name: groupInfo.subject,
      description: groupInfo.desc || undefined,
      creation: groupInfo.creation || 0,
      owner: groupInfo.owner || "",
      size: groupInfo.size || 0,
      participants: groupInfo.participants.map(p => ({
        id: p.id,
        admin: p.admin || undefined
      })),
      announce: groupInfo.announce,
      restrict: groupInfo.restrict
    };
  } catch (err) {
    logger.error(`GetGroupInfo | Error: ${err}`);
    throw new AppError("ERR_GETTING_GROUP_INFO");
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

    // Obter informações do grupo para acessar participantes
    const groupInfo = await wbot.groupMetadata(ticket.contact.number);

    if (!groupInfo) {
      throw new AppError("ERR_GROUP_NOT_FOUND");
    }

    // Mapear participantes com informações básicas
    const detailedParticipants = groupInfo.participants.map((p) => {
      return {
        id: p.id,
        admin: p.admin || undefined,
        name: undefined, // fetchStatus não está disponível no tipo Session
        pushName: undefined
      };
    });

    return detailedParticipants;
  } catch (err) {
    logger.error(`GetGroupParticipants | Error: ${err}`);
    throw new AppError("ERR_GETTING_GROUP_PARTICIPANTS");
  }
};

const GetGroupInviteInfo = async ({
  ticket,
  inviteCode
}: GetGroupInviteInfoRequest): Promise<GroupInviteInfo> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    
    if (!wbot) {
      throw new AppError("ERR_WBOT_NOT_FOUND");
    }

    // Obter informações do convite
    const inviteInfo = await wbot.groupGetInviteInfo(inviteCode);

    if (!inviteInfo) {
      throw new AppError("ERR_INVITE_NOT_FOUND");
    }

    return {
      id: inviteInfo.id,
      name: inviteInfo.subject,
      size: inviteInfo.size || 0,
      creation: inviteInfo.creation || 0,
      owner: inviteInfo.owner || "",
      inviteCode,
      inviteCodeExp: 0, // expiration property doesn't exist on GroupMetadata
      participants: inviteInfo.participants.map(p => ({
        id: p.id,
        name: undefined, // name property doesn't exist on GroupParticipant
        pushName: undefined // pushname property doesn't exist on GroupParticipant
      }))
    };
  } catch (err) {
    logger.error(`GetGroupInviteInfo | Error: ${err}`);
    throw new AppError("ERR_GETTING_GROUP_INVITE_INFO");
  }
};

export {
  GetGroupInfo,
  GetGroupParticipants,
  GetGroupInviteInfo
};