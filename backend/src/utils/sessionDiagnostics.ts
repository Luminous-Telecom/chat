import { logger } from "./logger";
import { getBaileysSession, getAllSessions } from "../libs/baileys";
import { BaileysClient } from "../types/baileys";

interface SessionDiagnostic {
  sessionId: number;
  connectionState: string;
  wsExists: boolean;
  wsState?: number;
  isReady: boolean;
  lastActivity?: number;
  errorCount: number;
}

class SessionDiagnostics {
  private static diagnosticData = new Map<number, SessionDiagnostic>();

  static async diagnoseSession(sessionId: number): Promise<SessionDiagnostic> {
    const session = getBaileysSession(sessionId);
    
    if (!session) {
      return {
        sessionId,
        connectionState: "NOT_FOUND",
        wsExists: false,
        isReady: false,
        errorCount: 0
      };
    }

    const diagnostic: SessionDiagnostic = {
      sessionId,
      connectionState: (session as any)?.connection || "UNKNOWN",
      wsExists: !!(session as any)?.ws,
      wsState: (session as any)?.ws?.readyState,
      isReady: this.isSessionHealthy(session),
      lastActivity: Date.now(),
      errorCount: this.diagnosticData.get(sessionId)?.errorCount || 0
    };

    this.diagnosticData.set(sessionId, diagnostic);
    return diagnostic;
  }

  static async diagnoseAllSessions(): Promise<SessionDiagnostic[]> {
    const sessions = getAllSessions();
    const diagnostics = await Promise.all(
      sessions.map(session => this.diagnoseSession((session as any).id))
    );

    logger.info(`[SessionDiagnostics] Diagnosed ${diagnostics.length} sessions`);
    
    const problematicSessions = diagnostics.filter(d => !d.isReady);
    if (problematicSessions.length > 0) {
      logger.warn(
        `[SessionDiagnostics] Found ${problematicSessions.length} problematic sessions: ${
          problematicSessions.map(s => s.sessionId).join(", ")
        }`
      );
    }

    return diagnostics;
  }

  static isSessionHealthy(session: BaileysClient): boolean {
    try {
      const connectionState = (session as any)?.connection;
      const wsExists = !!(session as any)?.ws;
      const wsState = (session as any)?.ws?.readyState;

      // Estados considerados saudáveis
      const isConnectionHealthy = connectionState === "open" || 
                                 (connectionState === "connecting" && wsExists);
      
      // WebSocket states: CONNECTING = 0, OPEN = 1, CLOSING = 2, CLOSED = 3
      const isWsHealthy = !wsExists || 
                         wsState === undefined || 
                         wsState === 0 || 
                         wsState === 1;

      return isConnectionHealthy && isWsHealthy;
    } catch (err) {
      logger.error(`[SessionDiagnostics] Error checking session health: ${err}`);
      return false;
    }
  }

  static incrementErrorCount(sessionId: number): void {
    const current = this.diagnosticData.get(sessionId);
    if (current) {
      current.errorCount++;
      this.diagnosticData.set(sessionId, current);
    }
  }

  static resetErrorCount(sessionId: number): void {
    const current = this.diagnosticData.get(sessionId);
    if (current) {
      current.errorCount = 0;
      this.diagnosticData.set(sessionId, current);
    }
  }

  static async generateHealthReport(): Promise<string> {
    const diagnostics = await this.diagnoseAllSessions();
    
    const healthySessions = diagnostics.filter(d => d.isReady);
    const problematicSessions = diagnostics.filter(d => !d.isReady);

    let report = `
=== RELATÓRIO DE SAÚDE DAS SESSÕES ===
Data: ${new Date().toISOString()}

Total de Sessões: ${diagnostics.length}
Sessões Saudáveis: ${healthySessions.length}
Sessões Problemáticas: ${problematicSessions.length}

`;

    if (problematicSessions.length > 0) {
      report += `SESSÕES PROBLEMÁTICAS:\n`;
      problematicSessions.forEach(session => {
        report += `- Sessão ${session.sessionId}: Estado=${session.connectionState}, WS=${session.wsExists ? 'Sim' : 'Não'}, Erros=${session.errorCount}\n`;
      });
    }

    if (healthySessions.length > 0) {
      report += `\nSESSÕES SAUDÁVEIS:\n`;
      healthySessions.forEach(session => {
        report += `- Sessão ${session.sessionId}: Estado=${session.connectionState}, WS=${session.wsExists ? 'Sim' : 'Não'}\n`;
      });
    }

    return report;
  }

  static startPeriodicHealthCheck(intervalMs: number = 300000): void { // 5 minutos
    setInterval(async () => {
      try {
        const report = await this.generateHealthReport();
        logger.info(`[SessionDiagnostics] Health Report:\n${report}`);
      } catch (err) {
        logger.error(`[SessionDiagnostics] Error generating health report: ${err}`);
      }
    }, intervalMs);

    logger.info(`[SessionDiagnostics] Started periodic health check every ${intervalMs/1000} seconds`);
  }
}

export default SessionDiagnostics; 