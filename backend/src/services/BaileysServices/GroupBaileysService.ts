import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { getBaileys } from "./BaileysService";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

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

interface AddParticipantsRequest {
  ticket: Ticket;
  participants: string[];
}

interface RemoveParticipantsRequest {
  ticket: Ticket;
  participants: string[];
}

interface PromoteParticipantsRequest {
  ticket: Ticket;
  participants: string[];
}

interface DemoteParticipantsRequest {
  ticket: Ticket;
  participants: string[];
}

interface LeaveGroupRequest {
  ticket: Ticket;
}

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
        name
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

    // Atualizar nome se fornecido
    if (name) {
      await wbot.groupUpdateSubject(ticket.contact.number, name);
    }

    // Atualizar descrição se fornecida
    if (description) {
      await wbot.groupUpdateDescription(ticket.contact.number, description);
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

const AddParticipants = async ({
  ticket,
  participants
}: AddParticipantsRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
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
    logger.error(`AddParticipants | Error: ${err}`);
    throw new AppError("ERR_ADDING_PARTICIPANTS");
  }
};

const RemoveParticipants = async ({
  ticket,
  participants
}: RemoveParticipantsRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
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
    logger.error(`RemoveParticipants | Error: ${err}`);
    throw new AppError("ERR_REMOVING_PARTICIPANTS");
  }
};

const PromoteParticipants = async ({
  ticket,
  participants
}: PromoteParticipantsRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Promover participantes
    await wbot.groupParticipantsUpdate(
      ticket.contact.number,
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
    logger.error(`PromoteParticipants | Error: ${err}`);
    throw new AppError("ERR_PROMOTING_PARTICIPANTS");
  }
};

const DemoteParticipants = async ({
  ticket,
  participants
}: DemoteParticipantsRequest): Promise<void> => {
  try {
    const wbot = getBaileys(ticket.whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    if (!ticket.isGroup) {
      throw new AppError("ERR_NOT_GROUP_TICKET");
    }

    // Rebaixar participantes
    await wbot.groupParticipantsUpdate(
      ticket.contact.number,
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
    logger.error(`DemoteParticipants | Error: ${err}`);
    throw new AppError("ERR_DEMOTING_PARTICIPANTS");
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

    // Sair do grupo
    await wbot.groupLeave(ticket.contact.number);

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
  CreateGroup,
  UpdateGroup,
  AddParticipants,
  RemoveParticipants,
  PromoteParticipants,
  DemoteParticipants,
  LeaveGroup
};