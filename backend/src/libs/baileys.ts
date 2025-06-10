import { 
  WASocket, 
  DisconnectReason, 
  useMultiFileAuthState, 
  makeCacheableSignalKeyStore,
  BaileysEventMap,
  AuthenticationState,
  SignalDataTypeMap,
  makeWASocket
} from '@whiskeysockets/baileys';
import type { ILogger } from '@whiskeysockets/baileys/lib/Utils/logger';
import { Boom } from '@hapi/boom';
import { join } from 'path';
import { writeFile, readFile, unlink, rm } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { logger } from '../utils/logger';
import AppError from '../errors/AppError';
import { WhatsAppErrors } from '../utils/errorHandler';
import { getIO } from './socket';
import Whatsapp from '../models/Whatsapp';
import { safeUpdateWhatsapp } from '../helpers/WhatsappHelper';
import QRCode from 'qrcode';
import pino from 'pino';
import { tratarErroInicializacao, iniciarVerificacoesPeriodicas } from './WhatsAppConnectionManager';

// Constantes
const SESSION_HEALTH_CHECK_INTERVAL = 60000; // Aumentar para 1 minuto
const MAX_INIT_TIME = 120000; // Reduzir para 2 minutos
const RETRY_DELAY = 5000; // Reduzir para 5 segundos
const MAX_RETRY_ATTEMPTS = 3; // Reduzir número de tentativas
const QR_CODE_EXPIRY = 30000; // Reduzir para 30 segundos
const HEARTBEAT_TIMEOUT = 30000; // Reduzir para 30 segundos

// Tipos
interface Session extends WASocket {
  id: number;
  tenantId: number;
  lastHeartbeat?: number;
}

interface SessionState {
  isInitializing: boolean;
  isReady: boolean;
  lastHeartbeat: number;
  lastError?: Error;
}

interface InitState {
  isInitializing: boolean;
  initStartTime?: number;
  lastInitAttempt: number;
  initAttempts: number;
  lastError?: Error;
}

interface QrCodeCache {
  data: string;
  image: string;
  timestamp: number;
  state: string;
  lastEmit: number;
  expiresAt: number;
}

// Estado global
const sessions: Session[] = [];
const sessionStates = new Map<number, SessionState>();
const initStates = new Map<number, InitState>();
const initTimeouts = new Map<number, NodeJS.Timeout>();
const qrCodeCache = new Map<number, QrCodeCache>();
const healthCheckIntervals = new Map<number, NodeJS.Timeout>();

// Criar um logger simples
const pinoLogger = pino({
  level: 'silent'
});

// Criar um objeto que implementa ILogger completamente
const baileysLogger: ILogger = {
  level: 'silent',
  child: () => baileysLogger,
  trace: (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') {
      pinoLogger.trace(obj);
    } else if (msg) {
      pinoLogger.trace(msg, obj);
    } else {
      pinoLogger.trace(obj);
    }
    return baileysLogger;
  },
  debug: (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') {
      pinoLogger.debug(obj);
    } else if (msg) {
      pinoLogger.debug(msg, obj);
    } else {
      pinoLogger.debug(obj);
    }
    return baileysLogger;
  },
  info: (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') {
      pinoLogger.info(obj);
    } else if (msg) {
      pinoLogger.info(msg, obj);
    } else {
      pinoLogger.info(obj);
    }
    return baileysLogger;
  },
  warn: (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') {
      pinoLogger.warn(obj);
    } else if (msg) {
      pinoLogger.warn(msg, obj);
    } else {
      pinoLogger.warn(obj);
    }
    return baileysLogger;
  },
  error: (obj: object | string, msg?: string) => {
    if (typeof obj === 'string') {
      pinoLogger.error(obj);
    } else if (msg) {
      pinoLogger.error(msg, obj);
    } else {
      pinoLogger.error(obj);
    }
    return baileysLogger;
  }
};

// Funções auxiliares
const getSessionPath = (whatsappId: number) => {
  const sessionDir = join(__dirname, '..', '..', '.baileys_auth');
  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }
  return join(sessionDir, `session-${whatsappId}`);
};

const canInitSession = (whatsappId: number): boolean => {
  const state = initStates.get(whatsappId);
  const now = Date.now();
  
  if (!state) return true;
  
  if (state.isInitializing) {
    if (state.initStartTime && (now - state.initStartTime) > MAX_INIT_TIME) {
      logger.warn(`Session ${whatsappId} initialization stuck for ${now - state.initStartTime}ms, allowing retry`);
      return true;
    }
    return false;
  }
  
  if (now - state.lastInitAttempt < RETRY_DELAY) return false;
  
  const backoffTime = Math.min(120000, state.initAttempts * 15000);
  if (state.initAttempts >= MAX_RETRY_ATTEMPTS && now - state.lastInitAttempt < backoffTime) {
    return false;
  }
  
  if (now - state.lastInitAttempt > 300000) {
    state.initAttempts = 0;
    initStates.set(whatsappId, state);
  }
  
  return true;
};

const updateInitState = (whatsappId: number, isInitializing: boolean, error?: Error): void => {
  const state = initStates.get(whatsappId) || {
    isInitializing: false,
    lastInitAttempt: 0,
    initAttempts: 0
  };
  
  const now = Date.now();
  
  if (isInitializing) {
    state.lastInitAttempt = now;
    state.initStartTime = now;
    state.initAttempts++;
  } else {
    state.isInitializing = false;
    state.initStartTime = undefined;
    if (error) {
      state.lastError = error;
      if (error.message.includes('timeout')) {
        state.initAttempts = Math.max(0, state.initAttempts - 1);
      }
    }
  }
  
  initStates.set(whatsappId, state);
};

const updateSessionState = (whatsappId: number, state: Partial<SessionState>): void => {
  try {
    const currentState = sessionStates.get(whatsappId) || {
      isInitializing: false,
      isReady: false,
      lastHeartbeat: Date.now()
    };

    const newState = {
      ...currentState,
      ...state,
      lastHeartbeat: state.lastHeartbeat || currentState.lastHeartbeat
    };

    sessionStates.set(whatsappId, newState);

    // Forçar reset de sessões presas em inicialização por muito tempo
    if (currentState.isInitializing && !state.isInitializing && state.isReady) {
      const initTime = Date.now() - currentState.lastHeartbeat;
      if (initTime > MAX_INIT_TIME) {
        logger.warn(`Session ${whatsappId} was stuck initializing for ${initTime}ms, forcing reset`);
        removeBaileys(whatsappId, 'timeout');
      }
    }

    logger.debug(`Session ${whatsappId} state updated:`, newState);
  } catch (err) {
    logger.error(`Error updating session state: ${err}`);
  }
};

const generateQrCodeImage = async (qrData: string, whatsappId: number): Promise<string> => {
  try {
    const now = Date.now();
    const cached = qrCodeCache.get(whatsappId);
    
    if (cached && cached.data === qrData && cached.expiresAt > now) {
      return cached.image;
    }

    // Limitar o tamanho do QR Code usando um nível de correção de erro mais baixo
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      type: 'image/png',
      margin: 1,
      width: 200,
      errorCorrectionLevel: 'L', // Nível mais baixo de correção de erro
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

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
    // Em caso de erro, retornar o QR code como texto puro
    return `data:text/plain;base64,${Buffer.from(qrData).toString('base64')}`;
  }
};

// Função auxiliar para atualizar o WhatsApp
const updateWhatsApp = async (whatsapp: Whatsapp, updates: Partial<Whatsapp>): Promise<void> => {
  try {
    const success = await safeUpdateWhatsapp(whatsapp, updates);
    if (!success) {
      throw new Error(`Failed to update WhatsApp ${whatsapp.id}`);
    }
  } catch (err) {
    logger.error(`Error updating WhatsApp ${whatsapp.id}: ${err}`);
    throw err;
  }
};

// Função auxiliar para verificar erros de sessão fechada
const isSessionClosedError = (err: any): boolean => {
  return err?.message?.includes('Connection closed') || 
         err?.message?.includes('Socket closed') ||
         err?.message?.includes('Connection reset');
};

// Implementação local do store
const makeInMemoryStore = (options?: { logger?: ILogger }) => {
  const store = {
    contacts: {},
    messages: {},
    presence: {},
    ev: {
      on: (event: string, callback: (...args: any[]) => void) => {
        // Implementação vazia do método on
        return () => {}; // Retorna uma função de cleanup
      },
      emit: (event: string, ...args: any[]) => {
        // Implementação vazia do método emit
      }
    }
  };
  return store;
};

// Função principal de inicialização
export const initBaileys = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise<Session>(async (resolve, reject) => {
    let initTimeout: NodeJS.Timeout | undefined;
    let heartbeatTimeout: NodeJS.Timeout | undefined;
    const io = getIO();
    
    try {
      // Verificar se já existe uma sessão
      const existingSession = sessions.find(s => s.id === whatsapp.id);
      if (existingSession) {
        logger.info(`Session ${whatsapp.id} already exists, checking state...`);
        const sessionState = sessionStates.get(whatsapp.id);
        
        // Se a sessão existente estiver pronta, reutilizar
        if (sessionState?.isReady && existingSession.user) {
          logger.info(`Session ${whatsapp.id} is already ready, reusing...`);
          return resolve(existingSession);
        }
        
        // Se a sessão existente não estiver pronta, remover e reinicializar
        logger.info(`Session ${whatsapp.id} exists but not ready, removing before reinitializing`);
        await removeBaileys(whatsapp.id);
      }

      // Limpar estado anterior
      sessionStates.set(whatsapp.id, {
        isInitializing: true,
        isReady: false,
        lastHeartbeat: Date.now()
      });

      logger.info(`Initializing Baileys session ${whatsapp.id} (${whatsapp.name})`);

      // Configurar autenticação
      const { state, saveCreds } = await useMultiFileAuthState(getSessionPath(whatsapp.id));

      // Criar nova sessão
      const sock = makeWASocket({
        auth: state,
        logger: baileysLogger,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        emitOwnEvents: true,
        markOnlineOnConnect: true,
        retryRequestDelayMs: 5000,
        fireInitQueries: true,
        keepAliveIntervalMs: 15000,
        generateHighQualityLinkPreview: true,
        getMessage: async () => {
          return { conversation: "" };
        }
      }) as Session;

      // Configurar propriedades da sessão
      sock.id = whatsapp.id;
      sock.tenantId = whatsapp.tenantId;
      sock.lastHeartbeat = Date.now();

      // Adicionar à lista de sessões antes de configurar handlers
      sessions.push(sock);

      // Configurar handlers de eventos
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Log do estado atual da conexão
        const connectionState = connection || 'waiting_qr';
        logger.info(`Connection update for session ${whatsapp.id}: ${connectionState}`);
        
        // Resetar timeout do heartbeat
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
        heartbeatTimeout = setTimeout(() => {
          logger.warn(`Session ${whatsapp.id} heartbeat timeout`);
          if (sock) {
            sock.end(new Error('heartbeat_timeout'));
          }
        }, HEARTBEAT_TIMEOUT);

        if (qr) {
          logger.info(`QR Code received for session ${whatsapp.id}`);
          try {
            const qrCode = await generateQrCodeImage(qr, whatsapp.id);
            await safeUpdateWhatsapp(whatsapp, { 
              status: "qrcode",
              qrcode: qrCode
            });
            
            io.emit(`${whatsapp.tenantId}:whatsappSession`, {
              action: "update",
              session: whatsapp
            });
          } catch (err) {
            logger.error(`Error handling QR code for session ${whatsapp.id}: ${err}`);
          }
        }

        if (connection === 'connecting') {
          logger.info(`Session ${whatsapp.id} is connecting...`);
          await safeUpdateWhatsapp(whatsapp, { 
            status: "CONNECTING",
            qrcode: ""
          });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                statusCode !== DisconnectReason.badSession;
          
          logger.info(`Connection closed for ${whatsapp.id} due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
          
          // Limpar timeouts
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
          if (initTimeout) clearTimeout(initTimeout);
          
          // Atualizar estado
          updateSessionState(whatsapp.id, { isReady: false });
          await safeUpdateWhatsapp(whatsapp, { 
            status: "DISCONNECTED",
            qrcode: "",
            retries: (whatsapp.retries || 0) + 1
          });
          
          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: whatsapp
          });

          if (shouldReconnect) {
            // Tentar reconexão após um delay
            setTimeout(() => {
              initBaileys(whatsapp).catch(err => {
                logger.error(`Reconnection failed for ${whatsapp.id}: ${err}`);
              });
            }, RETRY_DELAY);
          } else {
            // Remover sessão se não deve reconectar
            await removeBaileys(whatsapp.id, 'logged_out');
          }
        }

        if (connection === 'open') {
          // Limpar timeouts
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
          if (initTimeout) clearTimeout(initTimeout);

          // Verificar se a sessão está realmente pronta
          if (!sock.user) {
            logger.warn(`Session ${whatsapp.id} connection open but user not available`);
            return;
          }

          logger.info(`Session ${whatsapp.id} connected successfully`);
          
          // Atualizar estado
          updateSessionState(whatsapp.id, { isReady: true });
          
          try {
            await safeUpdateWhatsapp(whatsapp, {
              status: "CONNECTED",
              qrcode: "",
              retries: 0
            });
            
            io.emit(`${whatsapp.tenantId}:whatsappSession`, {
              action: "update",
              session: whatsapp
            });
            
            resolve(sock);
          } catch (error) {
            logger.error(`Error updating connected status: ${error}`);
            reject(error);
          }
        }
      });

      // Salvar credenciais quando atualizadas
      sock.ev.on('creds.update', saveCreds);

      // Configurar timeout de inicialização
      initTimeout = setTimeout(() => {
        if (!sessionStates.get(whatsapp.id)?.isReady) {
          const error = new Error(`Session ${whatsapp.id} initialization timeout`);
          updateSessionState(whatsapp.id, { isReady: false, isInitializing: false });
          reject(error);
        }
      }, MAX_INIT_TIME);

      // Iniciar verificações periódicas se ainda não estiverem rodando
      if (sessions.length === 1) {
        iniciarVerificacoesPeriodicas();
      }

    } catch (err) {
      // Limpar timeouts em caso de erro
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
      if (initTimeout) clearTimeout(initTimeout);
      
      logger.error(`Error initializing Baileys session for ${whatsapp.id}: ${err}`);
      updateSessionState(whatsapp.id, { 
        isReady: false,
        isInitializing: false
      });
      reject(err);
    }
  });
};

// Funções de gerenciamento de sessão
export const getBaileys = (whatsappId: number): Session => {
  const session = sessions.find(s => s.id === whatsappId);
  
  if (!session) {
    logger.warn(`Session ${whatsappId} not found. Available: [${sessions.map(s => s.id).join(', ')}]`);
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  
  const sessionState = sessionStates.get(whatsappId);
  if (!sessionState?.isReady) {
    logger.warn(`Session ${whatsappId} not ready (state: ${JSON.stringify(sessionState)})`);
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  
  session.lastHeartbeat = Date.now();
  updateSessionState(whatsappId, { lastHeartbeat: Date.now() });
  
  return session;
};

export const removeBaileys = async (whatsappId: number, reason: string = 'unknown'): Promise<void> => {
  logger.info(`Removing session ${whatsappId} (reason: ${reason})`);
  
  try {
    // Limpar intervalo de health check
    const healthInterval = healthCheckIntervals.get(whatsappId);
    if (healthInterval) {
      clearInterval(healthInterval);
      healthCheckIntervals.delete(whatsappId);
    }
    
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
      logger.error(`Error removing Baileys session: ${err}`);
    }
  }
};

export const isSessionReady = (whatsappId: number): boolean => {
  const state = sessionStates.get(whatsappId);
  if (!state) return false;

  // Verificar se a sessão está pronta e teve heartbeat recente
  const isHealthy = state.isReady && 
                   !state.isInitializing && 
                   Date.now() - state.lastHeartbeat < HEARTBEAT_TIMEOUT;

  if (!isHealthy && state.isReady) {
    logger.warn(`Session ${whatsappId} marked as ready but no recent heartbeat`);
  }

  return isHealthy;
};

export const isSessionInitializing = (whatsappId: number): boolean => {
  const state = sessionStates.get(whatsappId);
  return state?.isInitializing ?? false;
};

// Novo método para monitorar saúde da sessão
const startSessionHealthCheck = (): void => {
  setInterval(() => {
    sessionStates.forEach((state, whatsappId) => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - state.lastHeartbeat;

      // Resetar sessões sem heartbeat por muito tempo
      if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
        logger.warn(`Session ${whatsappId} no heartbeat for ${timeSinceLastHeartbeat}ms, resetting...`);
        removeBaileys(Number(whatsappId), 'heartbeat_timeout');
      }
    });
  }, SESSION_HEALTH_CHECK_INTERVAL);
};

// Iniciar monitoramento
startSessionHealthCheck();

// Exportar tipos
export type { Session, SessionState, InitState };

// Exportar a função updateSessionState
export { updateSessionState };