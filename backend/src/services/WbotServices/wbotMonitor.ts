// ===== SISTEMA DE MONITOR ÚNICO =====
// Este arquivo deve SUBSTITUIR todos os outros monitores
// Comente/remova qualquer outro código de monitoramento

import { Op } from 'sequelize';
import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
import { getBaileysSession, removeBaileysSession } from "../../libs/baileys";

// Estado das sessões
const sessionMonitor = new Map<number, {
  reconnectAttempts: number;
  lastCheck: number;
  isHealthy: boolean;
  errorCount: number;
  lastError: number;
  isProcessing: boolean;
}>();

// Configurações conservadoras
const MONITOR_CONFIG = {
  CHECK_INTERVAL: 120000, // 2 minutos - bem espaçado
  MAX_RECONNECT_ATTEMPTS: 2,
  MIN_RECONNECT_DELAY: 60000, // 1 minuto entre tentativas
  ERROR_THRESHOLD: 2,
  ERROR_RESET_TIME: 300000, // 5 minutos
  STABLE_TIME: 30000 // 30 segundos para considerar estável
};

// Inicializa estado
const initMonitorState = (whatsappId: number): void => {
  if (!sessionMonitor.has(whatsappId)) {
    sessionMonitor.set(whatsappId, {
      reconnectAttempts: 0,
      lastCheck: 0,
      isHealthy: false,
      errorCount: 0,
      lastError: 0,
      isProcessing: false
    });
  }
};

// Registra erro
const registerError = (whatsappId: number): void => {
  initMonitorState(whatsappId);
  const state = sessionMonitor.get(whatsappId)!;
  const now = Date.now();
  
  // Reset se passou tempo
  if ((now - state.lastError) > MONITOR_CONFIG.ERROR_RESET_TIME) {
    state.errorCount = 0;
  }
  
  state.errorCount++;
  state.lastError = now;
  state.isHealthy = false;
  
  logger.warn(`SINGLE_MONITOR: Session ${whatsappId} error count: ${state.errorCount}`);
};

// Marca como saudável
const markHealthy = (whatsappId: number): void => {
  initMonitorState(whatsappId);
  const state = sessionMonitor.get(whatsappId)!;
  
  if (!state.isHealthy) {
    state.isHealthy = true;
    state.errorCount = 0;
    state.reconnectAttempts = 0;
    logger.info(`SINGLE_MONITOR: Session ${whatsappId} marked healthy`);
  }
};

// Pode processar agora?
const canProcess = (whatsappId: number): boolean => {
  initMonitorState(whatsappId);
  const state = sessionMonitor.get(whatsappId)!;
  const now = Date.now();
  
  // Não processa se já está processando
  if (state.isProcessing) {
    return false;
  }
  
  // Não processa se verificou recentemente
  if ((now - state.lastCheck) < MONITOR_CONFIG.CHECK_INTERVAL) {
    return false;
  }
  
  // Não processa se atingiu limite de tentativas
  if (state.reconnectAttempts >= MONITOR_CONFIG.MAX_RECONNECT_ATTEMPTS) {
    return false;
  }
  
  state.lastCheck = now;
  return true;
};

// Verifica saúde básica
const isSessionHealthy = async (wbot: any, whatsapp: Whatsapp): Promise<boolean> => {
  try {
    if (!wbot) return false;
    
    const connectionState = (wbot as any)?.connection;
    const wsState = (wbot.ws as any)?.readyState;
    
    // ===== IMPORTANTE: NÃO considera ws undefined como erro crítico =====
    // Esta era a causa dos loops no sistema antigo
    
    // Verifica apenas se está conectado
    if (connectionState !== 'open') {
      return false;
    }
    
    // Teste rápido de funcionalidade (opcional)
    if (wbot.presenceSubscribe && whatsapp?.number) {
      try {
        await Promise.race([
          wbot.presenceSubscribe(whatsapp.number),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
      } catch (testErr) {
        // Falha no teste não é crítica
        logger.debug(`SINGLE_MONITOR: Test failed for ${whatsapp.name}, but connection is open`);
      }
    }
    
    return true;
  } catch (err) {
    return false;
  }
};

// Tentativa de reconexão
const attemptReconnect = async (whatsapp: Whatsapp): Promise<void> => {
  const state = sessionMonitor.get(whatsapp.id);
  if (!state || state.isProcessing) return;
  
  try {
    state.isProcessing = true;
    state.reconnectAttempts++;
    
    logger.info(`SINGLE_MONITOR: Reconnecting ${whatsapp.name} (attempt ${state.reconnectAttempts}/${MONITOR_CONFIG.MAX_RECONNECT_ATTEMPTS})`);
    
    // Limpeza básica
    await removeBaileysSession(whatsapp.id);
    
    // Aguarda um pouco
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Atualiza status
    await whatsapp.update({ 
      status: "OPENING",
      qrcode: ""
    });
    
    // Notifica frontend
    const io = getIO();
    io.emit(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    
    // Inicia nova sessão
    await StartWhatsAppSession(whatsapp, whatsapp.tenantId);
    
    logger.info(`SINGLE_MONITOR: Reconnection initiated for ${whatsapp.name}`);
    
  } catch (err) {
    logger.error(`SINGLE_MONITOR: Reconnection failed for ${whatsapp.name}: ${err}`);
    registerError(whatsapp.id);
  } finally {
    // Libera após delay
    setTimeout(() => {
      if (state) state.isProcessing = false;
    }, MONITOR_CONFIG.MIN_RECONNECT_DELAY);
  }
};

// Monitor principal
const runMonitor = async (): Promise<void> => {
  try {
    const whatsapps = await Whatsapp.findAll({
      where: { 
        status: { [Op.ne]: "DISCONNECTED" },
        isActive: true
      }
    });

    for (const whatsapp of whatsapps) {
      try {
        // Pula se não pode processar
        if (!canProcess(whatsapp.id)) {
          continue;
        }
        
        const wbot = getBaileysSession(whatsapp.id);
        
        // Sem sessão
        if (!wbot) {
          logger.info(`SINGLE_MONITOR: No session for ${whatsapp.name}`);
          registerError(whatsapp.id);
          
          const state = sessionMonitor.get(whatsapp.id);
          if (state && state.errorCount >= MONITOR_CONFIG.ERROR_THRESHOLD) {
            await attemptReconnect(whatsapp);
          }
          continue;
        }
        
        // QR code - reseta estado
        if (whatsapp.status === "qrcode") {
          const state = sessionMonitor.get(whatsapp.id);
          if (state) {
            state.reconnectAttempts = 0;
            state.errorCount = 0;
          }
          continue;
        }
        
        // Verifica saúde
        const isHealthy = await isSessionHealthy(wbot, whatsapp);
        
        if (isHealthy) {
          markHealthy(whatsapp.id);
        } else {
          logger.warn(`SINGLE_MONITOR: Session ${whatsapp.name} appears unhealthy`);
          registerError(whatsapp.id);
          
          const state = sessionMonitor.get(whatsapp.id);
          if (state && state.errorCount >= MONITOR_CONFIG.ERROR_THRESHOLD) {
            await attemptReconnect(whatsapp);
          }
        }
        
      } catch (err: any) {
        logger.error(`SINGLE_MONITOR: Error checking ${whatsapp.name}: ${err?.message}`);
        registerError(whatsapp.id);
      }
    }
    
  } catch (err: any) {
    logger.error(`SINGLE_MONITOR: General error: ${err?.message}`);
  }
};

// Inicia o monitor
const startSingleMonitor = (): void => {
  // Aguarda inicialização
  setTimeout(() => {
    runMonitor();
    setInterval(runMonitor, MONITOR_CONFIG.CHECK_INTERVAL);
  }, 15000); // 15 segundos de delay inicial
};

export default startSingleMonitor;