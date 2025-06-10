import { logger } from "../../utils/logger";
import { getBaileys, isSessionReady, updateSessionState } from "../../libs/baileys";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import { StartBaileysSession } from "./StartBaileysSession";
import { addToMessageQueue } from "../QueueServices/MessageQueue";
import AppError from "../../errors/AppError";

interface SessionMetrics {
  whatsappId: number;
  status: string;
  lastHeartbeat: number;
  messageCount: number;
  errorCount: number;
  reconnectCount: number;
  uptime: number;
  lastError?: string;
  lastErrorTime?: number;
}

class BaileysSessionMonitor {
  private metrics: Map<number, SessionMetrics>;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 10000; // 10 segundos
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 segundos
  private readonly MAX_ERROR_THRESHOLD = 3; // Número máximo de erros antes de reiniciar
  private readonly ERROR_WINDOW = 300000; // 5 minutos

  constructor() {
    this.metrics = new Map();
  }

  public getMetrics(whatsappId: number): SessionMetrics | undefined {
    return this.metrics.get(whatsappId);
  }

  public getAllMetrics(): SessionMetrics[] {
    return Array.from(this.metrics.values());
  }

  public async start(): Promise<void> {
    logger.info('Starting BaileysSessionMonitor...');
    this.healthCheckInterval = setInterval(() => {
      this.checkAllSessions();
    }, this.HEALTH_CHECK_INTERVAL);
    logger.info('BaileysSessionMonitor started successfully');
  }

  public async stop(): Promise<void> {
    logger.info('Stopping BaileysSessionMonitor...');
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    this.metrics.clear();
    logger.info('BaileysSessionMonitor stopped successfully');
  }

  public recordError(whatsappId: number, error: string): void {
    try {
      const metrics = this.metrics.get(whatsappId) || this.initializeMetrics(whatsappId);
      metrics.errorCount++;
      metrics.lastError = error;
      metrics.lastErrorTime = Date.now();
      metrics.status = 'error';
      this.metrics.set(whatsappId, metrics);
      
      logger.warn(`Recorded error for session ${whatsappId}: ${error}`);
      this.emitMetrics(whatsappId);
    } catch (err) {
      logger.error(`Error recording session error: ${err}`);
    }
  }

  private async checkAllSessions(): Promise<void> {
    try {
      const whatsapps = await Whatsapp.findAll({
        where: {
          isActive: true,
          isDeleted: false,
          type: "whatsapp"
        }
      });

      for (const whatsapp of whatsapps) {
        await this.checkSession(whatsapp);
      }
    } catch (err) {
      logger.error(`Error checking sessions: ${err}`);
    }
  }

  private async checkSession(whatsapp: Whatsapp): Promise<void> {
    const metrics = this.metrics.get(whatsapp.id) || this.initializeMetrics(whatsapp.id);
    const now = Date.now();

    try {
      const session = getBaileys(whatsapp.id);
      if (!session) {
        throw new AppError("Session not found");
      }

      // Atualizar métricas
      metrics.lastHeartbeat = now;
      metrics.uptime = now - metrics.lastHeartbeat;
      metrics.status = isSessionReady(whatsapp.id) ? 'ready' : 'not_ready';
      this.metrics.set(whatsapp.id, metrics);

      // Verificar se há muitos erros recentes
      if (metrics.errorCount >= this.MAX_ERROR_THRESHOLD && 
          metrics.lastErrorTime && 
          now - metrics.lastErrorTime < this.ERROR_WINDOW) {
        logger.warn(`Session ${whatsapp.id} has too many errors, restarting...`);
        await this.handleSessionError(whatsapp, new AppError("Too many errors in short time"));
        return;
      }

      // Emitir métricas
      this.emitMetrics(whatsapp.id);
    } catch (err) {
      logger.error(`Error checking session ${whatsapp.id}: ${err}`);
      await this.handleSessionError(whatsapp, err);
    }
  }

  private initializeMetrics(whatsappId: number): SessionMetrics {
    const metrics: SessionMetrics = {
      whatsappId,
      status: "initializing",
      lastHeartbeat: Date.now(),
      messageCount: 0,
      errorCount: 0,
      reconnectCount: 0,
      uptime: 0
    };
    this.metrics.set(whatsappId, metrics);
    return metrics;
  }

  private async handleSessionError(whatsapp: Whatsapp, error: Error): Promise<void> {
    const metrics = this.metrics.get(whatsapp.id);
    if (!metrics) return;

    metrics.status = 'error';
    metrics.errorCount++;
    metrics.lastError = error.message;
    metrics.lastErrorTime = Date.now();

    if (metrics.reconnectCount < this.MAX_RECONNECT_ATTEMPTS) {
      metrics.reconnectCount++;
      this.metrics.set(whatsapp.id, metrics);

      logger.info(`Attempting to reconnect session ${whatsapp.id} (attempt ${metrics.reconnectCount})`);
      
      try {
        // Atualizar estado antes de tentar reconectar
        updateSessionState(whatsapp.id, { 
          isInitializing: false,
          isReady: false,
          lastHeartbeat: Date.now(),
          lastError: error
        });

        await StartBaileysSession(whatsapp, true);
        metrics.status = 'reconnecting';
        metrics.errorCount = 0; // Reset error count on successful reconnect
      } catch (err) {
        logger.error(`Error reconnecting session ${whatsapp.id}: ${err}`);
        metrics.lastError = err.message;
      }
    } else {
      metrics.status = 'failed';
      logger.error(`Session ${whatsapp.id} failed after ${metrics.reconnectCount} reconnection attempts`);
      
      // Notificar administradores
      const io = getIO();
      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
        action: "error",
        session: {
          whatsappId: whatsapp.id,
          error: "Session failed after multiple reconnection attempts",
          lastError: metrics.lastError
        }
      });
    }

    this.metrics.set(whatsapp.id, metrics);
    this.emitMetrics(whatsapp.id);
  }

  private emitMetrics(whatsappId: number): void {
    const metrics = this.metrics.get(whatsappId);
    if (!metrics) return;

    const io = getIO();
    io.emit(`${metrics.whatsappId}:sessionMetrics`, metrics);
  }
}

export default new BaileysSessionMonitor();