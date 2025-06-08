/* eslint-disable camelcase */
import { Client, LocalAuth, DefaultOptions, WAState } from "whatsapp-web.js";
import path from "path";
import { rm } from "fs/promises";
import { getIO } from "./socket";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import { isSessionClosedError } from "../helpers/HandleSessionError";
// import SyncUnreadMessagesWbot from "../services/WbotServices/SyncUnreadMessagesWbot";
import AppError from "../errors/AppError";
import QRCode from "qrcode";
import fs from "fs";
import { Op } from "sequelize";

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

interface Session extends Client {
  id: number;
  tenantId?: number;
  lastHeartbeat?: number;
}

// Enhanced session state interface
interface SessionState {
  isInitializing: boolean;
  isReady: boolean;
  lastError?: Error;
  lastErrorTime?: number;
  state?: WAState | null;
  data?: any;
  lastHeartbeat?: number;
  initStartTime?: number;
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

// Enhanced initialization state
interface InitState {
  isInitializing: boolean;
  lastInitAttempt: number;
  initAttempts: number;
  error?: Error;
  initStartTime?: number;
}

// Global session management
const sessions: Session[] = [];
const sessionStates = new Map<number, SessionState>();
const sessionHealthCheck = new Map<number, NodeJS.Timeout>();
const qrCodeCache = new Map<number, QrCodeCache>();
const initTimeouts = new Map<number, NodeJS.Timeout>();
const initStates = new Map<number, InitState>();

// Constants
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const QR_CODE_EXPIRY = 60000; // 1 minute
const SESSION_HEALTH_CHECK_INTERVAL = 60000; // 1 minute (alinhado com SYNC_INTERVAL)
const MAX_INIT_TIME = 120000; // 2 minutes max initialization time
const RETRY_DELAY = 5000; // 5 seconds between retries
const MAX_RETRY_ATTEMPTS = 3;
const SYNC_INTERVAL = 60000; // 1 minute sync interval
const SESSION_RESTORE_TIMEOUT = 30000; // 30 seconds timeout for session restore

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

args.unshift(`--user-agent=${DefaultOptions.userAgent}`);

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
  const backoffTime = Math.min(60000, state.initAttempts * 10000); // Max 1 minute
  if (state.initAttempts >= MAX_RETRY_ATTEMPTS && now - state.lastInitAttempt < backoffTime) {
    return false;
  }
  
  // Reset counter after successful wait period
  if (now - state.lastInitAttempt > 120000) { // 2 minutes
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

// Enhanced QR code generation with better caching
const generateQrCodeImage = async (qrData: string, whatsappId: number): Promise<string> => {
  try {
    const now = Date.now();
    const cached = qrCodeCache.get(whatsappId);
    
    // Check cache validity
    if (cached && cached.data === qrData && cached.expiresAt > now) {
      return cached.image;
    }

    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      type: 'image/png',
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Store with expiration
    qrCodeCache.set(whatsappId, {
      data: qrData,
      image: qrCodeDataURL,
      timestamp: now,
      state: 'qrcode',
      lastEmit: now,
      expiresAt: now + QR_CODE_EXPIRY
    });

    return qrCodeDataURL;
  } catch (error: any) {
    logger.error(`Error generating QR Code image for ${whatsappId}: ${error}`);
    return qrData;
  }
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
    
    stopSessionHealthCheck(whatsappId);

    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      const session = sessions[sessionIndex];
      
      try {
        // Graceful shutdown with timeout
        await Promise.race([
          session.destroy(),
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
    if (!wbot || !wbot.pupPage) {
      logger.debug(`Session ${wbot?.id} unhealthy: no page`);
      return false;
    }
    
    // Check if page is closed
    if (wbot.pupPage.isClosed()) {
      logger.debug(`Session ${wbot.id} unhealthy: page closed`);
      return false;
    }
    
    // Check page target
    const target = wbot.pupPage.target();
    if (!target || target.type() !== 'page') {
      logger.debug(`Session ${wbot.id} unhealthy: invalid target`);
      return false;
    }
    
    // Test WhatsApp state with timeout
    try {
      const statePromise = wbot.getState();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('State check timeout')), 10000)
      );
      
      const state = await Promise.race([statePromise, timeoutPromise]);
      const isHealthy = state !== null && state !== 'UNPAIRED';
      
      if (!isHealthy) {
        logger.debug(`Session ${wbot.id} unhealthy: state ${state}`);
      }
      
      return isHealthy;
    } catch (error) {
      logger.debug(`Session ${wbot.id} unhealthy: state check failed - ${error}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error checking session health for ${wbot?.id}: ${error}`);
    return false;
  }
};

// Start session health monitoring
const startSessionHealthCheck = (whatsappId: number): void => {
  // Clear existing health check
  stopSessionHealthCheck(whatsappId);
  
  const healthCheck = setInterval(async () => {
    try {
      const session = sessions.find(s => s.id === whatsappId);
      if (!session) {
        stopSessionHealthCheck(whatsappId);
        return;
      }
      
      const isHealthy = await isSessionHealthy(session);
      updateSessionState(whatsappId, { isReady: isHealthy });
      
      if (!isHealthy) {
        logger.warn(`Session ${whatsappId} failed health check, removing`);
        await removeWbot(whatsappId, 'health-check-failure');
        
        // Attempt auto-recovery
        try {
          const whatsapp = await Whatsapp.findByPk(whatsappId);
          if (whatsapp && whatsapp.status !== 'DISCONNECTED') {
            logger.info(`Attempting auto-recovery for session ${whatsappId}`);
            await StartWhatsAppSession({ ...whatsapp, isRetry: true } as WhatsappWithRetry);
          }
        } catch (recoveryError) {
          logger.error(`Auto-recovery failed for session ${whatsappId}: ${recoveryError}`);
        }
      }
    } catch (error) {
      logger.error(`Health check error for session ${whatsappId}: ${error}`);
    }
  }, SESSION_HEALTH_CHECK_INTERVAL);
  
  sessionHealthCheck.set(whatsappId, healthCheck);
};

// Stop session health monitoring
const stopSessionHealthCheck = (whatsappId: number): void => {
  const healthCheck = sessionHealthCheck.get(whatsappId);
  if (healthCheck) {
    clearInterval(healthCheck);
    sessionHealthCheck.delete(whatsappId);
    logger.debug(`Health check stopped for session ${whatsappId}`);
  }
};

// Enhanced session initialization
export const initWbot = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise<Session>(async (resolve, reject) => {
    let initTimeout: NodeJS.Timeout | null = null;
    let currentWhatsapp: Whatsapp | null = whatsapp; // Keep reference to current whatsapp object
    
    // Helper function to reload whatsapp object
    const reloadWhatsapp = async (): Promise<Whatsapp> => {
      const reloaded = await Whatsapp.findByPk(whatsapp.id);
      if (!reloaded) {
        throw new Error(`WhatsApp ${whatsapp.id} not found in database`);
      }
      return reloaded;
    };

    // Helper function to ensure whatsapp object exists
    const ensureWhatsapp = async (): Promise<Whatsapp> => {
      if (!currentWhatsapp) {
        currentWhatsapp = await reloadWhatsapp();
      }
      return currentWhatsapp;
    };
    
    try {
      const io = getIO();
      
      // Verify initialization eligibility
      if (!canInitSession(whatsapp.id)) {
        const state = initStates.get(whatsapp.id);
        const waitTime = state?.lastInitAttempt ? 
          Math.ceil((RETRY_DELAY - (Date.now() - state.lastInitAttempt)) / 1000) : 0;
        throw new Error(`Session ${whatsapp.id} initialization blocked. Wait ${waitTime}s`);
      }
      
      // Update initialization state
      updateInitState(whatsapp.id, true);
      updateSessionState(whatsapp.id, { isInitializing: true, isReady: false });
      
      // Clean up existing session
      await removeWbot(whatsapp.id, 'reinit');
      
      logger.info(`Initializing WhatsApp session ${whatsapp.id} (${whatsapp.name})`);
      
      // Create new client with enhanced configuration
      const wbot = new Client({
        puppeteer: {
          args: stable_args,
          headless: true,
          executablePath: process.env.CHROME_BIN || undefined,
          ignoreDefaultArgs: ['--disable-extensions'],
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false
        },
        authStrategy: new LocalAuth({ 
          clientId: `wbot-${whatsapp.id}`,
          dataPath: path.resolve(__dirname, "..", "..", ".wwebjs_auth")
        }),
        qrMaxRetries: 3,
        authTimeoutMs: 90000, // Increased timeout
        takeoverOnConflict: true,
        takeoverTimeoutMs: 10000, // Increased takeover timeout
        restartOnAuthFail: true
      }) as Session;

      // Set session properties
      wbot.id = whatsapp.id;
      wbot.tenantId = whatsapp.tenantId;
      wbot.lastHeartbeat = Date.now();

      // Set initialization timeout
      initTimeout = setTimeout(() => {
        updateInitState(whatsapp.id, false, new Error('Initialization timeout'));
        updateSessionState(whatsapp.id, { isInitializing: false });
        reject(new Error(`Session ${whatsapp.id} initialization timeout`));
      }, MAX_INIT_TIME);

      // Enhanced event handlers
      wbot.on("qr", async (qr) => {
        try {
          // Ensure we have a valid whatsapp object
          const whatsappObj = await ensureWhatsapp();
          logger.info(`QR code generated for session ${whatsappObj.id}`);
          const qrCode = await generateQrCodeImage(qr, whatsappObj.id);
          await emitQrCodeUpdate(whatsappObj, qrCode, "qrcode");
          updateSessionState(whatsappObj.id, { isInitializing: true, isReady: false });
        } catch (error) {
          logger.error(`QR code handling error for ${whatsapp.id}: ${error}`);
        }
      });

      wbot.on("authenticated", async () => {
        try {
          // Ensure we have a valid whatsapp object
          const whatsappObj = await ensureWhatsapp();
          logger.info(`Session ${whatsappObj.id} authenticated`);
          
          await safeUpdateWhatsapp(whatsappObj, { 
            status: "AUTHENTICATED",
            qrcode: "",
            retries: 0
          });
          
          updateSessionState(whatsappObj.id, { isInitializing: true, isReady: false });
          
          io.emit(`${whatsappObj.tenantId}:whatsappSession`, {
            action: "update",
            session: {
              id: whatsappObj.id,
              name: whatsappObj.name,
              status: "AUTHENTICATED",
              qrcode: "",
              number: whatsappObj.number
            }
          });
        } catch (error) {
          logger.error(`Authentication event error for ${whatsapp.id}: ${error}`);
        }
      });

      wbot.on("ready", async () => {
        try {
          if (initTimeout) {
            clearTimeout(initTimeout);
            initTimeout = null;
          }
          
          // Ensure we have a valid whatsapp object
          const whatsappObj = await ensureWhatsapp();
          
          updateInitState(whatsappObj.id, false); // Success
          updateSessionState(whatsappObj.id, { isInitializing: false, isReady: true });
          
          // Add to sessions array
          sessions.push(wbot);
          logger.info(`Session ${whatsappObj.id} added to sessions array. Total sessions: ${sessions.length}`);
          
          // Start health monitoring
          startSessionHealthCheck(whatsappObj.id);
          
          // Update database
          await safeUpdateWhatsapp(whatsappObj, {
            status: "CONNECTED",
            qrcode: "",
            retries: 0,
            number: wbot?.info?.wid?.user || whatsappObj.number
          });

          // Emit success event
          io.emit(`${whatsappObj.tenantId}:whatsappSession`, {
            action: "update",
            session: {
              id: whatsappObj.id,
              name: whatsappObj.name,
              status: "CONNECTED",
              qrcode: "",
              number: wbot?.info?.wid?.user || whatsappObj.number
            }
          });

          logger.info(`Session ${whatsappObj.id} ready and connected successfully`);
          resolve(wbot);
        } catch (error) {
          logger.error(`Ready event error for ${whatsapp.id}: ${error}`);
          reject(error);
        }
      });

      wbot.on("auth_failure", async (error: Error) => {
        try {
          if (initTimeout) {
            clearTimeout(initTimeout);
            initTimeout = null;
          }
          
          // Ensure we have a valid whatsapp object
          const whatsappObj = await ensureWhatsapp();
          
          updateInitState(whatsappObj.id, false, error);
          updateSessionState(whatsappObj.id, { isInitializing: false, isReady: false, lastError: error });
          
          logger.error(`Authentication failed for ${whatsappObj.id}: ${error.message}`);
          
          await safeUpdateWhatsapp(whatsappObj, { 
            status: "DISCONNECTED",
            qrcode: "",
            retries: (whatsappObj.retries || 0) + 1
          });
          
          io.emit(`${whatsappObj.tenantId}:whatsappSession`, {
            action: "update",
            session: {
              id: whatsappObj.id,
              name: whatsappObj.name,
              status: "DISCONNECTED",
              qrcode: "",
              number: whatsappObj.number
            }
          });
          
          reject(error);
        } catch (updateError) {
          logger.error(`Auth failure handling error for ${whatsapp.id}: ${updateError}`);
          reject(updateError instanceof Error ? updateError : new Error(String(updateError)));
        }
      });

      wbot.on("disconnected", async (reason) => {
        try {
          // Ensure we have a valid whatsapp object
          const whatsappObj = await ensureWhatsapp();

          logger.warn(`Session ${whatsappObj.id} disconnected: ${reason}`);
          updateSessionState(whatsappObj.id, { isReady: false });
          stopSessionHealthCheck(whatsappObj.id);
          
          // Remove from sessions array
          const sessionIndex = sessions.findIndex(s => s.id === whatsappObj.id);
          if (sessionIndex !== -1) {
            sessions.splice(sessionIndex, 1);
          }
          
          // Update database status
          try {
            await safeUpdateWhatsapp(whatsappObj, { status: "DISCONNECTED" });
          } catch (error) {
            logger.error(`Error updating disconnected status: ${error}`);
          }
        } catch (error) {
          logger.error(`Error handling disconnection: ${error}`);
        }
      });

      // Initialize the client
      await wbot.initialize();
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

// Enhanced session folder cleanup
export const apagarPastaSessao = async (id: number | string): Promise<void> => {
  const pathRoot = path.resolve(__dirname, "..", "..", ".wwebjs_auth");
  const pathSession = `${pathRoot}/session-wbot-${id}`;
  try {
    await rm(pathSession, { recursive: true, force: true });
    qrCodeCache.delete(Number(id));
    logger.info(`Session folder deleted: ${pathSession}`);
  } catch (error: any) {
    logger.warn(`Could not delete session folder ${pathSession}: ${error.message}`);
  }
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
        await oldSession.destroy().catch(err => {
          logger.warn(`Error destroying old session: ${err}`);
        });
      } catch (err) {
        logger.warn(`Error handling old session: ${err}`);
      }
      sessions.splice(existingSessionIndex, 1);
      logger.info(`Removed existing session ${whatsapp.id} before restore`);
    }

    // Check for existing session data with timeout
    const sessionPath = path.resolve(__dirname, "..", "..", ".wwebjs_auth", `session-wbot-${whatsapp.id}`);
    const hasLocalSession = fs.existsSync(sessionPath);
    const hasDbSession = whatsapp?.session && 
      (typeof whatsapp.session === 'string' ? whatsapp.session.trim() !== "" : 
       typeof whatsapp.session === 'object' && whatsapp.session !== null);
    
    if (!hasLocalSession && !hasDbSession) {
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
      // Restore previous state if restore failed
      if (existingState) sessionStates.set(whatsapp.id, existingState);
      if (existingInitState) initStates.set(whatsapp.id, existingInitState);
      return null;
    }

    // Clear old state only after successful restore
    clearSessionState(whatsapp.id);
    return restoredSession;
  } catch (error) {
    logger.error(`Error restoring session ${whatsapp.id}: ${error}`);
    return null;
  }
};

// Enhanced WebSocket emission with better error handling
const emitQrCodeUpdate = async (whatsapp: Whatsapp, qrCode: string, state: string) => {
  try {
    // Validação mais robusta do objeto whatsapp
    if (!whatsapp) {
      logger.error(`emitQrCodeUpdate: whatsapp é null ou undefined`);
      return;
    }
    
    if (typeof whatsapp !== 'object') {
      logger.error(`emitQrCodeUpdate: whatsapp não é um objeto válido. Tipo: ${typeof whatsapp}`);
      return;
    }
    
    if (!whatsapp.id) {
      logger.error(`emitQrCodeUpdate: whatsapp.id é inválido. whatsapp: ${JSON.stringify(whatsapp)}`);
      return;
    }
    
    if (typeof whatsapp.update !== "function") {
      logger.error(`emitQrCodeUpdate: whatsapp.update não é uma função. whatsapp.id: ${whatsapp.id}, tipo do update: ${typeof whatsapp.update}`);
      
      // Tentar recarregar o objeto whatsapp do banco de dados
      try {
        const freshWhatsapp = await Whatsapp.findByPk(whatsapp.id);
        if (freshWhatsapp && typeof freshWhatsapp.update === "function") {
          logger.info(`emitQrCodeUpdate: Objeto whatsapp recarregado com sucesso para ID ${whatsapp.id}`);
          whatsapp = freshWhatsapp;
        } else {
          logger.error(`emitQrCodeUpdate: Falha ao recarregar objeto whatsapp para ID ${whatsapp.id}`);
          return;
        }
      } catch (reloadError) {
        logger.error(`emitQrCodeUpdate: Erro ao recarregar whatsapp ${whatsapp.id}: ${reloadError}`);
        return;
      }
    }
    
    const io = getIO();
    const now = Date.now();
    
    // Check cache to prevent spam
    const cached = qrCodeCache.get(whatsapp.id);
    const shouldEmit = !cached || 
                      cached.state !== state || 
                      cached.data !== qrCode || 
                      (now - cached.lastEmit) > 5000;
    
    if (shouldEmit) {
      // Update cache
      qrCodeCache.set(whatsapp.id, {
        data: qrCode,
        image: qrCode,
        timestamp: now,
        state,
        lastEmit: now,
        expiresAt: now + QR_CODE_EXPIRY
      });

      // Emit via WebSocket
      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
        action: "update",
        session: {
          id: whatsapp.id,
          name: whatsapp.name,
          status: state,
          qrcode: qrCode,
          number: whatsapp.number,
          timestamp: now
        }
      });

      // Update database with additional error handling
      try {
        await safeUpdateWhatsapp(whatsapp, {
          qrcode: qrCode,
          status: state,
          retries: 0
        });
        logger.debug(`QR Code update emitted for ${whatsapp.id} (${state})`);
      } catch (updateError) {
        logger.error(`Error updating whatsapp ${whatsapp.id} in database: ${updateError}`);
        // Continue execution even if database update fails
      }
    }
  } catch (error) {
    logger.error(`Error emitting QR code update for ${whatsapp?.id || 'unknown'}: ${error}`);
  }
};

// Enhanced session startup
export const StartWhatsAppSession = async (whatsapp: WhatsappWithRetry): Promise<void> => {
  try {
    logger.info(`[StartWhatsAppSession] Starting session ${whatsapp.id} (${whatsapp.name}) - Status: ${whatsapp.status}, isRetry: ${whatsapp.isRetry || false}`);

    // Don't clear state immediately
    const existingState = sessionStates.get(whatsapp.id);
    const existingInitState = initStates.get(whatsapp.id);

    // Remove existing session
    const existingSessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
    if (existingSessionIndex !== -1) {
      try {
        const oldSession = sessions[existingSessionIndex];
        await oldSession.destroy().catch(err => {
          logger.warn(`Error destroying old session: ${err}`);
        });
      } catch (err) {
        logger.warn(`Error handling old session: ${err}`);
      }
      sessions.splice(existingSessionIndex, 1);
      logger.info(`Removed existing session ${whatsapp.id} before start`);
    }

    if (whatsapp.isRetry) {
      logger.info(`[StartWhatsAppSession] Retrying WhatsApp session for ${whatsapp.name} (ID: ${whatsapp.id})`);
    }

    // Try to restore existing session first
    const restored = await restoreSession(whatsapp);
    if (restored) {
      logger.info(`[StartWhatsAppSession] Successfully restored session ${whatsapp.id}`);
      return;
    }

    // If restoration failed, initialize new session
    try {
      logger.info(`[StartWhatsAppSession] Attempting to initialize new session for ${whatsapp.id}`);
      const wbot = await initWbot(whatsapp);
      if (wbot) {
        logger.info(`[StartWhatsAppSession] Successfully initialized new session for ${whatsapp.id}`);
        return;
      }
    } catch (error: any) {
      logger.error(`[StartWhatsAppSession] Failed to initialize new session for ${whatsapp.id}: ${error.message}`);
      // Restore previous state if initialization failed
      if (existingState) sessionStates.set(whatsapp.id, existingState);
      if (existingInitState) initStates.set(whatsapp.id, existingInitState);
      throw error;
    }
  } catch (error: any) {
    logger.error(`[StartWhatsAppSession] Error for ${whatsapp.name}: ${error.message}`);
    throw error;
  }
};

// Enhanced session startup for all WhatsApp connections
export const StartAllWhatsAppsSessions = async (): Promise<void> => {
  try {
    const whatsapps = await Whatsapp.findAll({
      where: { 
        status: { 
          [Op.notIn]: ["DISCONNECTED"] 
        } 
      }
    });

    if (whatsapps.length === 0) {
      logger.info(`[StartAllWhatsAppsSessions] No WhatsApp sessions to start`);
      return;
    }

    logger.info(`[StartAllWhatsAppsSessions] Starting ${whatsapps.length} WhatsApp sessions`);

    // Start sessions with controlled concurrency
    const maxConcurrent = 3; // Limit concurrent initializations
    for (let i = 0; i < whatsapps.length; i += maxConcurrent) {
      const batch = whatsapps.slice(i, i + maxConcurrent);
      
      // Use Promise.all with individual error handling instead of Promise.allSettled
      await Promise.all(
        batch.map(async (whatsapp) => {
          try {
            logger.info(`[StartAllWhatsAppsSessions] Starting session: ${whatsapp.name} (ID: ${whatsapp.id}, Status: ${whatsapp.status})`);
            await StartWhatsAppSession(whatsapp);
          } catch (err) {
            logger.error(`[StartAllWhatsAppsSessions] Error starting session for ${whatsapp.name}: ${err}`);
            // Continue with other sessions even if one fails
          }
        })
      );
      
      // Small delay between batches
      if (i + maxConcurrent < whatsapps.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    logger.info(`[StartAllWhatsAppsSessions] Completed starting sessions. Active sessions: ${sessions.length}`);
  } catch (err) {
    logger.error(`[StartAllWhatsAppsSessions] Error: ${err}`);
  }
};

// Enhanced session synchronization
export const syncSessionStatus = async (): Promise<void> => {
  try {
    // Get all active sessions from database
    const whatsapps = await Whatsapp.findAll({
      where: {
        status: {
          [Op.in]: ["CONNECTED", "READY", "AUTHENTICATED", "OPENING"]
        }
      }
    });
    
    logger.info(`Session sync: ${whatsapps.length} sessions in DB, ${sessions.length} in memory`);
    
    // Check sessions in memory
    for (const session of [...sessions]) { // Create copy to avoid modification during iteration
      const whatsapp = whatsapps.find(w => w.id === session.id);
      
      if (!whatsapp || whatsapp.status !== "CONNECTED") {
        logger.warn(`Session ${session.id} in memory but not active in DB (DB status: ${whatsapp?.status || 'not found'})`);
        
        // Remove from memory
        await removeWbot(session.id, 'sync-cleanup');
        
        // Update database if session exists
        if (whatsapp) {
          await safeUpdateWhatsapp(whatsapp, { 
            status: "DISCONNECTED",
            session: "",
            qrcode: null
          });
          
          // Emit update
          const io = getIO();
          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: whatsapp
          });
        }
      }
    }
    
    // Check sessions in database
    for (const whatsapp of whatsapps) {
      const sessionInMemory = sessions.find(s => s.id === whatsapp.id);
      
      if (!sessionInMemory) {
        logger.warn(`Session ${whatsapp.id} (${whatsapp.name}) not in memory during sync`);
        
        if (whatsapp.status === "CONNECTED") {
          logger.info(`Updating status for session ${whatsapp.id} from CONNECTED to DISCONNECTED (not in memory)`);
          await safeUpdateWhatsapp(whatsapp, { 
            status: "DISCONNECTED",
            session: "",
            qrcode: null
          });
          
          // Emit update
          const io = getIO();
          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: whatsapp
          });
          
          // Attempt reconnection
          try {
            logger.info(`Attempting reconnection for session ${whatsapp.id} during sync`);
            await StartWhatsAppSession({ ...whatsapp, isRetry: true } as WhatsappWithRetry);
          } catch (error: any) {
            logger.error(`Failed to reconnect session ${whatsapp.id}: ${error.message}`);
          }
        }
      } else {
        // Verify session health
        const isHealthy = await isSessionHealthy(sessionInMemory);
        
        if (!isHealthy) {
          logger.warn(`Session ${whatsapp.id} in memory but unhealthy during sync`);
          
          // Remove from memory
          await removeWbot(whatsapp.id, 'sync-health-check');
          
          // Update database
          await safeUpdateWhatsapp(whatsapp, { 
            status: "DISCONNECTED",
            session: "",
            qrcode: null
          });
          
          // Emit update
          const io = getIO();
          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: whatsapp
          });
          
          // Attempt reconnection
          try {
            logger.info(`Attempting reconnection for session ${whatsapp.id} after health check failure`);
            await StartWhatsAppSession({ ...whatsapp, isRetry: true } as WhatsappWithRetry);
          } catch (error: any) {
            logger.error(`Failed to reconnect session ${whatsapp.id}: ${error.message}`);
          }
        }
      }
    }
  } catch (error: any) {
    logger.error(`Error in session sync: ${error.message}`);
  }
};

// Debug information getter
export const getSessionsDebugInfo = (): any => {
  return {
    sessionsInMemory: sessions.length,
    sessionIds: sessions.map(s => ({
      id: s.id,
      hasInfo: !!s.info,
      isPageClosed: s.pupPage?.isClosed() || false,
      state: s.info?.wid || 'no-info',
      lastHeartbeat: s.lastHeartbeat || 0
    })),
    sessionStates: Array.from(sessionStates.entries()).map(([id, state]) => ({
      id,
      ...state
    })),
    initStates: Array.from(initStates.entries()).map(([id, state]) => ({
      id,
      ...state
    })),
    cacheInfo: {
      qrCodeCache: qrCodeCache.size,
      healthChecks: sessionHealthCheck.size,
      initTimeouts: initTimeouts.size
    }
  };
};

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
    // Stop all health checks
    for (const [whatsappId] of sessionHealthCheck.entries()) {
      stopSessionHealthCheck(whatsappId);
    }
    
    // Clear all timeouts
    for (const [whatsappId, timeout] of initTimeouts.entries()) {
      clearTimeout(timeout);
      initTimeouts.delete(whatsappId);
    }
    
    // Destroy all sessions with timeout
    const destroyPromises = sessions.map(async (session) => {
      try {
        await Promise.race([
          session.destroy(),
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
    sessionHealthCheck.clear();
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

// Periodic session sync
setInterval(() => {
  syncSessionStatus().catch(error => {
    logger.error(`Periodic sync error: ${error}`);
  });
}, SYNC_INTERVAL);

// Global heartbeat for WebSocket connections
setInterval(() => {
  const io = getIO();
  const now = Date.now();
  
  // Check and clean expired QR codes
  for (const [whatsappId, cached] of qrCodeCache.entries()) {
    if (cached.expiresAt < now) {
      qrCodeCache.delete(whatsappId);
      continue;
    }
    
    // Send heartbeat for active QR codes
    const whatsapp = sessions.find(s => s.id === whatsappId);
    if (whatsapp && cached.state === "qrcode") {
      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
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
}, HEARTBEAT_INTERVAL);

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