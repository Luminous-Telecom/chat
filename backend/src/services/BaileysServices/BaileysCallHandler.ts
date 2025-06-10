import { WASocket, WACallEvent } from '@whiskeysockets/baileys';
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import { WhatsAppErrors } from "../../utils/errorHandler";
import { getBaileys } from "../../libs/baileys";
import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import BaileysSessionMonitor from "./BaileysSessionMonitor";
import { addToMessageQueue } from "../QueueServices/MessageQueue";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

interface CallInfo {
  id: string;
  from: string;
  timestamp: number;
  type: 'audio' | 'video';
  status: 'ringing' | 'ongoing' | 'ended' | 'missed' | 'rejected';
  duration?: number;
  ticketId?: number;
}

class BaileysCallHandler {
  private static instance: BaileysCallHandler;
  private activeCalls: Map<string, CallInfo>;
  private readonly CALL_TIMEOUT = 60000; // 1 minuto
  private readonly MAX_CALL_DURATION = 3600000; // 1 hora

  private constructor() {
    this.activeCalls = new Map();
  }

  public static getInstance(): BaileysCallHandler {
    if (!BaileysCallHandler.instance) {
      BaileysCallHandler.instance = new BaileysCallHandler();
    }
    return BaileysCallHandler.instance;
  }

  public async initialize(session: Session): Promise<void> {
    try {
      // Configurar handlers de chamada
      session.ev.on('call', async (calls: WACallEvent[]) => {
        for (const call of calls) {
          await this.handleIncomingCall(session, call);
        }
      });

      logger.info(`Call handlers initialized for session ${session.id}`);
    } catch (err) {
      logger.error(`Error initializing call handlers for session ${session.id}: ${err}`);
      BaileysSessionMonitor.recordError(session.id, `Call handler init error: ${err.message}`);
    }
  }

  private async handleIncomingCall(session: Session, call: WACallEvent): Promise<void> {
    try {
      const callId = call.id;
      const caller = call.from;
      const callType = call.isVideo ? 'video' : 'audio';

      // Criar registro da chamada
      const callInfo: CallInfo = {
        id: callId,
        from: caller,
        timestamp: Date.now(),
        type: callType,
        status: 'ringing'
      };

      this.activeCalls.set(callId, callInfo);

      // Buscar ou criar contato
      const contact = await Contact.findOne({
        where: { number: caller.split('@')[0] }
      });

      if (!contact) {
        logger.warn(`Incoming call from unknown number: ${caller}`);
        return;
      }

      // Criar ou recuperar ticket
      const ticket = await FindOrCreateTicketService({
        contact,
        whatsappId: session.id,
        unreadMessages: 0,
        tenantId: session.tenantId,
        channel: "whatsapp",
        callInfo: {
          type: callType,
          status: 'ringing'
        }
      });

      if (ticket) {
        callInfo.ticketId = ticket.id;
        this.activeCalls.set(callId, callInfo);

        // Emitir evento de chamada recebida
        const io = getIO();
        io.emit(`${session.tenantId}:call`, {
          action: "incoming",
          call: callInfo,
          ticket,
          contact
        });

        // Configurar timeout para chamada não atendida
        setTimeout(() => {
          const currentCall = this.activeCalls.get(callId);
          if (currentCall && currentCall.status === 'ringing') {
            this.handleMissedCall(session, callId);
          }
        }, this.CALL_TIMEOUT);
      }
    } catch (err) {
      logger.error(`Error handling incoming call: ${err}`);
      BaileysSessionMonitor.recordError(session.id, `Call handling error: ${err.message}`);
    }
  }

  private async handleCallUpdate(session: Session, call: WACallEvent): Promise<void> {
    try {
      const callId = call.id;
      const callInfo = this.activeCalls.get(callId);

      if (!callInfo) {
        logger.warn(`Call update for unknown call: ${callId}`);
        return;
      }

      const io = getIO();

      switch (call.status) {
        case 'offer':
          // Chamada iniciada
          callInfo.status = 'ongoing';
          break;

        case 'accept':
          // Chamada aceita
          callInfo.status = 'ongoing';
          break;

        case 'reject':
          // Chamada rejeitada
          callInfo.status = 'rejected';
          break;

        case 'terminate':
          // Chamada finalizada
          callInfo.status = 'ended';
          callInfo.duration = Date.now() - callInfo.timestamp;
          break;

        case 'timeout':
          // Chamada perdida por timeout
          callInfo.status = 'missed';
          break;

        default:
          logger.warn(`Unknown call status: ${call.status}`);
          return;
      }

      this.activeCalls.set(callId, callInfo);

      if (callInfo.ticketId) {
        const ticket = await Ticket.findByPk(callInfo.ticketId, {
          include: [
            { model: Contact, as: "contact" },
            { model: Whatsapp, as: "whatsapp" }
          ]
        });

        if (ticket) {
          // Atualizar ticket
          await ticket.update({
            callInfo: {
              type: callInfo.type,
              status: callInfo.status,
              duration: callInfo.duration
            }
          });

          // Emitir evento de atualização
          io.emit(`${session.tenantId}:call`, {
            action: "update",
            call: callInfo,
            ticket,
            contact: ticket.contact
          });

          // Se a chamada terminou, criar mensagem de registro
          if (callInfo.status === 'ended' || callInfo.status === 'missed' || callInfo.status === 'rejected') {
            const messageBody = this.generateCallMessage(callInfo);
            await addToMessageQueue('text', {
              ticketId: ticket.id,
              body: messageBody
            });
          }
        }
      }

      // Limpar chamada se terminada
      if (['ended', 'rejected', 'missed'].includes(callInfo.status)) {
        this.activeCalls.delete(callId);
      }
    } catch (err) {
      logger.error(`Error handling call update: ${err}`);
      BaileysSessionMonitor.recordError(session.id, `Call update error: ${err.message}`);
    }
  }

  private async handleMissedCall(session: Session, callId: string): Promise<void> {
    const callInfo = this.activeCalls.get(callId);
    if (!callInfo) return;

    callInfo.status = 'missed';
    this.activeCalls.set(callId, callInfo);

    if (callInfo.ticketId) {
      const ticket = await Ticket.findByPk(callInfo.ticketId, {
        include: [
          { model: Contact, as: "contact" },
          { model: Whatsapp, as: "whatsapp" }
        ]
      });

      if (ticket) {
        // Atualizar ticket
        await ticket.update({
          callInfo: {
            type: callInfo.type,
            status: 'missed'
          }
        });

        // Emitir evento
        const io = getIO();
        io.emit(`${session.tenantId}:call`, {
          action: "update",
          call: callInfo,
          ticket,
          contact: ticket.contact
        });

        // Criar mensagem de chamada perdida
        const messageBody = this.generateCallMessage(callInfo);
        await addToMessageQueue('text', {
          ticketId: ticket.id,
          body: messageBody
        });
      }
    }

    this.activeCalls.delete(callId);
  }

  private generateCallMessage(callInfo: CallInfo): string {
    const duration = callInfo.duration ? 
      Math.floor(callInfo.duration / 1000) : 0;
    
    const durationStr = duration > 0 ? 
      `Duração: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : '';

    switch (callInfo.status) {
      case 'ended':
        return `📞 Chamada de ${callInfo.type === 'video' ? 'vídeo' : 'voz'} finalizada. ${durationStr}`;
      case 'missed':
        return `📞 Chamada de ${callInfo.type === 'video' ? 'vídeo' : 'voz'} perdida`;
      case 'rejected':
        return `📞 Chamada de ${callInfo.type === 'video' ? 'vídeo' : 'voz'} rejeitada`;
      default:
        return `📞 Chamada de ${callInfo.type === 'video' ? 'vídeo' : 'voz'}`;
    }
  }

  public async acceptCall(session: Session, callId: string, callFrom: string): Promise<void> {
    try {
      const wbot = getBaileys(session.id);
      if (!wbot) {
        throw WhatsAppErrors.sessionNotFound('WhatsApp session not found');
      }

      // Note: acceptCall method may not exist in current Baileys version
      // This is a placeholder for future implementation
      logger.warn('acceptCall method not available in current Baileys version');
    } catch (err) {
      logger.error(`Error accepting call: ${err}`);
      BaileysSessionMonitor.recordError(session.id, `Call accept error: ${err.message}`);
      throw err;
    }
  }

  public async rejectCall(session: Session, callId: string, callFrom: string): Promise<void> {
    try {
      const wbot = getBaileys(session.id);
      if (!wbot) {
        throw WhatsAppErrors.sessionNotFound('WhatsApp session not found');
      }

      await wbot.rejectCall(callId, callFrom);
    } catch (err) {
      logger.error(`Error rejecting call: ${err}`);
      BaileysSessionMonitor.recordError(session.id, `Call reject error: ${err.message}`);
      throw err;
    }
  }

  public async endCall(session: Session, callId: string): Promise<void> {
    try {
      const wbot = getBaileys(session.id);
      if (!wbot) {
        throw WhatsAppErrors.sessionNotFound('WhatsApp session not found');
      }

      // Note: endCall method does not exist in Baileys API
      // Calls typically end automatically or through rejectCall
      logger.warn('endCall method not available in Baileys API');
    } catch (err) {
      logger.error(`Error ending call: ${err}`);
      BaileysSessionMonitor.recordError(session.id, `Call end error: ${err.message}`);
      throw err;
    }
  }

  public getActiveCall(callId: string): CallInfo | undefined {
    return this.activeCalls.get(callId);
  }

  public getActiveCalls(): CallInfo[] {
    return Array.from(this.activeCalls.values());
  }
}

export default BaileysCallHandler.getInstance();