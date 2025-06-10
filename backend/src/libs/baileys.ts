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

// Function to remove a session
export const removeBaileysSession = async (whatsappId: number): Promise<void> => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
  if (sessionIndex !== -1) {
    const session = sessions[sessionIndex];
    try {
      baseLogger.info(`Cleaning up session for WhatsApp ID: ${whatsappId}`);
      
      // Clear any pending reconnection timeouts
      clearReconnectionTimeout(whatsappId);
      
      // Remove all event listeners
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
      session.ev.removeAllListeners('labels.edit');
      session.ev.removeAllListeners('labels.association');
      
      // Try to close connection gracefully
      try {
        if ((session as any).ws && (session as any).ws.readyState === 1) {
          await session.logout();
          baseLogger.info(`Successfully logged out session ${whatsappId}`);
        }
      } catch (err) {
        baseLogger.warn(`Error during logout, continuing cleanup: ${err}`);
      }
      
      // Remove from sessions array
      sessions.splice(sessionIndex, 1);
      baseLogger.info(`Session removed from active sessions array`);
      
    } catch (err) {
      baseLogger.error(`Error cleaning up session: ${err}`);
    }
  }
};

// Function to get a session
export const getBaileysSession = (whatsappId: number): BaileysClient | undefined => {
  const session = sessions.find(s => s.id === whatsappId);
  if (session) {
    // Check if session is still active
    const wsState = (session as any)?.ws?.readyState;
    const connectionState = (session as any)?.connection;
    
    // Consider session active if:
    // 1. Connection is 'open', 'connecting', or undefined (initial state)
    // 2. WebSocket is in OPEN (1), CONNECTING (0), or undefined (initial state)
    // 3. Or if we're in a reconnection attempt (has reconnection timeout)
    if ((connectionState === 'open' || connectionState === 'connecting' || connectionState === undefined) && 
        (wsState === 1 || wsState === 0 || wsState === undefined) ||
        reconnectionTimeouts.has(whatsappId)) {
      return session;
    } else {
      // Only log the state, don't remove the session
      baseLogger.info(`Session ${whatsappId} is in state (connection: ${connectionState}, ws: ${wsState})`);
      return session;
    }
  }
  return undefined;
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
    
    const sessionDir = join(__dirname, '..', '..', '..', `session-${whatsapp.id}`);
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
      keepAliveIntervalMs: 60000,
      qrTimeout: 60000,
      getMessage: async () => undefined,
      shouldIgnoreJid: () => false,
      linkPreviewImageThumbnailWidth: 0,
      transactionOpts: {
        maxCommitRetries: 1,
        delayBetweenTriesMs: 3000
      }
    }) as BaileysClient;

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

    // Set up connection handler
    wbot.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Update connection state
      (wbot as any).connection = connection;
      
      if (qr) {
        baseLogger.info(`QR Code received for ${whatsapp.name}`);
        baseLogger.info(`QR Code generated for ${whatsapp.name}`);
        await whatsapp.update({ 
          status: 'qrcode',
          qrcode: qr,
          retries: 0
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
        
        // Don't treat temporary disconnections as fatal
        const isTemporaryDisconnect = statusCode === 515 || // Stream error (expected after pairing)
                                     statusCode === 401 || // Unauthorized (can be temporary)
                                     statusCode === 503;   // Service unavailable
        
        const shouldReconnect = (statusCode !== DisconnectReason.loggedOut && 
                                statusCode !== DisconnectReason.forbidden &&
                                currentRetries < MAX_RECONNECT_ATTEMPTS) ||
                               isTemporaryDisconnect;
        
        baseLogger.info(`Connection closed for ${whatsapp.name} (status code: ${statusCode}, error: ${errorMessage}), should reconnect: ${shouldReconnect}`);
        
        // Only remove session if we're not going to reconnect
        if (!shouldReconnect) {
          await removeBaileysSession(whatsapp.id);
        }
        
        if (shouldReconnect) {
          const newRetries = isTemporaryDisconnect ? currentRetries : currentRetries + 1;
          await whatsapp.update({
            status: 'DISCONNECTED',
            qrcode: '',
            retries: newRetries
          });
          
          // For temporary disconnections, use shorter delays
          let retryDelay;
          if (isTemporaryDisconnect) {
            retryDelay = 5000; // 5 seconds for temporary disconnections
            baseLogger.info(`Temporary disconnect (${statusCode}) detected - using short retry delay`);
          } else if (statusCode === 440) {
            retryDelay = 15000; // Conflict error - wait longer
            baseLogger.warn(`Conflict error (440) detected - waiting longer to avoid race conditions`);
          } else {
            retryDelay = Math.min(5000 * Math.pow(2, currentRetries), 30000);
          }
          
          baseLogger.info(`Scheduling reconnection attempt ${newRetries}/${MAX_RECONNECT_ATTEMPTS} in ${retryDelay}ms`);
          
          const timeout = setTimeout(async () => {
            try {
              reconnectionTimeouts.delete(whatsapp.id);
              
              // Check if session is not already being initialized
              if (initializingSession.has(whatsapp.id)) {
                baseLogger.info(`Session ${whatsapp.name} is already being initialized, skipping reconnection`);
                return;
              }
              
              baseLogger.info(`Attempting to reconnect session for ${whatsapp.name} (attempt ${newRetries})`);
              const newSession = await initBaileys(whatsapp);
              sessions.push(newSession);
            } catch (err) {
              baseLogger.error(`Error during reconnection attempt ${newRetries}: ${err}`);
              
              if (newRetries >= MAX_RECONNECT_ATTEMPTS) {
                baseLogger.error(`All reconnection attempts failed for ${whatsapp.name}`);
                await whatsapp.update({
                  status: 'DISCONNECTED',
                  qrcode: '',
                  retries: 0
                });
              }
            }
          }, retryDelay);
          
          reconnectionTimeouts.set(whatsapp.id, timeout);
        } else {
          // Don't reconnect - reset retries and set as disconnected
          await whatsapp.update({
            status: 'DISCONNECTED',
            qrcode: '',
            retries: 0
          });
          baseLogger.info(`Session ${whatsapp.name} will not reconnect (reason: ${statusCode})`);
        }
      }

      if (connection === 'open') {
        baseLogger.info(`Session ${whatsapp.name} connected successfully`);
        await whatsapp.update({
          status: 'CONNECTED',
          qrcode: '',
          retries: 0
        });
        
        // Clear any pending reconnection timeouts since we're now connected
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

export { sessions };