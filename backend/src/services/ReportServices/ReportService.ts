import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import messageQueue from "../QueueServices/MessageQueue";
import BaileysSessionMonitor from "../BaileysServices/BaileysSessionMonitor";

interface ReportFilters {
  startDate: Date;
  endDate: Date;
  whatsappId?: number;
  userId?: number;
  status?: string;
  tenantId: number;
}

interface TicketReport {
  total: number;
  open: number;
  closed: number;
  pending: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  byStatus: { [key: string]: number };
  byHour: { [key: string]: number };
  byDay: { [key: string]: number };
  byUser: { [key: string]: number };
}

interface MessageReport {
  total: number;
  sent: number;
  received: number;
  byType: { [key: string]: number };
  byHour: { [key: string]: number };
  byDay: { [key: string]: number };
  avgResponseTime: number;
}

interface CallInfo {
  status: 'ongoing' | 'ended' | 'missed' | 'rejected';
  type: string;
  duration?: number;
}

interface QueueJob {
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  timestamp: number;
  data: {
    type?: string;
    [key: string]: any;
  };
}

interface CallReport {
  total: number;
  answered: number;
  missed: number;
  rejected: number;
  avgDuration: number;
  byType: { [key: string]: number };
  byHour: { [key: string]: number };
  byDay: { [key: string]: number };
}

interface QueueReport {
  total: number;
  processed: number;
  failed: number;
  avgProcessingTime: number;
  byType: { [key: string]: number };
  byHour: { [key: string]: number };
  byDay: { [key: string]: number };
}

interface SessionReport {
  total: number;
  active: number;
  disconnected: number;
  avgUptime: number;
  totalMessages: number;
  totalErrors: number;
  totalReconnects: number;
  byStatus: { [key: string]: number };
}

interface SystemReport {
  tickets: TicketReport;
  messages: MessageReport;
  calls: CallReport;
  queue: QueueReport;
  sessions: SessionReport;
  period: {
    start: Date;
    end: Date;
  };
}

class ReportService {
  private static instance: ReportService;

  private constructor() {}

  public static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  public async generateSystemReport(filters: ReportFilters): Promise<SystemReport> {
    try {
      const [
        ticketReport,
        messageReport,
        callReport,
        queueReport,
        sessionReport
      ] = await Promise.all([
        this.generateTicketReport(filters),
        this.generateMessageReport(filters),
        this.generateCallReport(filters),
        this.generateQueueReport(filters),
        this.generateSessionReport(filters)
      ]);

      return {
        tickets: ticketReport,
        messages: messageReport,
        calls: callReport,
        queue: queueReport,
        sessions: sessionReport,
        period: {
          start: filters.startDate,
          end: filters.endDate
        }
      };
    } catch (err) {
      logger.error(`Error generating system report: ${err}`);
      throw err;
    }
  }

  private async generateTicketReport(filters: ReportFilters): Promise<TicketReport> {
    const where: any = {
      tenantId: filters.tenantId,
      createdAt: {
        [Op.between]: [filters.startDate, filters.endDate]
      }
    };

    if (filters.whatsappId) {
      where.whatsappId = filters.whatsappId;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const tickets = await Ticket.findAll({
      where,
      include: [
        { model: User, as: "user" },
        { model: Message, as: "messages" }
      ]
    });

    const report: TicketReport = {
      total: tickets.length,
      open: tickets.filter(t => t.status === "open").length,
      closed: tickets.filter(t => t.status === "closed").length,
      pending: tickets.filter(t => t.status === "pending").length,
      avgResponseTime: 0,
      avgResolutionTime: 0,
      byStatus: {},
      byHour: {},
      byDay: {},
      byUser: {}
    };

    // Calcular métricas
    let totalResponseTime = 0;
    let totalResolutionTime = 0;
    let responseCount = 0;
    let resolutionCount = 0;

    tickets.forEach(ticket => {
      // Agrupar por status
      report.byStatus[ticket.status] = (report.byStatus[ticket.status] || 0) + 1;

      // Agrupar por hora
      const hour = ticket.createdAt.getHours();
      report.byHour[hour] = (report.byHour[hour] || 0) + 1;

      // Agrupar por dia
      const day = ticket.createdAt.toISOString().split("T")[0];
      report.byDay[day] = (report.byDay[day] || 0) + 1;

      // Agrupar por usuário
      if (ticket.user) {
        report.byUser[ticket.user.name] = (report.byUser[ticket.user.name] || 0) + 1;
      }

      // Calcular tempos médios
      const messages = ticket.messages || [];
      const firstUserMessage = messages.find(m => m.fromMe);
      const lastMessage = messages[messages.length - 1];

      if (firstUserMessage) {
        const responseTime = firstUserMessage.createdAt.getTime() - ticket.createdAt.getTime();
        totalResponseTime += responseTime;
        responseCount++;
      }

      if (ticket.status === "closed" && lastMessage) {
        const resolutionTime = lastMessage.createdAt.getTime() - ticket.createdAt.getTime();
        totalResolutionTime += resolutionTime;
        resolutionCount++;
      }
    });

    report.avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
    report.avgResolutionTime = resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0;

    return report;
  }

  private async generateMessageReport(filters: ReportFilters): Promise<MessageReport> {
    const where: any = {
      tenantId: filters.tenantId,
      createdAt: {
        [Op.between]: [filters.startDate, filters.endDate]
      }
    };

    if (filters.whatsappId) {
      where.whatsappId = filters.whatsappId;
    }

    const messages = await Message.findAll({ where });

    const report: MessageReport = {
      total: messages.length,
      sent: messages.filter(m => m.fromMe).length,
      received: messages.filter(m => !m.fromMe).length,
      byType: {},
      byHour: {},
      byDay: {},
      avgResponseTime: 0
    };

    // Calcular métricas
    let totalResponseTime = 0;
    let responseCount = 0;

    messages.forEach(message => {
      // Agrupar por tipo
      const type = message.mediaType || "text";
      report.byType[type] = (report.byType[type] || 0) + 1;

      // Agrupar por hora
      const hour = message.createdAt.getHours();
      report.byHour[hour] = (report.byHour[hour] || 0) + 1;

      // Agrupar por dia
      const day = message.createdAt.toISOString().split("T")[0];
      report.byDay[day] = (report.byDay[day] || 0) + 1;

      // Calcular tempo médio de resposta
      if (message.fromMe) {
        const ticket = message.ticket;
        if (ticket) {
          const lastReceivedMessage = ticket.messages
            .filter(m => !m.fromMe)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

          if (lastReceivedMessage) {
            const responseTime = message.createdAt.getTime() - lastReceivedMessage.createdAt.getTime();
            totalResponseTime += responseTime;
            responseCount++;
          }
        }
      }
    });

    report.avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    return report;
  }

  private async generateCallReport(filters: ReportFilters): Promise<CallReport> {
    const where: any = {
      tenantId: filters.tenantId,
      createdAt: {
        [Op.between]: [filters.startDate, filters.endDate]
      },
      callInfo: {
        [Op.ne]: null
      }
    };

    if (filters.whatsappId) {
      where.whatsappId = filters.whatsappId;
    }

    const tickets = await Ticket.findAll({ where });

    const report: CallReport = {
      total: tickets.length,
      answered: 0,
      missed: 0,
      rejected: 0,
      avgDuration: 0,
      byType: {},
      byHour: {},
      byDay: {}
    };

    let totalDuration = 0;
    let durationCount = 0;

    tickets.forEach(ticket => {
      const callInfo = (ticket as any).callInfo as CallInfo;
      if (!callInfo) return;

      // Contar por status
      switch (callInfo.status) {
        case "ongoing":
        case "ended":
          report.answered++;
          break;
        case "missed":
          report.missed++;
          break;
        case "rejected":
          report.rejected++;
          break;
      }

      // Agrupar por tipo
      report.byType[callInfo.type] = (report.byType[callInfo.type] || 0) + 1;

      // Agrupar por hora
      const hour = ticket.createdAt.getHours();
      report.byHour[hour] = (report.byHour[hour] || 0) + 1;

      // Agrupar por dia
      const day = ticket.createdAt.toISOString().split("T")[0];
      report.byDay[day] = (report.byDay[day] || 0) + 1;

      // Calcular duração média
      if (callInfo.duration) {
        totalDuration += callInfo.duration;
        durationCount++;
      }
    });

    report.avgDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    return report;
  }

  private async generateQueueReport(filters: ReportFilters): Promise<QueueReport> {
    const jobs = await messageQueue.getJobs(["completed", "failed", "delayed", "active"], 0, -1) as unknown as QueueJob[];

    const report: QueueReport = {
      total: jobs.length,
      processed: 0,
      failed: 0,
      avgProcessingTime: 0,
      byType: {},
      byHour: {},
      byDay: {}
    };

    let totalProcessingTime = 0;
    let processingCount = 0;

    jobs.forEach(job => {
      // Contar por status
      if (job.processedOn && job.finishedOn) {
        report.processed++;
        const processingTime = job.finishedOn - job.processedOn;
        totalProcessingTime += processingTime;
        processingCount++;
      } else if (job.failedReason) {
        report.failed++;
      }

      // Agrupar por tipo
      const type = job.data.type || "unknown";
      report.byType[type] = (report.byType[type] || 0) + 1;

      // Agrupar por hora
      const hour = new Date(job.timestamp).getHours();
      report.byHour[hour] = (report.byHour[hour] || 0) + 1;

      // Agrupar por dia
      const day = new Date(job.timestamp).toISOString().split("T")[0];
      report.byDay[day] = (report.byDay[day] || 0) + 1;
    });

    report.avgProcessingTime = processingCount > 0 ? totalProcessingTime / processingCount : 0;

    return report;
  }

  private async generateSessionReport(filters: ReportFilters): Promise<SessionReport> {
    const whatsapps = await Whatsapp.findAll({
      where: {
        tenantId: filters.tenantId,
        ...(filters.whatsappId ? { id: filters.whatsappId } : {})
      }
    });

    const report: SessionReport = {
      total: whatsapps.length,
      active: 0,
      disconnected: 0,
      avgUptime: 0,
      totalMessages: 0,
      totalErrors: 0,
      totalReconnects: 0,
      byStatus: {}
    };

    let totalUptime = 0;
    let uptimeCount = 0;

    whatsapps.forEach(whatsapp => {
      const metrics = BaileysSessionMonitor.getMetrics(whatsapp.id);
      if (!metrics) return;

      // Contar por status
      report.byStatus[metrics.status] = (report.byStatus[metrics.status] || 0) + 1;

      if (metrics.status === 'connected') {
        report.active++;
      } else {
        report.disconnected++;
      }

      // Acumular métricas
      report.totalMessages += metrics.messageCount;
      report.totalErrors += metrics.errorCount;
      report.totalReconnects += metrics.reconnectCount;

      if (metrics.uptime > 0) {
        totalUptime += metrics.uptime;
        uptimeCount++;
      }
    });

    report.avgUptime = uptimeCount > 0 ? totalUptime / uptimeCount : 0;

    return report;
  }

  public async exportReport(report: SystemReport, format: "csv" | "json" | "pdf"): Promise<string> {
    try {
      switch (format) {
        case "csv":
          return this.exportToCSV(report);
        case "json":
          return JSON.stringify(report, null, 2);
        case "pdf":
          return await this.exportToPDF(report);
        default:
          throw new AppError("Unsupported export format", 400);
      }
    } catch (err) {
      logger.error(`Error exporting report: ${err}`);
      throw err;
    }
  }

  private exportToCSV(report: SystemReport): string {
    // TODO: Implementar exportação para CSV
    throw new AppError("CSV export not implemented", 501);
  }

  private async exportToPDF(report: SystemReport): Promise<string> {
    // TODO: Implementar exportação para PDF
    throw new AppError("PDF export not implemented", 501);
  }
}

export default ReportService.getInstance();