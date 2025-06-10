/* eslint-disable camelcase */
import {
  DisconnectReason,
  useMultiFileAuthState,
  makeWASocket,
  WASocket,
  proto,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  jidDecode,
  isJidGroup,
  getContentType,
  downloadMediaMessage,
  WAMessageKey,
  WAMessage
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { join } from "path";
import { rm } from "fs/promises";
import { getIO } from "./socket";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";
import { WhatsAppErrors } from "../utils/errorHandler";
import { isSessionClosedError } from "../helpers/HandleSessionError";
import QRCode from "qrcode";
import fs from "fs";
import { Op } from "sequelize";
import P from "pino";

// Função auxiliar para validar e atualizar o objeto whatsapp
export const safeUpdateWhatsapp = async (whatsapp: Whatsapp, updateData: any): Promise<boolean> => {
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

interface Session extends WASocket {
  id: number;
  tenantId: number;
  lastHeartbeat: number;
}

interface SessionState {
  isInitializing: boolean;
  isReady: boolean;
  lastHeartbeat?: number;
  lastError?: Error;
}

interface InitState {
  isInitializing: boolean;
  lastInitAttempt: number;
  initAttempts: number;
  initStartTime?: number;
  error?: Error;
}

interface WhatsappWithRetry extends Whatsapp {
  isRetry?: boolean;
}

// Enhanced QR Code cache interface
interface QrCodeCache {
  data: string;
  image: string;
  timestamp: number;
  state: string;
  lastEmit: number;
  expiresAt: number;
}

// Global session management
const sessions: Session[] = [];
const sessionStates = new Map<number, SessionState>();
const initStates = new Map<number, InitState>();
const initTimeouts = new Map<number, NodeJS.Timeout>();
const qrCodeCache = new Map<number, QrCodeCache>();

// Constants
const HEARTBEAT_INTERVAL = 30000; // Aumentar para 30 segundos
const QR_CODE_EXPIRY = 30000; // Manter em 30 segundos
const SESSION_HEALTH_CHECK_INTERVAL = 60000; // Aumentar para 1 minuto
const MAX_INIT_TIME = 120000; // Manter em 2 minutos
const RETRY_DELAY = 30000; // Manter em 30 segundos
const MAX_RETRY_ATTEMPTS = 5;
const SESSION_RESTORE_TIMEOUT = 60000; // Manter em 1 minuto
const SYNC_INTERVAL = 60000; // Aumentar para 1 minuto
const HEARTBEAT_TIMEOUT = 90000; // Aumentar para 1.5 minutos

// Optimized Chrome args - always include --no-sandbox for root
const stable_args = [
  "--no-sandbox", // Critical for root execution
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu",
  "--disable-web-security",
  "--disable-features=TranslateUI,VizDisplayCompositor",
  "--disable-extensions",
  "--disable-default-apps",
  "--mute-audio",
  "--no-default-browser-check",
  "--autoplay-policy=user-gesture-required",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-popup-blocking",
  "--disable-blink-features=AutomationControlled",
  "--memory-pressure-off",
  "--max_old_space_size=4096"
];

const args: string[] = process.env.CHROME_ARGS
  ? process.env.CHROME_ARGS.split(",")
  : stable_args;

args.unshift(`--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`);

// Enhanced session initialization check
const canInitSession = (whatsappId: number): boolean => {
  const state = initStates.get(whatsappId);
  const now = Date.now();
  
  if (!state) return true;
  
  // Check if already initializing and not stuck
  if (state.isInitializing) {
    // If initialization has been running for more than MAX_INIT_TIME, allow retry
    if (state.initStartTime && (now - state.initStartTime) > MAX_INIT_TIME) {
      logger.warn(`Session ${whatsappId} initialization stuck for ${now - state.initStartTime}ms, allowing retry`);
      return true;
    }
    return false;
  }
  
  // Rate limiting: wait between attempts
  if (now - state.lastInitAttempt < RETRY_DELAY) return false;
  
  // Progressive backoff: more attempts = longer wait
  const backoffTime = Math.min(120000, state.initAttempts * 15000); // Max 2 minutes, incremento de 15 segundos
  if (state.initAttempts >= MAX_RETRY_ATTEMPTS && now - state.lastInitAttempt < backoffTime) {
    return false;
  }
  
  // Reset counter after successful wait period
  if (now - state.lastInitAttempt > 300000) { // 5 minutos
    state.initAttempts = 0;
    initStates.set(whatsappId, state);
  }
  
  return true;
};

// Enhanced state update function
const updateInitState = (whatsappId: number, isInitializing: boolean, error?: Error): void => {
  const state = initStates.get(whatsappId) || {
    isInitializing: false,
    lastInitAttempt: 0,
    initAttempts: 0
  };
  
  const now = Date.now();
  
  if (isInitializing) {
    state.isInitializing = true;
    state.lastInitAttempt = now;
    state.initStartTime = now;
    state.initAttempts++;
  } else {
    state.isInitializing = false;
    state.initStartTime = undefined;
    if (error) {
      state.error = error;
      // Reset attempts for certain recoverable errors
      if (error.message.includes('sandbox') || error.message.includes('timeout')) {
        state.initAttempts = Math.max(0, state.initAttempts - 1);
      }
    } else {
      // Success - reset attempts
      state.initAttempts = 0;
      state.error = undefined;
    }
  }
  
  initStates.set(whatsappId, state);
};

// Enhanced session state management
const updateSessionState = (whatsappId: number, updates: Partial<SessionState>): void => {
  const currentState = sessionStates.get(whatsappId) || {
    isInitializing: false,
    isReady: false
  };
  
  const newState = { ...currentState, ...updates, lastHeartbeat: Date.now() };
  sessionStates.set(whatsappId, newState);
  
  logger.debug(`Session ${whatsappId} state updated: ${JSON.stringify(newState)}`);
};

// Enhanced session cleanup
export const removeWbot = async (whatsappId: number, reason = 'manual'): Promise<void> => {
  logger.info(`Removing session ${whatsappId} (reason: ${reason})`);
  
  try {
    // Clear all timeouts and intervals
    const timeoutId = initTimeouts.get(whatsappId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      initTimeouts.delete(whatsappId);
    }

    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      const session = sessions[sessionIndex];
      
      try {
        // Graceful shutdown with timeout
        await Promise.race([
          session.logout(),
          new Promise((resolve) => setTimeout(resolve, 5000))
        ]);
      } catch (err) {
        logger.warn(`Error destroying session ${whatsappId}: ${err}`);
      }
      
      sessions.splice(sessionIndex, 1);
      logger.info(`Session ${whatsappId} removed from memory`);
    }
    
    // Clear all caches
    qrCodeCache.delete(whatsappId);
    sessionStates.delete(whatsappId);
    initStates.delete(whatsappId);
    
  } catch (err: any) {
    if (!isSessionClosedError(err)) {
      logger.error(`removeWbot error for ${whatsappId}: ${err}`);
    }
  }
};

// Enhanced session health checking
const isSessionHealthy = async (wbot: Session): Promise<boolean> => {
  try {
    if (!wbot) {
      logger.debug(`Session unhealthy: no connection`);
      return false;
    }
    
    // Check connection state and heartbeat
    const state = wbot.user?.id ? 'CONNECTED' : 'DISCONNECTED';
    const sessionState = sessionStates.get(wbot.id);
    const lastHeartbeat = sessionState?.lastHeartbeat ?? 0;
    const hasRecentHeartbeat = (Date.now() - lastHeartbeat) < HEARTBEAT_TIMEOUT;
    
    const isHealthy = state === 'CONNECTED' && hasRecentHeartbeat;
    
    if (!isHealthy) {
      if (state !== 'CONNECTED') {
        logger.debug(`Session ${wbot.id} unhealthy: state ${state}`);
      } else if (!hasRecentHeartbeat) {
        logger.debug(`Session ${wbot.id} unhealthy: no recent heartbeat`);
      }
    }
    
    return isHealthy;
  } catch (error) {
    logger.error(`Error checking session health for ${wbot?.id}: ${error}`);
    return false;
  }
};

// Enhanced session initialization
export const initWbot = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise<Session>(async (resolve, reject) => {
    let initTimeout: NodeJS.Timeout | null = null;
    
    // Helper function to reload whatsapp object
    const reloadWhatsapp = async (): Promise<Whatsapp> => {
      const reloaded = await Whatsapp.findByPk(whatsapp.id);
      if (!reloaded) {
        throw WhatsAppErrors.sessionNotFound(`WhatsApp ${whatsapp.id} not found in database`);
      }
      return reloaded;
    };

    // Helper function to ensure whatsapp object exists and is a model instance
    const ensureWhatsapp = async (): Promise<Whatsapp> => {
      if (!(whatsapp instanceof Whatsapp)) {
        whatsapp = await reloadWhatsapp();
      }
      return whatsapp;
    };

    try {
      // Ensure we have a valid Whatsapp model instance
      whatsapp = await ensureWhatsapp();

      const io = getIO();
      
      // Verify initialization eligibility
      if (!canInitSession(whatsapp.id)) {
        const state = initStates.get(whatsapp.id);
        const waitTime = state?.lastInitAttempt ? 
          Math.ceil((RETRY_DELAY - (Date.now() - state.lastInitAttempt)) / 1000) : 0;
        throw WhatsAppErrors.initializationBlocked(`Session ${whatsapp.id} initialization blocked. Wait ${waitTime}s`);
      }
      
      // Update initialization state
      updateInitState(whatsapp.id, true);
      updateSessionState(whatsapp.id, { isInitializing: true, isReady: false });
      
      // Clean up existing session
      await removeWbot(whatsapp.id, 'reinit');
      
      logger.info(`Initializing WhatsApp session ${whatsapp.id} (${whatsapp.name})`);

      // Carregar estado da sessão usando a mesma pasta do baileys
      const { state, saveCreds } = await useMultiFileAuthState(
        join(__dirname, "..", "..", ".baileys_auth", `session-${whatsapp.id}`)
      );

      // Obter versão mais recente do Baileys
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      // Criar conexão
      const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as any)
        },
        logger: P({ level: 'silent' }) as any,
        getMessage: async (key) => {
          return proto.Message.fromObject({});
        },
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        emitOwnEvents: true,
        markOnlineOnConnect: true,
        retryRequestDelayMs: 5000,
        fireInitQueries: true,
        keepAliveIntervalMs: 15000,
        generateHighQualityLinkPreview: true
      }) as Session;

      // Configurar propriedades da sessão
      sock.id = whatsapp.id;
      sock.tenantId = whatsapp.tenantId;
      sock.lastHeartbeat = Date.now();

      // Configurar handlers de eventos
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          try {
            const qrCode = await QRCode.toDataURL(qr, {
              type: 'image/png',
              margin: 1,
              width: 200,
              errorCorrectionLevel: 'L', // Nível mais baixo de correção de erro
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            const now = Date.now();
            qrCodeCache.set(whatsapp.id, {
              data: qr,
              image: qrCode,
              timestamp: now,
              state: "qrcode",
              lastEmit: now,
              expiresAt: now + QR_CODE_EXPIRY
            });
            
            await safeUpdateWhatsapp(whatsapp, {
              qrcode: qrCode,
              status: "qrcode"
            });
            
            io.emit(`${whatsapp.tenantId}:whatsappSession`, {
              action: "update",
              session: {
                id: whatsapp.id,
                name: whatsapp.name,
                status: "qrcode",
                qrcode: qrCode,
                number: whatsapp.number
              }
            });
          } catch (err) {
            logger.error(`Error generating QR code: ${err}`);
            // Em caso de erro, retornar o QR code como texto puro
            const fallbackQrCode = `data:text/plain;base64,${Buffer.from(qr).toString('base64')}`;
            await safeUpdateWhatsapp(whatsapp, {
              qrcode: fallbackQrCode,
              status: "qrcode"
            });
          }
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          
          if (shouldReconnect) {
            logger.info(`Connection closed for ${whatsapp.id}, attempting reconnect...`);
            updateSessionState(whatsapp.id, { isReady: false });
            
            try {
              await safeUpdateWhatsapp(whatsapp, { status: "DISCONNECTED" });
            } catch (error) {
              logger.error(`Error updating disconnected status: ${error}`);
            }
            
            // Tentar reconexão
            setTimeout(() => {
              initWbot(whatsapp).catch(err => {
                logger.error(`Reconnection failed for ${whatsapp.id}: ${err}`);
              });
            }, 5000);
          } else {
            logger.info(`Connection closed for ${whatsapp.id}, logged out`);
            await removeWbot(whatsapp.id, 'logged_out');
          }
        }

        if (connection === 'open') {
          logger.info(`Session ${whatsapp.id} connected successfully`);
          updateInitState(whatsapp.id, false);
          updateSessionState(whatsapp.id, { isReady: true });
          
          try {
            await safeUpdateWhatsapp(whatsapp, {
              status: "CONNECTED",
              qrcode: ""
            });
            
            io.emit(`${whatsapp.tenantId}:whatsappSession`, {
              action: "update",
              session: {
                id: whatsapp.id,
                name: whatsapp.name,
                status: "CONNECTED",
                qrcode: "",
                number: whatsapp.number
              }
            });
            
            resolve(sock);
          } catch (error) {
            logger.error(`Error updating connected status: ${error}`);
          }
        }
      });

      // Salvar credenciais quando atualizadas
      sock.ev.on('creds.update', saveCreds);

      // Adicionar à lista de sessões
      sessions.push(sock);

    } catch (error) {
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      reject(error);
    }
  });
};

// Enhanced session retrieval with better error handling
export const getWbot = (whatsappId: number): Session => {
  const session = sessions.find(s => s.id === whatsappId);
  
  if (!session) {
    logger.warn(`Session ${whatsappId} not found. Available: [${sessions.map(s => s.id).join(', ')}]`);
    logger.warn(`Session states: ${JSON.stringify(Array.from(sessionStates.entries()).map(([id, state]) => ({ id, isReady: state.isReady, isInitializing: state.isInitializing })))}`);
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  
  // Check session state
  const sessionState = sessionStates.get(whatsappId);
  if (!sessionState?.isReady) {
    logger.warn(`Session ${whatsappId} not ready (state: ${JSON.stringify(sessionState)})`);
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  
  // Update heartbeat
  session.lastHeartbeat = Date.now();
  updateSessionState(whatsappId, { lastHeartbeat: Date.now() });
  
  return session;
};

// Session state query functions
export const isSessionReady = (whatsappId: number): boolean => {
  const sessionState = sessionStates.get(whatsappId);
  return sessionState?.isReady || false;
};

export const isSessionInitializing = (whatsappId: number): boolean => {
  const sessionState = sessionStates.get(whatsappId);
  return sessionState?.isInitializing || false;
};

export const getSessionLastError = (whatsappId: number): Error | undefined => {
  const sessionState = sessionStates.get(whatsappId);
  return sessionState?.lastError;
};

export const clearSessionState = (whatsappId: number): void => {
  sessionStates.delete(whatsappId);
  initStates.delete(whatsappId);
  qrCodeCache.delete(whatsappId);
};

// Enhanced session restoration
export const restoreSession = async (whatsapp: Whatsapp): Promise<Session | null> => {
  try {
    logger.info(`Attempting to restore session ${whatsapp.id} (${whatsapp.name})`);
    
    // Don't clear state immediately - wait for successful restore
    const existingState = sessionStates.get(whatsapp.id);
    const existingInitState = initStates.get(whatsapp.id);
    
    // Remove existing session if present
    const existingSessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
    if (existingSessionIndex !== -1) {
      try {
        const oldSession = sessions[existingSessionIndex];
        await oldSession.logout().catch(err => {
          logger.warn(`Error destroying old session: ${err}`);
        });
      } catch (err) {
        logger.warn(`Error handling old session: ${err}`);
      }
      sessions.splice(existingSessionIndex, 1);
      logger.info(`Removed existing session ${whatsapp.id} before restore`);
    }

    // Check for existing session data
    const sessionPath = join(__dirname, "..", "..", ".baileys_auth", `session-${whatsapp.id}`);
    const hasLocalSession = fs.existsSync(sessionPath);
    
    if (!hasLocalSession) {
      logger.info(`No existing session data for ${whatsapp.id}, cannot restore`);
      return null;
    }

    // Initialize new session with restore timeout
    const restorePromise = initWbot(whatsapp);
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), SESSION_RESTORE_TIMEOUT)
    );

    const restoredSession = await Promise.race([restorePromise, timeoutPromise]);
    
    if (!restoredSession) {
      logger.warn(`Session restore timeout for ${whatsapp.id}`);
      // Restore previous state
      if (existingState) sessionStates.set(whatsapp.id, existingState);
      if (existingInitState) initStates.set(whatsapp.id, existingInitState);
      return null;
    }

    logger.info(`Successfully restored session ${whatsapp.id}`);
    return restoredSession;
  } catch (error) {
    logger.error(`Error restoring session ${whatsapp.id}: ${error}`);
    return null;
  }
};

// Debug and monitoring functions
export const getSessionsDebugInfo = () => {
  return {
    activeSessions: sessions.length,
    sessionIds: sessions.map(s => s.id),
    sessionStates: Object.fromEntries(sessionStates),
    initStates: Object.fromEntries(initStates),
    qrCodeCache: qrCodeCache.size,
    timestamp: new Date().toISOString()
  };
};

export const syncSessionStatus = async (): Promise<void> => {
  logger.info('Starting session status sync...');
  
  try {
    // Get all whatsapp records from database
    const whatsapps = await Whatsapp.findAll({
      where: {
        type: 'whatsapp'
      }
    });
    
    for (const whatsapp of whatsapps) {
      const session = sessions.find(s => s.id === whatsapp.id);
      const isHealthy = session ? await isSessionHealthy(session) : false;
      
      const newStatus = isHealthy ? 'CONNECTED' : 'DISCONNECTED';
      
      if (whatsapp.status !== newStatus) {
        await safeUpdateWhatsapp(whatsapp, { status: newStatus });
        logger.info(`Updated session ${whatsapp.id} status to ${newStatus}`);
      }
    }
    
    logger.info('Session status sync completed');
  } catch (error) {
    logger.error(`Error during session sync: ${error}`);
    throw error;
  }
};

// Export other necessary functions and types
export type { Session, SessionState, InitState };
export { proto as WAProto };
export { downloadMediaMessage };
export { isJidGroup, jidDecode, getContentType };

// Global cleanup function
const cleanupExpiredCaches = (): void => {
  const now = Date.now();
  let cleaned = 0;
  
  // Clean QR code cache
  for (const [whatsappId, cached] of qrCodeCache.entries()) {
    if (cached.expiresAt < now) {
      qrCodeCache.delete(whatsappId);
      cleaned++;
    }
  }
  
  // Clean old init states
  for (const [whatsappId, state] of initStates.entries()) {
    if (!state.isInitializing && (now - state.lastInitAttempt) > 300000) { // 5 minutes
      initStates.delete(whatsappId);
      cleaned++;
    }
  }
  
  // Clean orphaned session states
  for (const [whatsappId, state] of sessionStates.entries()) {
    const hasSession = sessions.some(s => s.id === whatsappId);
    if (!hasSession && !state.isInitializing && (now - (state.lastHeartbeat || 0)) > 300000) {
      sessionStates.delete(whatsappId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`Cleaned ${cleaned} expired cache entries`);
  }
};

// Enhanced cache cleanup
export const cleanupInitCache = (): void => {
  cleanupExpiredCaches();
};

// Graceful shutdown handler
export const gracefulShutdown = async (): Promise<void> => {
  logger.info('Starting graceful shutdown of WhatsApp sessions...');
  
  try {
    // Clear all timeouts
    for (const [whatsappId, timeout] of initTimeouts.entries()) {
      clearTimeout(timeout);
      initTimeouts.delete(whatsappId);
    }
    
    // Destroy all sessions with timeout
    const destroyPromises = sessions.map(async (session) => {
      try {
        await Promise.race([
          session.logout(),
          new Promise((resolve) => setTimeout(resolve, 10000)) // 10 second timeout
        ]);
        logger.info(`Session ${session.id} destroyed successfully`);
      } catch (error) {
        logger.warn(`Error destroying session ${session.id}: ${error}`);
      }
    });
    
    // Use Promise.all with individual error handling instead of Promise.allSettled
    await Promise.all(destroyPromises.map(p => p.catch(err => {
      logger.warn(`Promise rejection during shutdown: ${err}`);
    })));
    
    // Clear all caches
    sessions.length = 0;
    sessionStates.clear();
    initStates.clear();
    qrCodeCache.clear();
    initTimeouts.clear();
    
    logger.info('Graceful shutdown completed');
  } catch (error) {
    logger.error(`Error during graceful shutdown: ${error}`);
  }
};

// Global cleanup intervals
setInterval(() => {
  cleanupExpiredCaches();
}, 60000); // Run every minute

// Initialize periodic tasks after Socket.IO is ready
export const initPeriodicTasks = () => {
  // Periodic session sync
  setInterval(() => {
    syncSessionStatus().catch(error => {
      logger.error(`Periodic sync error: ${error}`);
    });
  }, SYNC_INTERVAL);

  // Global heartbeat for WebSocket connections
  setInterval(() => {
    try {
      const io = getIO();
      const now = Date.now();
      
      // Check and clean expired QR codes
      for (const [whatsappId, cached] of qrCodeCache.entries()) {
        if (cached.expiresAt < now) {
          qrCodeCache.delete(whatsappId);
          continue;
        }
        
        // Send heartbeat for active QR codes
        const session = sessions.find(s => s.id === whatsappId);
        if (session && cached.state === "qrcode") {
          io.emit(`${session.tenantId}:whatsappSession`, {
            action: "heartbeat",
            session: {
              id: whatsappId,
              timestamp: now
            }
          });
        }
      }
      
      // Update session heartbeats
      for (const session of sessions) {
        if (session.lastHeartbeat && (now - session.lastHeartbeat) > HEARTBEAT_INTERVAL * 2) {
          logger.warn(`Session ${session.id} missed heartbeat, last seen ${new Date(session.lastHeartbeat).toISOString()}`);
        }
      }
    } catch (error) {
      // Socket.IO not initialized yet, skip this heartbeat
      logger.debug('Socket.IO not ready for heartbeat, skipping...');
    }
  }, HEARTBEAT_INTERVAL);
};

// Process event handlers for graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGQUIT', gracefulShutdown);

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Don't exit immediately, try to cleanup first
  gracefulShutdown().finally(() => {
    process.exit(1);
  });
});