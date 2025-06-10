import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import { getBaileys } from "../../libs/baileys";
import BaileysSessionMonitor from "../BaileysServices/BaileysSessionMonitor";
import messageQueue from "../QueueServices/MessageQueue";

interface SystemMetrics {
  timestamp: number;
  whatsappSessions: {
    id: number;
    status: string;
    messageCount: number;
    errorCount: number;
    reconnectCount: number;
    uptime: number;
    lastError?: string;
  }[];
  queueMetrics: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  systemMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
  };
}

class SystemMetricsService {
  private static instance: SystemMetricsService;
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly METRICS_INTERVAL = 60000; // 1 minuto

  private constructor() {}

  public static getInstance(): SystemMetricsService {
    if (!SystemMetricsService.instance) {
      SystemMetricsService.instance = new SystemMetricsService();
    }
    return SystemMetricsService.instance;
  }

  public async start(): Promise<void> {
    if (this.metricsInterval) {
      logger.warn("System metrics service already running");
      return;
    }

    logger.info("Starting system metrics service");
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectAndEmitMetrics();
      } catch (err) {
        logger.error(`Error collecting system metrics: ${err}`);
      }
    }, this.METRICS_INTERVAL);

    // Coletar métricas imediatamente
    await this.collectAndEmitMetrics();
  }

  public stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      logger.info("System metrics service stopped");
    }
  }

  private async collectAndEmitMetrics(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      await this.emitMetrics(metrics);
      this.logMetrics(metrics);
    } catch (err) {
      logger.error(`Error in collectAndEmitMetrics: ${err}`);
    }
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const whatsapps = await Whatsapp.findAll();
    const whatsappSessions = await Promise.all(
      whatsapps.map(async (whatsapp) => {
        try {
          const wbot = getBaileys(whatsapp.id);
          const sessionMetrics = BaileysSessionMonitor.getMetrics(whatsapp.id);

          return {
            id: whatsapp.id,
            status: wbot ? "online" : "offline",
            messageCount: sessionMetrics?.messageCount || 0,
            errorCount: sessionMetrics?.errorCount || 0,
            reconnectCount: sessionMetrics?.reconnectCount || 0,
            uptime: sessionMetrics?.uptime || 0,
            lastError: sessionMetrics?.lastError
          };
        } catch (err) {
          // Se a sessão não estiver inicializada, retornar métricas básicas
          return {
            id: whatsapp.id,
            status: "initializing",
            messageCount: 0,
            errorCount: 0,
            reconnectCount: 0,
            uptime: 0,
            lastError: err.message
          };
        }
      })
    );

    const queueMetrics = await messageQueue.getJobCounts();

    const systemMetrics = {
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpuUsage: process.cpuUsage().user / 1000000, // segundos
      uptime: process.uptime()
    };

    return {
      timestamp: Date.now(),
      whatsappSessions,
      queueMetrics,
      systemMetrics
    };
  }

  private async emitMetrics(metrics: SystemMetrics): Promise<void> {
    const io = getIO();
    
    // Emitir métricas para cada tenant
    const whatsappPromises = metrics.whatsappSessions.map(async session => {
      const whatsapp = await Whatsapp.findByPk(session.id);
      return whatsapp?.tenantId;
    });
    
    const tenantIds = await Promise.all(whatsappPromises);
    const tenants = new Set(tenantIds.filter(Boolean));

    for (const tenantId of tenants) {
      if (tenantId) {
        const sessionPromises = metrics.whatsappSessions.map(async session => {
          const whatsapp = await Whatsapp.findByPk(session.id);
          return whatsapp?.tenantId === tenantId ? session : null;
        });
        
        const sessions = await Promise.all(sessionPromises);
        const tenantMetrics = {
          ...metrics,
          whatsappSessions: sessions.filter((session): session is NonNullable<typeof session> => session !== null)
        };
        io.emit(`${tenantId}:metrics`, tenantMetrics);
      }
    }
  }

  private logMetrics(metrics: SystemMetrics): void {
    // Log detalhado das métricas
    logger.info("System Metrics", {
      timestamp: new Date(metrics.timestamp).toISOString(),
      sessions: metrics.whatsappSessions.map(session => ({
        id: session.id,
        status: session.status,
        messageCount: session.messageCount,
        errorCount: session.errorCount,
        uptime: Math.floor(session.uptime / 60) + " minutes"
      })),
      queue: metrics.queueMetrics,
      system: {
        memoryUsage: Math.floor(metrics.systemMetrics.memoryUsage) + " MB",
        cpuUsage: metrics.systemMetrics.cpuUsage.toFixed(2) + " seconds",
        uptime: Math.floor(metrics.systemMetrics.uptime / 60) + " minutes"
      }
    });

    // Log de alertas
    this.checkAndLogAlerts(metrics);
  }

  private checkAndLogAlerts(metrics: SystemMetrics): void {
    // Verificar métricas críticas
    const alerts: string[] = [];

    // Alertas de sessão
    metrics.whatsappSessions.forEach(session => {
      if (session.errorCount > 10) {
        alerts.push(`High error count for session ${session.id}: ${session.errorCount} errors`);
      }
      if (session.reconnectCount > 5) {
        alerts.push(`Multiple reconnections for session ${session.id}: ${session.reconnectCount} reconnects`);
      }
    });

    // Alertas de fila
    if (metrics.queueMetrics.failed > 0) {
      alerts.push(`Failed jobs in queue: ${metrics.queueMetrics.failed}`);
    }
    if (metrics.queueMetrics.waiting > 100) {
      alerts.push(`High queue backlog: ${metrics.queueMetrics.waiting} jobs waiting`);
    }

    // Alertas do sistema
    if (metrics.systemMetrics.memoryUsage > 1024) { // > 1GB
      alerts.push(`High memory usage: ${Math.floor(metrics.systemMetrics.memoryUsage)} MB`);
    }
    if (metrics.systemMetrics.cpuUsage > 300) { // > 5 minutes
      alerts.push(`High CPU usage: ${metrics.systemMetrics.cpuUsage.toFixed(2)} seconds`);
    }

    // Log de alertas
    if (alerts.length > 0) {
      logger.warn("System Alerts", { alerts });
    }
  }
}

export default SystemMetricsService.getInstance();