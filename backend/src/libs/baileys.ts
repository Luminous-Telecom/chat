import { makeWASocket, useMultiFileAuthState, DisconnectReason, BaileysEventMap, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { logger as baseLogger } from "../utils/logger";
import { BaileysClient } from "../types/baileys";
import Whatsapp from "../models/Whatsapp";
import { join } from "path";
import { rm } from "fs/promises";

// Array to store active sessions
const sessions: BaileysClient[] = [];

// Maximum number of reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 3;

// Track reconnection timeouts to prevent multiple simultaneous attempts
const reconnectionTimeouts = new Map<number, NodeJS.Timeout>();
const initializingSession = new Set<number>();

// ===== NOVO: Controle para evitar loops de "ws undefined" =====
const wsUndefinedChecks = new Map<number, {
  count: number;
  lastCheck: number;
  isHandling: boolean;
}>();

const WS_UNDEFINED_CONFIG = {
  MAX_CHECKS: 3, // Máximo 3 verificações antes de parar
  CHECK_INTERVAL: 60000, // 1 minuto entre verificações
  RESET_TIME: 300000 // 5 minutos para resetar contador
};

// Function to clear reconnection timeout
const clearReconnectionTimeout = (whatsappId: number): void => {
  const timeout = reconnectionTimeouts.get(whatsappId);
  if (timeout) {
    clearTimeout(timeout);
    reconnectionTimeouts.delete(whatsappId);
  }
};

// ===== NOVO: Gerencia verificações de WebSocket undefined =====
const shouldCheckWsUndefined = (whatsappId: number): boolean => {
  const now = Date.now();
  const check = wsUndefinedChecks.get(whatsappId);
  
  if (!check) {
    wsUndefinedChecks.set(whatsappId, {
      count: 1,
      lastCheck: now,
      isHandling: false
    });
    return true;
  }
  
  // Reset contador se passou tempo suficiente
  if ((now - check.lastCheck) > WS_UNDEFINED_CONFIG.RESET_TIME) {
    check.count = 1;
    check.lastCheck = now;
    check.isHandling = false;
    return true;
  }
  
  // Não verifica se já está lidando com o problema
  if (check.isHandling) {
    return false;
  }
  
  // Não verifica se atingiu o limite
  if (check.count >= WS_UNDEFINED_CONFIG.MAX_CHECKS) {
    baseLogger.warn(`Session ${whatsappId} ws undefined checks exceeded limit, ignoring`);
    return false;
  }
  
  // Não verifica se muito recente
  if ((now - check.lastCheck) < WS_UNDEFINED_CONFIG.CHECK_INTERVAL) {
    return false;
  }
  
  check.count++;
  check.lastCheck = now;
  return true;
};

const markWsUndefinedHandling = (whatsappId: number, isHandling: boolean): void => {
  const check = wsUndefinedChecks.get(whatsappId);
  if (check) {
    check.isHandling = isHandling;
  }
};

const resetWsUndefinedChecks = (whatsappId: number): void => {
  wsUndefinedChecks.delete(whatsappId);
};

// Add this function after the clearReconnectionTimeout function
const handleWsUndefined = async (whatsappId: number, whatsapp: Whatsapp): Promise<void> => {
  const check = wsUndefinedChecks.get(whatsappId) || { count: 0, lastCheck: Date.now(), isHandling: false };
  
  // If we're already handling this, skip
  if (check.isHandling) {
    return;
  }
  
  // If we've checked too many times recently, wait
  const now = Date.now();
  if (check.count >= WS_UNDEFINED_CONFIG.MAX_CHECKS && 
      (now - check.lastCheck) < WS_UNDEFINED_CONFIG.RESET_TIME) {
    return;
  }
  
  // Reset count if enough time has passed
  if ((now - check.lastCheck) > WS_UNDEFINED_CONFIG.RESET_TIME) {
    check.count = 0;
  }
  
  // Update check state
  check.count++;
  check.lastCheck = now;
  check.isHandling = true;
  wsUndefinedChecks.set(whatsappId, check);
  
  try {
    baseLogger.warn(`Handling ws undefined state for ${whatsapp.name} (attempt ${check.count}/${WS_UNDEFINED_CONFIG.MAX_CHECKS})`);
    
    // Force session cleanup
    await removeBaileysSession(whatsappId);
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Attempt to reinitialize
    const newSession = await initBaileys(whatsapp);
    sessions.push(newSession);
    
    baseLogger.info(`Successfully reinitialized session for ${whatsapp.name}`);
  } catch (err) {
    baseLogger.error(`Failed to handle ws undefined state for ${whatsapp.name}: ${err}`);
  } finally {
    // Reset handling state
    check.isHandling = false;
    wsUndefinedChecks.set(whatsappId, check);
  }
};

// Função auxiliar para fechar o WebSocket de forma segura
const safeCloseWebSocket = async (wbot: any): Promise<void> => {
  try {
    if (!wbot.ws) return;
    
    const ws = wbot.ws;
    if (typeof ws.close === 'function') {
      ws.close();
    } else if (typeof ws.terminate === 'function') {
      ws.terminate();
    } else if (typeof ws.destroy === 'function') {
      ws.destroy();
    }
    
    // Aguardar um momento para garantir que a conexão foi fechada
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Limpar referência
    wbot.ws = undefined;
  } catch (err) {
    baseLogger.warn(`Erro ao fechar WebSocket: ${err}`);
  }
};

// Enhanced session removal with better cleanup
export const removeBaileysSession = async (whatsappId: number): Promise<void> => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
  if (sessionIndex !== -1) {
    const session = sessions[sessionIndex];
    try {
      baseLogger.info(`Cleaning up session for WhatsApp ID: ${whatsappId}`);
      
      // Clear any pending reconnection timeouts
      clearReconnectionTimeout(whatsappId);
      
      // Reset WebSocket undefined checks
      resetWsUndefinedChecks(whatsappId);
      
      // Remove from initializing set if present
      initializingSession.delete(whatsappId);
      
      // Remove all event listeners to prevent memory leaks
      try {
        session.ev.removeAllListeners('connection.update');
        session.ev.removeAllListeners('creds.update');
        session.ev.removeAllListeners('messages.upsert');
        session.ev.removeAllListeners('messages.update');
        session.ev.removeAllListeners('message-receipt.update');
        session.ev.removeAllListeners('presence.update');
        session.ev.removeAllListeners('contacts.update');
        session.ev.removeAllListeners('chats.update');
        session.ev.removeAllListeners('groups.update');
        session.ev.removeAllListeners('group-participants.update');
        session.ev.removeAllListeners('blocklist.set');
        session.ev.removeAllListeners('blocklist.update');
        session.ev.removeAllListeners('call');
        
        try {
          session.ev.removeAllListeners('labels.edit' as any);
          session.ev.removeAllListeners('labels.association' as any);
        } catch (labelErr) {
          // Ignore if these events don't exist
        }
      } catch (eventErr) {
        baseLogger.warn(`Error removing event listeners: ${eventErr}`);
      }
      
      // Close WebSocket connection gracefully
      try {
        const wsState = (session as any)?.ws?.readyState;
        if (wsState === 1) { // WebSocket.OPEN
          await session.logout();
          baseLogger.info(`Successfully logged out session ${whatsappId}`);
        } else {
          await safeCloseWebSocket(session);
          baseLogger.info(`Closed WebSocket for session ${whatsappId}`);
        }
      } catch (err) {
        baseLogger.warn(`Error during logout/close: ${err}`);
      }
      
      // Remove from sessions array
      sessions.splice(sessionIndex, 1);
      baseLogger.info(`Session ${whatsappId} removed from active sessions`);
      
    } catch (err) {
      baseLogger.error(`Error cleaning up session ${whatsappId}: ${err}`);
    }
  }
};

// ===== CORRIGIDO: Session getter SEM loops de ws undefined =====
export const getBaileysSession = (whatsappId: number): BaileysClient | undefined => {
  const session = sessions.find(s => s.id === whatsappId);
  if (!session) return undefined;
  
  const wsState = (session as any)?.ws?.readyState;
  const connectionState = (session as any)?.connection;
  
  // Log current state for debugging
  baseLogger.debug(`Session ${whatsappId} state - connection: ${connectionState}, ws: ${wsState}`);
   
  // ===== NOVA ABORDAGEM: Verificação controlada e limitada =====
  if (connectionState === 'open' && wsState === undefined) {
    baseLogger.debug(`Session ${whatsappId} has connection open but ws undefined`);
    return session;
  }
  
  // Session é usável se:
  // 1. Connection está open (independente do WebSocket - pode estar se reconectando)
  // 2. Connection está connecting com WebSocket válido
  // 3. Estamos em uma tentativa de reconexão
  const isUsable = (
    connectionState === 'open' || // Aceita mesmo com ws undefined
    (connectionState === 'connecting' && (wsState === 0 || wsState === 1)) ||
    reconnectionTimeouts.has(whatsappId)
  );
  
  if (!isUsable) {
    baseLogger.warn(`Session ${whatsappId} is not usable - connection: ${connectionState}, ws: ${wsState}`);
  }
  
  return isUsable ? session : undefined;
};

// Add a function to force session restart
export const restartBaileysSession = async (whatsappId: number): Promise<BaileysClient | null> => {
  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      baseLogger.error(`WhatsApp instance ${whatsappId} not found`);
      return null;
    }
    
    baseLogger.info(`Force restarting session for ${whatsapp.name}`);
    
    // Clean up existing session
    await removeBaileysSession(whatsappId);
    
    // Clear session directory to force fresh start
    const sessionDir = join(__dirname, '..', '..', 'session', `session-${whatsappId}`);
    try {
      await rm(sessionDir, { recursive: true, force: true });
      baseLogger.info(`Cleared session directory for fresh start`);
    } catch (err) {
      baseLogger.warn(`Could not clear session directory: ${err}`);
    }
    
    // Reset database status
    await whatsapp.update({
      status: 'DISCONNECTED',
      qrcode: '',
      retries: 0
    });
    
    // Initialize new session
    const newSession = await initBaileys(whatsapp);
    sessions.push(newSession);
    
    return newSession;
  } catch (err) {
    baseLogger.error(`Error restarting session ${whatsappId}: ${err}`);
    return null;
  }
};

// Função auxiliar para reconectar de forma segura
const safeReconnect = async (wbot: any, whatsapp: Whatsapp): Promise<void> => {
  try {
    baseLogger.info(`Iniciando reconexão segura para ${whatsapp.name}`);
    
    // Primeiro, fechar a conexão atual de forma segura
    await safeCloseWebSocket(wbot);
    
    // Aguardar um momento para garantir que tudo foi limpo
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Em vez de tentar usar connect/end, vamos reinicializar a sessão
    const newSession = await initBaileys(whatsapp);
    
    // Atualizar a sessão na lista de sessões ativas
    const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
    if (sessionIndex !== -1) {
      sessions[sessionIndex] = newSession;
    } else {
      sessions.push(newSession);
    }
    
    baseLogger.info(`Reconexão concluída para ${whatsapp.name}`);
  } catch (err) {
    baseLogger.error(`Erro durante reconexão segura: ${err}`);
    throw err;
  }
};

export const initBaileys = async (whatsapp: Whatsapp, phoneNumber?: string): Promise<BaileysClient> => {
  try {
    // Prevent multiple simultaneous initializations for the same session
    if (initializingSession.has(whatsapp.id)) {
      baseLogger.info(`Session ${whatsapp.name} is already being initialized, skipping`);
      throw new Error('Session already being initialized');
    }
    
    initializingSession.add(whatsapp.id);
    
    baseLogger.info(`Initializing WhatsApp session for ${whatsapp.name} (ID: ${whatsapp.id})`);
    
    // Se estiver tentando conectar por número, limpar completamente a sessão primeiro
    if (phoneNumber) {
      baseLogger.info(`Modo de número detectado - limpando sessão completamente`);
      
      // Remover sessão existente se houver
      const existingSession = sessions.find(s => s.id === whatsapp.id);
      if (existingSession) {
        baseLogger.info(`Removendo sessão existente antes de iniciar modo número`);
        await removeBaileysSession(whatsapp.id);
      }
      
      // Limpar diretório da sessão
      const sessionDir = join(__dirname, '..', '..', 'session', `session-${whatsapp.id}`);
      try {
        await rm(sessionDir, { recursive: true, force: true });
        baseLogger.info(`Diretório da sessão limpo para ${whatsapp.name}`);
      } catch (err) {
        baseLogger.warn(`Erro ao limpar diretório da sessão: ${err}`);
      }
      
      // Atualizar status no banco
      await whatsapp.update({
        status: 'CONNECTING',
        qrcode: '',
        retries: 0
      });
      
      // Pequeno delay para garantir que tudo foi limpo
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check if we've exceeded max reconnection attempts
    const currentRetries = whatsapp.retries || 0;
    if (currentRetries >= MAX_RECONNECT_ATTEMPTS) {
      baseLogger.error(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${whatsapp.name}`);
      await whatsapp.update({
        status: 'DISCONNECTED',
        qrcode: '',
        retries: 0
      });
      throw new Error('Maximum reconnection attempts reached');
    }

    // Check if there's already an active session
    const existingSession = sessions.find(s => s.id === whatsapp.id);
    if (existingSession) {
      baseLogger.info(`Session ${whatsapp.name} already exists, cleaning up first`);
      await removeBaileysSession(whatsapp.id);
    }
    
    // Clear any pending reconnection timeouts
    clearReconnectionTimeout(whatsapp.id);
    
    // Reset WebSocket undefined checks
    resetWsUndefinedChecks(whatsapp.id);
    
    const sessionDir = join(__dirname, '..', '..', 'session', `session-${whatsapp.id}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    baseLogger.info(`Created new auth state for session`);

    const wbot = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('Chrome'),
      connectTimeoutMs: phoneNumber ? 120000 : 60000,
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: false,
      retryRequestDelayMs: phoneNumber ? 10000 : 5000,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      keepAliveIntervalMs: 15000,
      qrTimeout: phoneNumber ? 0 : 60000,
      getMessage: async () => undefined,
      shouldIgnoreJid: () => false,
      linkPreviewImageThumbnailWidth: 0,
      transactionOpts: {
        maxCommitRetries: phoneNumber ? 10 : 5,
        delayBetweenTriesMs: phoneNumber ? 5000 : 3000
      },
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
          message.buttonsMessage 
          || message.templateMessage
          || message.listMessage
        );
        if (requiresPatch) {
          message = { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {}, }, ...message, }, }, };
        }
        return message;
      },
      logger: require('pino')({ level: 'error' })
    }) as BaileysClient;

    // Adiciona handler de erro do WebSocket com retry
    if ((wbot as any).ws) {
      const ws = (wbot as any).ws;
      
      ws.on('error', async (err: Error) => {
        baseLogger.error(`WebSocket error for ${whatsapp.name}: ${err.message}`);
        
        // Se estiver em modo número, tentar reconectar
        if (phoneNumber) {
          baseLogger.info(`Tentando reconectar WebSocket para ${whatsapp.name}`);
          try {
            await safeReconnect(wbot, whatsapp);
          } catch (reconnectErr) {
            baseLogger.error(`Erro ao reconectar WebSocket: ${reconnectErr}`);
          }
        }
      });

      ws.on('close', async (code: number, reason: string) => {
        baseLogger.info(`WebSocket closed for ${whatsapp.name} (code: ${code}, reason: ${reason})`);
        
        // Se estiver em modo número e o código for 1006, tentar reconectar
        if (phoneNumber && code === 1006) {
          baseLogger.info(`Tentando reconectar após fechamento inesperado do WebSocket`);
          try {
            await safeReconnect(wbot, whatsapp);
          } catch (reconnectErr) {
            baseLogger.error(`Erro ao reconectar após fechamento: ${reconnectErr}`);
          }
        }
      });

      ws.on('ping', () => {
        baseLogger.debug(`WebSocket ping received for ${whatsapp.name}`);
      });

      ws.on('pong', () => {
        baseLogger.debug(`WebSocket pong sent for ${whatsapp.name}`);
      });
    }

    // Add necessary properties
    (wbot as any).id = whatsapp.id;
    (wbot as any).connection = 'connecting';
    
    (wbot as any).getContactById = async (id: string) => {
      try {
        const contact = await wbot.fetchStatus(id);
        return contact;
      } catch (err) {
        baseLogger.error(`Error fetching contact: ${err}`);
        return null;
      }
    };
    
    (wbot as any).getNumberId = async (number: string) => {
      try {
        const result = await wbot.onWhatsApp(number);
        if (Array.isArray(result) && result.length > 0) {
          return result[0]?.jid;
        }
        return null;
      } catch (err) {
        baseLogger.error(`Error getting number ID: ${err}`);
        return null;
      }
    };

    // Set up credentials handler
    wbot.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        baseLogger.info(`Credentials updated for session ${whatsapp.id}`);
        await whatsapp.update({ retries: 0 });
      } catch (err) {
        baseLogger.error(`Error saving credentials: ${err}`);
      }
    });

    // Modify the connection.update handler in initBaileys
    wbot.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Se estiver usando número, ignorar QR codes
      if (phoneNumber && qr) {
        baseLogger.debug(`QR code recebido durante modo número - ignorando`);
        return;
      }
      
      // Update connection state
      (wbot as any).connection = connection;
      
      // Check for ws undefined state
      if (connection === 'open' && !(wbot as any).ws) {
        baseLogger.warn(`Session ${whatsapp.name} has open connection but ws is undefined`);
        await handleWsUndefined(whatsapp.id, whatsapp);
        return;
      }
      
      // Reset WebSocket checks when successfully connected
      if (connection === 'open' && (wbot as any).ws) {
        resetWsUndefinedChecks(whatsapp.id);
      }
      
      // Se houver uma desconexão, verificar o motivo
      if (lastDisconnect) {
        const statusCode = (lastDisconnect as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          baseLogger.info(`Session ${whatsapp.name} disconnected with status ${statusCode}, attempting to reconnect...`);
          
          // Tentar reconectar usando a nova função segura
          try {
            await safeReconnect(wbot, whatsapp);
          } catch (err) {
            baseLogger.error(`Erro durante reconexão após desconexão: ${err}`);
          }
        } else {
          baseLogger.info(`Session ${whatsapp.name} logged out, not attempting to reconnect`);
          await whatsapp.update({
            status: 'DISCONNECTED',
            qrcode: '',
            retries: 0
          });
        }
      }
      
      if (qr) {
        baseLogger.info(`QR Code received for ${whatsapp.name}`);
        await whatsapp.update({ 
          status: 'qrcode',
          qrcode: qr,
          retries: 0
        });
        // Emitir evento para o frontend com o novo QR code
        const io = require('../libs/socket').getIO();
        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: {
            id: whatsapp.id,
            name: whatsapp.name,
            status: 'qrcode',
            qrcode: qr,
            isDefault: whatsapp.isDefault,
            tenantId: whatsapp.tenantId
          }
        });
        baseLogger.info(`QR Code generated for ${whatsapp.name} - notified frontend`);
        return;
      }
      
      if (connection === 'connecting') {
        baseLogger.info(`Session ${whatsapp.name} is connecting...`);
        await whatsapp.update({
          status: 'CONNECTING',
          qrcode: '',
        });
      }
      
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
        
        baseLogger.info(`Connection closed for ${whatsapp.name} (status code: ${statusCode}, error: ${errorMessage})`);
        
        // Clean up session first
        await removeBaileysSession(whatsapp.id);
        
        // Define when NOT to reconnect (fatal errors)
        const fatalErrors = [
          DisconnectReason.loggedOut,     // 401 - Need new QR code
          DisconnectReason.forbidden,     // 403 - Banned
          DisconnectReason.badSession,    // 400 - Session corrupted
          DisconnectReason.multideviceMismatch, // Device mismatch
        ];
        
        // Define temporary errors that should retry quickly
        const temporaryErrors = [
          515, // Stream error
          503, // Service unavailable  
          408, // Request timeout
          429, // Too many requests
        ];
        
        const shouldReconnect = !fatalErrors.includes(statusCode) && 
                               currentRetries < MAX_RECONNECT_ATTEMPTS;
        
        if (!shouldReconnect) {
          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            baseLogger.info(`Session ${whatsapp.name} logged out or auth failed - clearing session and requiring new QR`);
            
            // Clear the session directory to force new QR generation
            const sessionDir = join(__dirname, '..', '..', 'session', `session-${whatsapp.id}`);
            try {
              await rm(sessionDir, { recursive: true, force: true });
              baseLogger.info(`Cleared session directory for ${whatsapp.name}`);
            } catch (err) {
              baseLogger.warn(`Could not clear session directory: ${err}`);
            }
            
            await whatsapp.update({
              status: 'DISCONNECTED',
              qrcode: '',
              retries: 0
            });
          } else {
            baseLogger.error(`Fatal error for ${whatsapp.name} (${statusCode}), not reconnecting`);
            await whatsapp.update({
              status: 'DISCONNECTED',
              qrcode: '',
              retries: 0
            });
          }
          return;
        }
        
        // Calculate retry delay based on error type
        let retryDelay;
        const newRetries = currentRetries + 1;
        
        if (temporaryErrors.includes(statusCode)) {
          retryDelay = statusCode === 429 ? 30000 : 10000; // Rate limit vs other temp errors
          baseLogger.info(`Temporary error (${statusCode}) - short retry delay`);
        } else {
          // Exponential backoff for other errors
          retryDelay = Math.min(15000 * Math.pow(1.5, currentRetries), 120000); // Max 2 minutes
          baseLogger.info(`Using exponential backoff: ${retryDelay}ms`);
        }
        
        await whatsapp.update({
          status: 'DISCONNECTED',
          qrcode: '',
          retries: newRetries
        });
        
        baseLogger.info(`Scheduling reconnection attempt ${newRetries}/${MAX_RECONNECT_ATTEMPTS} in ${retryDelay}ms`);
        
        const timeout = setTimeout(async () => {
          try {
            reconnectionTimeouts.delete(whatsapp.id);
            
            // Double-check we're not already initializing
            if (initializingSession.has(whatsapp.id)) {
              baseLogger.info(`Session ${whatsapp.name} already initializing, skipping`);
              return;
            }
            
            baseLogger.info(`Reconnection attempt ${newRetries} for ${whatsapp.name}`);
            
            // Refresh whatsapp data before reconnecting
            await whatsapp.reload();
            const newSession = await initBaileys(whatsapp);
            sessions.push(newSession);
            
          } catch (err) {
            baseLogger.error(`Reconnection attempt ${newRetries} failed: ${err}`);
            
            if (newRetries >= MAX_RECONNECT_ATTEMPTS) {
              baseLogger.error(`All reconnection attempts exhausted for ${whatsapp.name}`);
              await whatsapp.update({
                status: 'DISCONNECTED',
                qrcode: '',
                retries: 0
              });
            }
          }
        }, retryDelay);
        
        reconnectionTimeouts.set(whatsapp.id, timeout);
      }

      if (connection === 'open') {
        baseLogger.info(`Session ${whatsapp.name} connected successfully!`);
        await whatsapp.update({
          status: 'CONNECTED',
          qrcode: '',
          retries: 0
        });
        
        // Configurar handlers de mensagem após conexão bem-sucedida
        try {
          const { setupAdditionalHandlers } = require('../services/WbotServices/StartWhatsAppSession');
          setupAdditionalHandlers(wbot, whatsapp);
          baseLogger.info(`Message handlers configured for ${whatsapp.name}`);
        } catch (err) {
          baseLogger.error(`Error setting up message handlers: ${err}`);
        }
        
        // Emitir evento para o frontend quando conectado com sucesso
        const io = require('../libs/socket').getIO();
        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: {
            id: whatsapp.id,
            name: whatsapp.name,
            status: 'CONNECTED',
            qrcode: '',
            isDefault: whatsapp.isDefault,
            tenantId: whatsapp.tenantId
          }
        });
        
        clearReconnectionTimeout(whatsapp.id);
        resetWsUndefinedChecks(whatsapp.id);
      }
    });

    // Add session to active sessions list
    sessions.push(wbot);
    baseLogger.info(`WhatsApp session initialized for ${whatsapp.name}`);
    
    // Remove from initializing set after successful initialization
    initializingSession.delete(whatsapp.id);

    // Se phoneNumber estiver presente, implemente o fluxo de pairing code
    if (phoneNumber) {
      baseLogger.info(`Iniciando autenticação via número: ${phoneNumber}`);
      
      // Aguardar a conexão estar pronta antes de tentar o pairing
      const waitForConnection = async () => {
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
            baseLogger.debug(`Tentativa ${attempts + 1} de aguardar conexão para pairing...`);
            
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Timeout aguardando conexão'));
              }, 30000);

              const checkConnection = () => {
                if ((wbot as any).connection === 'open' && (wbot as any).ws) {
                  clearTimeout(timeout);
                  resolve();
                } else if ((wbot as any).connection === 'close') {
                  clearTimeout(timeout);
                  reject(new Error('Conexão fechada antes do pairing'));
                } else {
                  setTimeout(checkConnection, 1000);
                }
              };

              checkConnection();
            });
            
            // Se chegou aqui, a conexão está pronta
            baseLogger.debug(`Conexão pronta para pairing na tentativa ${attempts + 1}`);
            return;
            
          } catch (err) {
            attempts++;
            baseLogger.warn(`Falha na tentativa ${attempts} de aguardar conexão: ${err.message}`);
            
            if (attempts < maxAttempts) {
              baseLogger.info(`Tentando reconectar antes da próxima tentativa...`);
              try {
                await safeReconnect(wbot, whatsapp);
                // Aguardar um momento após a reconexão
                await new Promise(resolve => setTimeout(resolve, 2000));
              } catch (reconnectErr) {
                baseLogger.error(`Erro ao reconectar: ${reconnectErr}`);
              }
            }
          }
        }
        
        throw new Error(`Falha em todas as ${maxAttempts} tentativas de estabelecer conexão`);
      };

      try {
        await waitForConnection();
        baseLogger.debug(`Conexão estabelecida com sucesso para pairing`);
        
        // Pequeno delay para garantir estabilidade
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        baseLogger.debug(`Estado da conexão antes do pairing: ${(wbot as any).connection}`);
        baseLogger.debug(`WebSocket status antes do pairing: ${(wbot as any).ws ? 'disponível' : 'indisponível'}`);
        
        if (typeof wbot.requestPairingCode === 'function') {
          try {
            baseLogger.debug(`Iniciando requestPairingCode para ${whatsapp.name}`);
            baseLogger.debug(`Tentando gerar pairing code para número: ${phoneNumber}`);
            
            const { pairingCode } = await wbot.requestPairingCode(phoneNumber);
            
            baseLogger.info(`Pairing code gerado com sucesso para ${whatsapp.name}: ${pairingCode}`);
            baseLogger.debug(`Estado da conexão após gerar pairing code: ${(wbot as any).connection}`);
            baseLogger.debug(`WebSocket status após gerar pairing code: ${(wbot as any).ws ? 'disponível' : 'indisponível'}`);
            
            // Emitir o pairing code para o frontend via websocket
            const io = require('../libs/socket').getIO();
            io.emit(`${whatsapp.tenantId}:pairingCode`, {
              whatsappId: whatsapp.id,
              pairingCode
            });
            
            baseLogger.debug(`Pairing code enviado para o frontend via WebSocket`);
          } catch (err) {
            baseLogger.error(`Erro detalhado ao gerar pairing code para ${whatsapp.name}:`, {
              error: err,
              errorMessage: err.message,
              errorStack: err.stack,
              connectionState: (wbot as any).connection,
              wsStatus: (wbot as any).ws ? 'disponível' : 'indisponível',
              phoneNumber: phoneNumber
            });
            
            // Verificar se o erro é específico de conexão
            if (err.message.includes('Connection')) {
              baseLogger.error(`Erro de conexão durante pairing: ${err.message}`);
              baseLogger.debug(`Estado da conexão no momento do erro: ${(wbot as any).connection}`);
              baseLogger.debug(`WebSocket status no momento do erro: ${(wbot as any).ws ? 'disponível' : 'indisponível'}`);
            }
            
            // Verificar se o erro é específico de autenticação
            if (err.message.includes('auth') || err.message.includes('401')) {
              baseLogger.error(`Erro de autenticação durante pairing: ${err.message}`);
            }
          }
        } else {
          baseLogger.error('requestPairingCode não está disponível nesta versão do Baileys.', {
            baileysVersion: require('@whiskeysockets/baileys/package.json').version,
            whatsappName: whatsapp.name,
            connectionState: (wbot as any).connection
          });
        }
      } catch (err) {
        baseLogger.error(`Erro ao aguardar conexão para pairing: ${err.message}`);
        throw err;
      }
    }

    return wbot;
  } catch (err) {
    baseLogger.error(`Error initializing Baileys for ${whatsapp.name}: ${err}`);
    
    // Clean up on error
    await removeBaileysSession(whatsapp.id);
    initializingSession.delete(whatsapp.id);
    
    await whatsapp.update({
      status: 'DISCONNECTED',
      qrcode: '',
      retries: (whatsapp.retries || 0) + 1
    });
    throw err;
  }
};

// Utility function to get all active sessions
export const getAllSessions = (): BaileysClient[] => {
  return sessions.filter(session => {
    const connectionState = (session as any)?.connection;
    return connectionState === 'open' || connectionState === 'connecting';
  });
};

// Utility function to get session count
export const getSessionCount = (): number => {
  return sessions.length;
};

// Utility function to check if session exists and is connected
export const isSessionConnected = (whatsappId: number): boolean => {
  const session = getBaileysSession(whatsappId);
  return session ? (session as any)?.connection === 'open' : false;
};

export { sessions };