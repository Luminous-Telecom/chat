import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { getBaileys } from "../../libs/baileys";
import Ticket from "../../models/Ticket";
import Group from "../../models/Group";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

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

interface JoinGroupRequest {
  ticket: Ticket;
  inviteCode: string;
}

interface AcceptGroupInviteRequest {
  ticket: Ticket;
  inviteCode: string;
}

interface RejectGroupInviteRequest {
  ticket: Ticket;
  inviteCode: string;
}

interface GetGroupInviteLinkRequest {
  ticket: Ticket;
}

interface CreateGroupRequest {
  ticket: Ticket;
  name: string;
  participants: string[];
  description?: string;
}

interface UpdateGroupRequest {
  ticket: Ticket;
  name?: string;
  description?: string;
}

interface DeleteGroupRequest {
  ticket: Ticket;
}

interface LeaveGroupRequest {
  ticket: Ticket;
}

const JoinGroup = async ({
  ticket,
  inviteCode
}: JoinGroupRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Entrar no grupo usando o código de convite
    const group = await wbot.groupAcceptInvite(inviteCode);

    if (!group) {
      throw new AppError("ERR_JOINING_GROUP");
    }

    // Atualizar ticket
    await ticket.update({
      contact: {
        ...ticket.contact,
        number: group,
        isGroup: true
      }
    });

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
    logger.error(`JoinGroup | Error: ${err}`);
    throw new AppError("ERR_JOINING_GROUP");
  }
};

const AcceptGroupInvite = async ({
  ticket,
  inviteCode
}: AcceptGroupInviteRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Aceitar convite do grupo
    const group = await wbot.groupAcceptInvite(inviteCode);

    if (!group) {
      throw new AppError("ERR_ACCEPTING_GROUP_INVITE");
    }

    // Atualizar ticket
    await ticket.update({
      contact: {
        ...ticket.contact,
        number: group,
        isGroup: true
      }
    });

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
    logger.error(`AcceptGroupInvite | Error: ${err}`);
    throw new AppError("ERR_ACCEPTING_GROUP_INVITE");
  }
};

const RejectGroupInvite = async ({
  ticket,
  inviteCode
}: RejectGroupInviteRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Rejeitar convite do grupo
    await wbot.groupRevokeInvite(inviteCode);

    // Atualizar ticket
    await ticket.update({
      status: "closed"
    });

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
    logger.error(`RejectGroupInvite | Error: ${err}`);
    throw new AppError("ERR_REJECTING_GROUP_INVITE");
  }
};

const GetGroupInviteLink = async ({
  ticket
}: GetGroupInviteLinkRequest): Promise<string> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Buscar grupo no banco
    const group = await Group.findOne({
      where: { groupId: ticket.contact.number }
    });

    if (!group) {
      throw new AppError("ERR_GROUP_NOT_FOUND");
    }

    // Verificar se o usuário tem permissão para gerar convite
    const groupId = `${ticket.contact.number}@g.us`;
    const groupMetadata = await wbot.groupMetadata(groupId);
    const groupInfo: GroupInfo = {
       id: groupMetadata.id,
       name: groupMetadata.subject || '',
       description: groupMetadata.desc,
       creation: groupMetadata.creation || 0,
       owner: groupMetadata.owner || '',
       size: groupMetadata.size || 0,
       participants: groupMetadata.participants.map(p => ({
         id: p.id,
         admin: p.admin === null ? undefined : p.admin
       })),
       announce: groupMetadata.announce,
        restrict: groupMetadata.restrict
     };
    const me = wbot.user?.id;
    if (!me) {
      throw new AppError("ERR_NO_WHATSAPP_USER");
    }

    const isAdmin = groupMetadata.participants.find(
      p => p.id === me && (p.admin === "admin" || p.admin === "superadmin")
    );

    if (!isAdmin && groupMetadata.owner !== me) {
      throw new AppError("ERR_NOT_GROUP_ADMIN");
    }

    // Gerar código de convite
    const inviteCode = await wbot.groupInviteCode(groupId);
    if (!inviteCode) {
      throw new AppError("ERR_GENERATING_INVITE_LINK");
    }

    // Retornar link completo
    return `https://chat.whatsapp.com/${inviteCode}`;
  } catch (err) {
    logger.error(`GetGroupInviteLink | Error: ${err}`);
    throw new AppError("ERR_GETTING_GROUP_INVITE_LINK");
  }
};

const CreateGroup = async ({
  ticket,
  name,
  participants,
  description
}: CreateGroupRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Criar grupo
    const group = await wbot.groupCreate(name, participants);

    if (!group) {
      throw new AppError("ERR_CREATING_GROUP");
    }

    // Atualizar descrição se fornecida
    if (description) {
      await wbot.groupUpdateDescription(group.id, description);
    }

    // Atualizar ticket
    await ticket.update({
      contact: {
        ...ticket.contact,
        number: group.id,
        name,
        isGroup: true
      }
    });

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
    logger.error(`CreateGroup | Error: ${err}`);
    throw new AppError("ERR_CREATING_GROUP");
  }
};

const UpdateGroup = async ({
  ticket,
  name,
  description
}: UpdateGroupRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Buscar grupo no banco
    const group = await Group.findOne({
      where: { groupId: ticket.contact.number }
    });

    if (!group) {
      throw new AppError("ERR_GROUP_NOT_FOUND");
    }

    // Verificar se o usuário tem permissão para editar o grupo
    const groupMetadata = await wbot.groupMetadata(group.groupId);
    const me = wbot.user?.id;
    if (!me) {
      throw new AppError("ERR_NO_WHATSAPP_USER");
    }

    const isAdmin = groupMetadata.participants.find(
      p => p.id === me && (p.admin === "admin" || p.admin === "superadmin")
    );

    if (!isAdmin && groupMetadata.owner !== me) {
      throw new AppError("ERR_NOT_GROUP_ADMIN");
    }

    // Atualizar nome se fornecido
    if (name) {
      await wbot.groupUpdateSubject(group.groupId, name);
    }

    // Atualizar descrição se fornecida
    if (description) {
      await wbot.groupUpdateDescription(group.groupId, description);
    }

    // Atualizar ticket
    await ticket.update({
      contact: {
        ...ticket.contact,
        name: name || ticket.contact.name
      }
    });

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
    logger.error(`UpdateGroup | Error: ${err}`);
    throw new AppError("ERR_UPDATING_GROUP");
  }
};

const DeleteGroup = async ({
  ticket
}: DeleteGroupRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Buscar grupo no banco
    const group = await Group.findOne({
      where: { groupId: ticket.contact.number }
    });

    if (!group) {
      throw new AppError("ERR_GROUP_NOT_FOUND");
    }

    // Verificar se o usuário é dono do grupo
    const groupMetadata = await wbot.groupMetadata(group.groupId);
    const me = wbot.user?.id;
    if (!me) {
      throw new AppError("ERR_NO_WHATSAPP_USER");
    }

    if (groupMetadata.owner !== me) {
      throw new AppError("ERR_NOT_GROUP_OWNER");
    }

    // Excluir grupo
    await wbot.groupLeave(group.groupId);

    // Atualizar ticket
    await ticket.update({
      status: "closed"
    });

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
    logger.error(`DeleteGroup | Error: ${err}`);
    throw new AppError("ERR_DELETING_GROUP");
  }
};

const LeaveGroup = async ({
  ticket
}: LeaveGroupRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Buscar grupo no banco
    const group = await Group.findOne({
      where: { groupId: ticket.contact.number }
    });

    if (!group) {
      throw new AppError("ERR_GROUP_NOT_FOUND");
    }

    // Verificar se o usuário é dono do grupo
    const groupMetadata = await wbot.groupMetadata(group.groupId);
    const me = wbot.user?.id;
    if (!me) {
      throw new AppError("ERR_NO_WHATSAPP_USER");
    }

    if (groupMetadata.owner === me) {
      throw new AppError("ERR_GROUP_OWNER_CANT_LEAVE");
    }

    // Sair do grupo
    await wbot.groupLeave(group.groupId);

    // Atualizar ticket
    await ticket.update({
      status: "closed"
    });

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
    logger.error(`LeaveGroup | Error: ${err}`);
    throw new AppError("ERR_LEAVING_GROUP");
  }
};

export {
  JoinGroup,
  AcceptGroupInvite,
  RejectGroupInvite,
  GetGroupInviteLink,
  CreateGroup,
  UpdateGroup,
  DeleteGroup,
  LeaveGroup
};