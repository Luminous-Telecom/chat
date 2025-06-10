import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketBaileys from "../../helpers/GetTicketBaileys";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface AddGroupAdminRequest {
  ticket: Ticket;
  participants: string[];
}

interface RemoveGroupAdminRequest {
  ticket: Ticket;
  participants: string[];
}

interface GetGroupAdminsRequest {
  ticket: Ticket;
}

interface GroupAdmin {
  id: string;
  name?: string;
  pushName?: string;
}

const AddGroupAdmin = async ({
  ticket,
  participants
}: AddGroupAdminRequest): Promise<void> => {
  try {
    const wbot = await GetTicketBaileys(ticket);

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Verificar se o usuário é administrador do grupo
    const groupInfo = await wbot.groupMetadata(`${ticket.contact.number}@g.us`);
    if (groupInfo.owner !== wbot.user?.id) {
      throw new AppError("ERR_NOT_GROUP_OWNER");
    }

    // Adicionar administradores
    await wbot.groupParticipantsUpdate(
      `${ticket.contact.number}@g.us`,
      participants,
      "promote"
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
    logger.error(`AddGroupAdmin | Error: ${err}`);
    throw new AppError("ERR_ADDING_GROUP_ADMIN");
  }
};

const RemoveGroupAdmin = async ({
  ticket,
  participants
}: RemoveGroupAdminRequest): Promise<void> => {
  try {
    const wbot = await GetTicketBaileys(ticket);

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Verificar se o usuário é administrador do grupo
    const groupInfo = await wbot.groupMetadata(`${ticket.contact.number}@g.us`);
    if (groupInfo.owner !== wbot.user?.id) {
      throw new AppError("ERR_NOT_GROUP_OWNER");
    }

    // Remover administradores
    await wbot.groupParticipantsUpdate(
      `${ticket.contact.number}@g.us`,
      participants,
      "demote"
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
    logger.error(`RemoveGroupAdmin | Error: ${err}`);
    throw new AppError("ERR_REMOVING_GROUP_ADMIN");
  }
};

const GetGroupAdmins = async ({
  ticket
}: GetGroupAdminsRequest): Promise<GroupAdmin[]> => {
  try {
    const wbot = await GetTicketBaileys(ticket);

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Obter informações do grupo
    const groupInfo = await wbot.groupMetadata(`${ticket.contact.number}@g.us`);

    if (!groupInfo) {
      throw new AppError("ERR_GROUP_NOT_FOUND");
    }

    // Filtrar apenas administradores
    const admins = groupInfo.participants.filter(
      p => p.admin === "admin" || p.admin === "superadmin"
    );

    // Obter informações detalhadas dos administradores
    const detailedAdmins = admins.map((admin) => {
      return {
        id: admin.id,
        name: undefined, // fetchStatus não está disponível no tipo WASocket
        pushName: undefined
      };
    });

    return detailedAdmins;
  } catch (err) {
    logger.error(`GetGroupAdmins | Error: ${err}`);
    throw new AppError("ERR_GETTING_GROUP_ADMINS");
  }
};

export {
  AddGroupAdmin,
  RemoveGroupAdmin,
  GetGroupAdmins
};