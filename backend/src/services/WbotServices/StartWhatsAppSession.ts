import { getWbot, initWbot, removeWbot } from "../../libs/wbot";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { wbotMessageListener } from "../WbotServices/wbotMessageListener";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import AppError from "../../errors/AppError";
import { StartInstaBotSession } from "../InstagramBotServices/StartInstaBotSession";
import { StartTbotSession } from "../TbotServices/StartTbotSession";
import { StartWaba360 } from "../WABA360/StartWaba360";
import { StartMessengerBot } from "../MessengerChannelServices/StartMessengerBot";

// Map para controlar tentativas de reconexão
const reconnectionAttempts = new Map<number, number>();
const MAX_RECONNECTION_ATTEMPTS = 3;
const RECONNECTION_DELAY = 30000; // 30 segundos

// Função auxiliar para validar e atualizar o objeto whatsapp
const safeUpdateWhatsapp = async (whatsapp: Whatsapp, updateData: any): Promise<boolean> => {
  try {
    // Validações básicas
    if (!whatsapp) {
      logger.error(`safeUpdateWhatsapp: whatsapp é null ou undefined`);
      return false;
    }
    
    if (!whatsapp.id) {
      logger.error(`safeUpdateWhatsapp: whatsapp.id é inválido`);
      return false;
    }
    
    if (typeof whatsapp.update !== "function") {
      logger.error(`safeUpdateWhatsapp: whatsapp.update não é uma função para ID ${whatsapp.id}`);
      
      // Tentar recarregar o objeto do banco de dados
      try {
        const freshWhatsapp = await Whatsapp.findByPk(whatsapp.id);
        if (freshWhatsapp && typeof freshWhatsapp.update === "function") {
          await freshWhatsapp.update(updateData);
          logger.info(`safeUpdateWhatsapp: Objeto whatsapp recarregado e atualizado com sucesso para ID ${whatsapp.id}`);
          return true;
        } else {
          logger.error(`safeUpdateWhatsapp: Falha ao recarregar objeto whatsapp para ID ${whatsapp.id}`);
          return false;
        }
      } catch (reloadError) {
        logger.error(`safeUpdateWhatsapp: Erro ao recarregar whatsapp ${whatsapp.id}: ${reloadError}`);
        return false;
      }
    }
    
    // Se chegou até aqui, o objeto é válido
    await whatsapp.update(updateData);
    return true;
  } catch (error) {
    logger.error(`safeUpdateWhatsapp: Erro ao atualizar whatsapp ${whatsapp?.id || 'unknown'}: ${error}`);
    return false;
  }
};

// Função para retry automático
const scheduleReconnection = async (whatsapp: Whatsapp, delay: number = RECONNECTION_DELAY): Promise<void> => {
  const attempts = reconnectionAttempts.get(whatsapp.id) || 0;
  
  if (attempts >= MAX_RECONNECTION_ATTEMPTS) {
    logger.warn(`Max reconnection attempts reached for WhatsApp ${whatsapp.id} (${whatsapp.name})`);
    reconnectionAttempts.delete(whatsapp.id);
    return;
  }
  
  reconnectionAttempts.set(whatsapp.id, attempts + 1);
  
  logger.info(`Scheduling reconnection attempt ${attempts + 1}/${MAX_RECONNECTION_ATTEMPTS} for WhatsApp ${whatsapp.id} in ${delay/1000}s`);
  
  setTimeout(async () => {
    try {
      await StartWhatsAppSession(whatsapp, true);
    } catch (error: any) {
      logger.error(`Reconnection attempt ${attempts + 1} failed for WhatsApp ${whatsapp.id}: ${error.message}`);
      // Tentar novamente com delay progressivo
      await scheduleReconnection(whatsapp, delay * 1.5);
    }
  }, delay);
};
const lastErrorTime = new Map<number, number>();

// Função para verificar se o erro é recuperável
const isRecoverableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  
  // Erros que podem ser temporários e recuperáveis
  const recoverablePatterns = [
    'timeout',
    'evaluation failed',
    'minified invariant',
    'net::',
    'protocol error',
    'target closed',
    'connection',
    'socket',
    'fetch',
    'network',
    'puppeteer',
    'navigation',
    'waiting for',
    'session closed',
    'page crashed',
    'context destroyed',
    'err_wapp_not_initialized',
    'not initialized'
  ];
  
  return recoverablePatterns.some(pattern => message.includes(pattern));
};

// Função para verificar se deve tentar reconectar
const shouldRetry = (whatsappId: number, error: Error): boolean => {
  const maxRetries = 3;
  const retryWindow = 5 * 60 * 1000; // 5 minutos
  const now = Date.now();
  
  // Verificar se o erro é recuperável
  if (!isRecoverableError(error)) {
    logger.info(`Non-recoverable error for WhatsApp ${whatsappId}: ${error.message}`);
    return false;
  }
  
  // Resetar contador se passou muito tempo desde o último erro
  const lastError = lastErrorTime.get(whatsappId) || 0;
  if (now - lastError > retryWindow) {
    reconnectionAttempts.set(whatsappId, 0);
  }
  
  // Atualizar tempo do último erro
  lastErrorTime.set(whatsappId, now);
  
  // Verificar número de tentativas
  const attempts = reconnectionAttempts.get(whatsappId) || 0;
  if (attempts >= maxRetries) {
    logger.warn(`Max retry attempts (${maxRetries}) reached for WhatsApp ${whatsappId}`);
    return false;
  }
  
  // Incrementar contador de tentativas
  reconnectionAttempts.set(whatsappId, attempts + 1);
  
  // Log específico para ERR_WAPP_NOT_INITIALIZED
  if (error.message.toLowerCase().includes('err_wapp_not_initialized')) {
    logger.info(`Recoverable error ERR_WAPP_NOT_INITIALIZED for WhatsApp ${whatsappId}, will retry (attempt ${attempts + 1}/${maxRetries})`);
  }
  
  return true;
};

// Função para delay com backoff exponencial
const getRetryDelay = (attempt: number): number => {
  const baseDelay = 2000; // 2 segundos
  const maxDelay = 30000; // 30 segundos
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  
  // Para ERR_WAPP_NOT_INITIALIZED, usar um delay menor
  if (attempt === 0) {
    return 1000; // 1 segundo para primeira tentativa
  }
  
  return delay;
};

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  isRetry: boolean = false
): Promise<void> => {
  const io = getIO();

  try {
    // Verificar se a sessão já está em um estado válido
    await whatsapp.reload();
    
    // Se não for retry, verificar se a sessão já está ativa na memória
    if (!isRetry) {
      const existingSession = getWbot(whatsapp.id);
      const isSessionHealthy = existingSession && 
                             existingSession.info && 
                             !existingSession.pupPage?.isClosed() &&
                             existingSession.pupPage?.target()?.type() === 'page';
      
      if (isSessionHealthy && (whatsapp.status === "CONNECTED" || whatsapp.status === "READY")) {
        logger.info(`WhatsApp ${whatsapp.name} already in valid state: ${whatsapp.status}`);
        return;
      }
      
      // Se a sessão não está saudável na memória, remover e reconectar
      if (existingSession) {
        logger.warn(`WhatsApp ${whatsapp.name} found in memory but not healthy, removing and reconnecting`);
        removeWbot(whatsapp.id);
      }
    }
    
    // Log detalhado do estado atual
    logger.info(`[StartWhatsAppSession] Iniciando sessão ${whatsapp.name} (ID: ${whatsapp.id}) - Status atual: ${whatsapp.status}, isRetry: ${isRetry}`);

    // Atualizar estado inicial apenas se necessário
    if (whatsapp.status !== "OPENING") {
      await safeUpdateWhatsapp(whatsapp, { 
        status: "OPENING",
        qrcode: "",
        qrData: "",
        retries: (whatsapp.retries || 0) + (isRetry ? 1 : 0)
      });

      // Emitir atualização inicial
      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
        action: "update",
        session: whatsapp
      });
    }

    if (whatsapp.type === "whatsapp") {
      logger.info(`${isRetry ? 'Retrying' : 'Starting'} WhatsApp session for ${whatsapp.name} (ID: ${whatsapp.id})`);
      
      try {
        const wbot = await initWbot(whatsapp);
        wbotMessageListener(wbot);
        wbotMonitor(wbot, whatsapp);
        
        // Resetar contador de tentativas em caso de sucesso
        reconnectionAttempts.delete(whatsapp.id);
        lastErrorTime.delete(whatsapp.id);
        
        logger.info(`WhatsApp session started successfully for ${whatsapp.name}`);
      } catch (error: any) {
        logger.error(`Error starting WhatsApp session ${whatsapp.id}: ${error.message}`);
        
        // Atualizar status para erro
        await safeUpdateWhatsapp(whatsapp, { 
          status: "DISCONNECTED",
          qrcode: ""
        });
        
        // Agendar tentativa de reconexão automática se não for um retry
        if (!isRetry) {
          await scheduleReconnection(whatsapp);
        }
        
        throw new AppError(`Erro ao inicializar WhatsApp: ${error.message}`);
      }
    }

    if (whatsapp.type === "telegram") {
      logger.info(`Starting Telegram session for ${whatsapp.name}`);
      StartTbotSession(whatsapp);
    }

    if (whatsapp.type === "instagram") {
      logger.info(`Starting Instagram session for ${whatsapp.name}`);
      StartInstaBotSession(whatsapp);
    }

    if (whatsapp.type === "messenger") {
      logger.info(`Starting Messenger session for ${whatsapp.name}`);
      StartMessengerBot(whatsapp);
    }

    if (whatsapp.type === "waba") {
      if (whatsapp.wabaBSP === "360") {
        logger.info(`Starting WABA 360 session for ${whatsapp.name}`);
        StartWaba360(whatsapp);
      }
    }
  } catch (err: any) {
    logger.error(`StartWhatsAppSession | Error for ${whatsapp.name}: ${err.message}`);
    
    // Recarregar status atual do WhatsApp
    try {
      await whatsapp.reload();
    } catch (reloadErr) {
      logger.warn(`Could not reload WhatsApp ${whatsapp.name} status: ${reloadErr}`);
    }
    
    // Verificar se a sessão está em estado válido apesar do erro
    const validStates = ["CONNECTED", "READY", "AUTHENTICATED"];
    if (validStates.includes(whatsapp.status)) {
      logger.info(`WhatsApp ${whatsapp.name} is in valid state (${whatsapp.status}) despite error - keeping session active`);
      return;
    }
    
    // Verificar se é estado de QR code válido
    if (whatsapp.status === "qrcode" && whatsapp.qrcode) {
      logger.info(`WhatsApp ${whatsapp.name} in QR code state - keeping session active for user authentication`);
      return;
    }
    
    // Verificar se deve tentar reconectar
    if (shouldRetry(whatsapp.id, err)) {
      const attempts = reconnectionAttempts.get(whatsapp.id) || 1;
      const delay = getRetryDelay(attempts - 1);
      
      logger.info(`Scheduling retry ${attempts} for WhatsApp ${whatsapp.name} in ${delay}ms`);
      
      // Atualizar status para indicar tentativa de reconexão
      try {
        await safeUpdateWhatsapp(whatsapp, {
          status: "OPENING",
          retries: attempts
        });

        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsapp
        });
      } catch (updateErr) {
        logger.error(`Error updating WhatsApp ${whatsapp.name} retry status: ${updateErr}`);
      }
      
      // Agendar retry
      setTimeout(async () => {
        try {
          await StartWhatsAppSession(whatsapp, true);
        } catch (retryErr) {
          logger.error(`Retry failed for WhatsApp ${whatsapp.name}: ${retryErr}`);
        }
      }, delay);
      
      return; // Não fazer throw, deixar o retry handle
    }
    
    // Se não deve retryar ou esgotou tentativas, desconectar
    logger.warn(`WhatsApp ${whatsapp.name} - no more retries available or non-recoverable error`);
    
    try {
      const attempts = reconnectionAttempts.get(whatsapp.id) || 0;
      
      await safeUpdateWhatsapp(whatsapp, {
        status: "DISCONNECTED",
        qrcode: "",
        qrData: "",
        retries: attempts
      });

      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
        action: "update",
        session: whatsapp
      });
      
      // Limpar cache de tentativas
      reconnectionAttempts.delete(whatsapp.id);
      lastErrorTime.delete(whatsapp.id);
      
    } catch (updateErr) {
      logger.error(`Error updating WhatsApp ${whatsapp.name} disconnected status: ${updateErr}`);
    }

    throw new AppError("ERR_START_SESSION", 404);
  }
};

// Função para limpar cache antigo (pode ser chamada periodicamente)
export const cleanupReconnectionCache = (): void => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutos
  
  for (const [whatsappId, timestamp] of lastErrorTime.entries()) {
    if (now - timestamp > maxAge) {
      reconnectionAttempts.delete(whatsappId);
      lastErrorTime.delete(whatsappId);
      logger.debug(`Cleaned up old reconnection cache for WhatsApp ${whatsappId}`);
    }
  }
};

// Função para limpar tentativas de reconexão (útil para reset manual)
export const clearReconnectionAttempts = (whatsappId: number): void => {
  reconnectionAttempts.delete(whatsappId);
};

// Função para obter número de tentativas
export const getReconnectionAttempts = (whatsappId: number): number => {
  return reconnectionAttempts.get(whatsappId) || 0;
};