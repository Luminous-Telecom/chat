import TicketParticipant from "../../models/TicketParticipant";
import User from "../../models/User";
import Ticket from "../../models/Ticket";

interface AddParticipantRequest {
  ticketId: number;
  userId: number;
  tenantId: number;
}

interface RemoveParticipantRequest {
  ticketId: number;
  userId: number;
  tenantId: number;
}

class TicketParticipantService {
  async addParticipant({ ticketId, userId, tenantId }: AddParticipantRequest): Promise<TicketParticipant> {
    // Verificar se o participante já existe
    const existingParticipant = await TicketParticipant.findOne({
      where: {
        ticketId,
        userId,
        tenantId,
      },
    });

    if (existingParticipant) {
      // Se existe mas está inativo, ativar novamente
      if (!existingParticipant.isActive) {
        existingParticipant.isActive = true;
        existingParticipant.joinedAt = new Date();
        await existingParticipant.save();
      }
      return existingParticipant;
    }

    // Criar novo participante
    const participant = await TicketParticipant.create({
      ticketId,
      userId,
      tenantId,
      joinedAt: new Date(),
      isActive: true,
    });

    return participant;
  }

  async removeParticipant({ ticketId, userId, tenantId }: RemoveParticipantRequest): Promise<void> {
    const participant = await TicketParticipant.findOne({
      where: {
        ticketId,
        userId,
        tenantId,
      },
    });

    if (participant) {
      participant.isActive = false;
      await participant.save();
    }
  }

  async getTicketParticipants(ticketId: number, tenantId: number): Promise<TicketParticipant[]> {
    const participants = await TicketParticipant.findAll({
      where: {
        ticketId,
        tenantId,
        isActive: true,
      },
      include: [
        {
          model: User,
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["joinedAt", "ASC"]],
    });

    return participants;
  }

  async isUserParticipant(ticketId: number, userId: number, tenantId: number): Promise<boolean> {
    const participant = await TicketParticipant.findOne({
      where: {
        ticketId,
        userId,
        tenantId,
        isActive: true,
      },
    });

    return !!participant;
  }

  async canUserAccessTicket(ticketId: number, userId: number, tenantId: number): Promise<boolean> {
    // Verificar se é o dono do ticket
    const ticket = await Ticket.findOne({
      where: {
        id: ticketId,
        tenantId,
      },
    });

    if (ticket && ticket.userId === userId) {
      return true;
    }

    // Verificar se é participante
    return this.isUserParticipant(ticketId, userId, tenantId);
  }
}

export default TicketParticipantService; 