import { makeWASocket, useMultiFileAuthState, DisconnectReason, BaileysEventMap } from "@whiskeysockets/baileys";
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

// Function to clear reconnection timeout
const clearReconnectionTimeout = (whatsappId: number): void => {
  const timeout = reconnectionTimeouts.get(whatsappId);
  if (timeout) {
    clearTimeout(timeout);
    reconnectionTimeouts.delete(whatsappId);
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
        
        // These might not exist in all Baileys versions, so wrap in try-catch
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
        } else if ((session as any).ws) {
          (session as any).ws.close();
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

// Enhanced session getter with better state checking
export const getBaileysSession = (whatsappId: number): BaileysClient | undefined => {
  const session = sessions.find(s => s.id === whatsappId);
  if (!session) return undefined;
  
  const wsState = (session as any)?.ws?.readyState;
  const connectionState = (session as any)?.connection;
  
  // Log current state for debugging
  baseLogger.debug(`Session ${whatsappId} state - connection: ${connectionState}, ws: ${wsState}`);
  
  // Session is usable if:
  // 1. Connection is open
  // 2. Connection is connecting and WebSocket is open or connecting
  // 3. We're in a reconnection attempt
  const isUsable = (
    connectionState === 'open' ||
    (connectionState === 'connecting' && (wsState === 0 || wsState === 1)) ||
    reconnectionTimeouts.has(whatsappId)
  );
  
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

export const initBaileys = async (whatsapp: Whatsapp): Promise<BaileysClient> => {
  try {
    // Prevent multiple simultaneous initializations for the same session
    if (initializingSession.has(whatsapp.id)) {
      baseLogger.info(`Session ${whatsapp.name} is already being initialized, skipping`);
      throw new Error('Session already being initialized');
    }
    
    initializingSession.add(whatsapp.id);
    
    baseLogger.info(`Initializing WhatsApp session for ${whatsapp.name} (ID: ${whatsapp.id})`);
    
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
    const existingSession = getBaileysSession(whatsapp.id);
    if (existingSession) {
      baseLogger.info(`Session ${whatsapp.name} already exists and is active`);
      initializingSession.delete(whatsapp.id);
      return existingSession;
    }

    // Remove any existing session first
    await removeBaileysSession(whatsapp.id);
    
    // Clear any pending reconnection timeouts
    clearReconnectionTimeout(whatsapp.id);
    
    const sessionDir = join(__dirname, '..', '..', 'session', `session-${whatsapp.id}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    baseLogger.info(`Created new auth state for session`);

    const wbot = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["Chrome (Linux)", "Chrome", "1.0.0"],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: false,
      retryRequestDelayMs: 5000,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      keepAliveIntervalMs: 15000,
      qrTimeout: 60000,
      getMessage: async () => undefined,
      shouldIgnoreJid: () => false,
      linkPreviewImageThumbnailWidth: 0,
      transactionOpts: {
        maxCommitRetries: 5,
        delayBetweenTriesMs: 3000
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
      }
    }) as BaileysClient;

    // Adiciona handler de erro do WebSocket
    if ((wbot as any).ws) {
      const ws = (wbot as any).ws;
      
      ws.on('error', (err: Error) => {
        baseLogger.error(`WebSocket error for ${whatsapp.name}: ${err.message}`);
        // Não desconecta aqui, deixa o handler de connection.update lidar com isso
      });

      ws.on('close', (code: number, reason: string) => {
        baseLogger.info(`WebSocket closed for ${whatsapp.name} (code: ${code}, reason: ${reason})`);
        // Não desconecta aqui, deixa o handler de connection.update lidar com isso
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

    // Fixed connection handler
    wbot.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Update connection state
      (wbot as any).connection = connection;
      
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
        
        clearReconnectionTimeout(whatsapp.id);
      }
    });

    // Add session to active sessions list
    sessions.push(wbot);
    baseLogger.info(`WhatsApp session initialized for ${whatsapp.name}`);
    
    // Remove from initializing set after successful initialization
    initializingSession.delete(whatsapp.id);

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