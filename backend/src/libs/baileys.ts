import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  proto
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { join } from "path";
import { rm } from "fs/promises";
import pino from "pino";
import { logger as baseLogger } from "../utils/logger";
import { BaileysClient } from "../types/baileys";
import Whatsapp from "../models/Whatsapp";

// Dynamic imports for circular dependency resolution
let socketIO: any;
let setupAdditionalHandlers: any;

// Lazy load modules to avoid circular dependencies
const getSocketIO = async () => {
  if (!socketIO) {
    const socketModule = await import("./socket");
    socketIO = socketModule.getIO();
  }
  return socketIO;
};

const getSetupAdditionalHandlers = async () => {
  if (!setupAdditionalHandlers) {
    const module = await import("../services/WbotServices/StartWhatsAppSession");
    setupAdditionalHandlers = module.setupAdditionalHandlers;
  }
  return setupAdditionalHandlers;
};

const getBaileysVersion = async () => {
  try {
    const packageJson = require("@whiskeysockets/baileys/package.json");
    return packageJson.version;
  } catch (err) {
    return "unknown";
  }
};

// Array to store active sessions
const sessions: BaileysClient[] = [];

// Maximum number of reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 3;

// Track sessions being initialized to prevent duplicates
const initializingSession = new Set<number>();

// Sistema de throttling para evitar sobrecarga
const messageQueue = new Map<number, proto.IWebMessageInfo[]>();
const processingLock = new Set<number>();
const MAX_QUEUE_SIZE = 50;
const PROCESSING_DELAY = 100; // 100ms entre processamentos

const processMessageQueue = async (whatsappId: number): Promise<void> => {
  if (processingLock.has(whatsappId)) {
    return; // Já está processando
  }

  const queue = messageQueue.get(whatsappId);
  if (!queue || queue.length === 0) {
    return;
  }

  processingLock.add(whatsappId);

  try {
    // Processar mensagens em lotes pequenos
    const batchSize = 5;
    const batch = queue.splice(0, batchSize);

    for (const msg of batch) {
      try {
        const { default: HandleBaileysMessage } = await import("../services/BaileysServices/HandleBaileysMessage");
        const session = getBaileysSession(whatsappId);
        
        if (session) {
          await HandleBaileysMessage(msg, session);
        }
        
        // Pequeno delay entre mensagens
        await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAY));
      } catch (msgErr) {
        baseLogger.error(`[processMessageQueue] Error processing message: ${msgErr}`);
      }
    }

    // Se ainda há mensagens na fila, continuar processamento
    if (queue.length > 0) {
      setImmediate(() => processMessageQueue(whatsappId));
    }
  } catch (err) {
    baseLogger.error(`[processMessageQueue] Error in queue processing: ${err}`);
  } finally {
    processingLock.delete(whatsappId);
  }
};

const addToMessageQueue = (whatsappId: number, msg: proto.IWebMessageInfo): void => {
  if (!messageQueue.has(whatsappId)) {
    messageQueue.set(whatsappId, []);
  }

  const queue = messageQueue.get(whatsappId)!;
  
  // Limitar tamanho da fila
  if (queue.length >= MAX_QUEUE_SIZE) {
    baseLogger.warn(`[addToMessageQueue] Queue full for session ${whatsappId}, dropping oldest message`);
    queue.shift(); // Remove a mensagem mais antiga
  }

  queue.push(msg);
  
  // Iniciar processamento se não estiver em execução
  setImmediate(() => processMessageQueue(whatsappId));
};

// Enhanced session removal with better cleanup
export const removeBaileysSession = async (
  whatsappId: number
): Promise<void> => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
  if (sessionIndex !== -1) {
    const session = sessions[sessionIndex];
    try {
      baseLogger.info(`Cleaning up session for WhatsApp ID: ${whatsappId}`);

      // Remove from initializing set if present
      initializingSession.delete(whatsappId);

      // Remove all event listeners to prevent memory leaks
      try {
        session.ev.removeAllListeners("connection.update");
        session.ev.removeAllListeners("creds.update");
        session.ev.removeAllListeners("messages.upsert");
        session.ev.removeAllListeners("messages.update");
        session.ev.removeAllListeners("message-receipt.update");
        session.ev.removeAllListeners("presence.update");
        session.ev.removeAllListeners("contacts.update");
        session.ev.removeAllListeners("chats.update");
        session.ev.removeAllListeners("groups.update");
        session.ev.removeAllListeners("group-participants.update");
        session.ev.removeAllListeners("blocklist.set");
        session.ev.removeAllListeners("blocklist.update");
        session.ev.removeAllListeners("call");

        try {
          session.ev.removeAllListeners("labels.edit" as any);
          session.ev.removeAllListeners("labels.association" as any);
        } catch (labelErr) {
          // Ignore if these events don't exist
        }
      } catch (eventErr) {
        baseLogger.warn(`Error removing event listeners: ${eventErr}`);
      }

      // Close connection gracefully
      try {
        const wsState = (session as any)?.ws?.readyState;
        if (wsState === 1) {
          // WebSocket.OPEN
          await session.logout();
          baseLogger.info(`Successfully logged out session ${whatsappId}`);
        }
      } catch (err) {
        baseLogger.warn(`Error during logout: ${err}`);
      }

      // Remove from sessions array
      sessions.splice(sessionIndex, 1);
      baseLogger.info(`Session ${whatsappId} removed from active sessions`);

    } catch (err) {
      baseLogger.error(`Error cleaning up session ${whatsappId}: ${err}`);
    }
  }
};

// Simple session getter
export const getBaileysSession = (
  whatsappId: number
): BaileysClient | undefined => {
  const session = sessions.find(s => s.id === whatsappId);
  if (!session) return undefined;

  const connectionState = (session as any)?.connection;
  
  // Session é usável se estiver open ou connecting
  const isUsable = connectionState === "open" || connectionState === "connecting";

  if (!isUsable) {
    baseLogger.warn(
      `Session ${whatsappId} is not usable - connection: ${connectionState}`
    );
    return undefined;
  }

  return session;
};

// Main function to initialize Baileys
export async function initBaileys(
  whatsapp: Whatsapp,
  phoneNumber?: string
): Promise<BaileysClient> {
  try {
    // Prevent multiple simultaneous initializations for the same session
    if (initializingSession.has(whatsapp.id)) {
      baseLogger.info(
        `Session ${whatsapp.name} is already being initialized, skipping`
      );
      throw new Error("Session already being initialized");
    }

    initializingSession.add(whatsapp.id);

    baseLogger.info(
      `Initializing WhatsApp session for ${whatsapp.name} (ID: ${whatsapp.id})`
    );

    // Se estiver tentando conectar por número, limpar completamente a sessão primeiro
    if (phoneNumber) {
      baseLogger.info("Phone number mode detected - clearing session completely");

      // Remove existing session if any
      const existingSession = sessions.find(s => s.id === whatsapp.id);
      if (existingSession) {
        baseLogger.info("Removing existing session before starting phone number mode");
        await removeBaileysSession(whatsapp.id);
      }

      // Clear session directory
      const sessionDir = join(
        __dirname,
        "..",
        "..",
        "session",
        `session-${whatsapp.id}`
      );
      try {
        await rm(sessionDir, { recursive: true, force: true });
        baseLogger.info(`Session directory cleared for ${whatsapp.name}`);
      } catch (err) {
        baseLogger.warn(`Error clearing session directory: ${err}`);
      }

      // Update status in database
      await whatsapp.update({
        status: "CONNECTING",
        qrcode: "",
        retries: 0
      });

      // Small delay to ensure everything is cleaned
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check if we've exceeded max reconnection attempts
    const currentRetries = whatsapp.retries || 0;
    if (currentRetries >= MAX_RECONNECT_ATTEMPTS) {
      baseLogger.error(
        `Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${whatsapp.name}`
      );
      await whatsapp.update({
        status: "DISCONNECTED",
        qrcode: "",
        retries: 0
      });
      throw new Error("Maximum reconnection attempts reached");
    }

    // Check if there's already an active session
    const existingSession = sessions.find(s => s.id === whatsapp.id);
    if (existingSession) {
      baseLogger.info(
        `Session ${whatsapp.name} already exists, cleaning up first`
      );
      await removeBaileysSession(whatsapp.id);
      // Pequeno delay após limpeza para estabilidade
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const sessionDir = join(
      __dirname,
      "..",
      "..",
      "session",
      `session-${whatsapp.id}`
    );
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    baseLogger.info("Created new auth state for session");

    const wbot = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS("Chrome"),
      connectTimeoutMs: phoneNumber ? 90000 : 30000, // Reduzido para acelerar
      defaultQueryTimeoutMs: 30000, // Reduzido de 60s para 30s
      emitOwnEvents: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: false,
      retryRequestDelayMs: phoneNumber ? 8000 : 3000, // Reduzido
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      keepAliveIntervalMs: 15000,
      qrTimeout: phoneNumber ? 0 : 45000, // Reduzido de 60s para 45s
      getMessage: async () => undefined,
      shouldIgnoreJid: (jid) => {
        return !!(jid && typeof jid === 'string' && jid.includes('@broadcast'));
      },
      linkPreviewImageThumbnailWidth: 0,
      fireInitQueries: true,
      transactionOpts: {
        maxCommitRetries: phoneNumber ? 10 : 5,
        delayBetweenTriesMs: phoneNumber ? 5000 : 3000
      },
      patchMessageBeforeSending: message => {
        const requiresPatch = !!(
          message.buttonsMessage ||
          message.templateMessage ||
          message.listMessage
        );
        if (requiresPatch) {
          message = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {}
                },
                ...message
              }
            }
          };
        }
        return message;
      },
      logger: pino({ level: "error" })
    }) as BaileysClient;

    // Add necessary properties
    (wbot as any).id = whatsapp.id;
    (wbot as any).connection = "connecting";

    // Set up credentials handler
    wbot.ev.on("creds.update", async () => {
      try {
        await saveCreds();
        baseLogger.info(`Credentials updated for session ${whatsapp.id}`);
        await whatsapp.update({ retries: 0 });
      } catch (err) {
        baseLogger.error(`Error saving credentials: ${err}`);
      }
    });

    // Connection update handler - simplified to use native reconnection
    wbot.ev.on("connection.update", async update => {
      const { connection, lastDisconnect, qr } = update;

      // Update connection state
      (wbot as any).connection = connection;

      // Ignore QR codes if using phone number
      if (phoneNumber && qr) {
        baseLogger.debug("QR code received during phone number mode - ignoring");
        return;
      }

      if (qr) {
        baseLogger.info(`QR Code received for ${whatsapp.name}`);
        await whatsapp.update({
          status: "qrcode",
          qrcode: qr,
          retries: 0
        });
        
        // Emit event to frontend with new QR code
        const io = await getSocketIO();
        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: {
            id: whatsapp.id,
            name: whatsapp.name,
            status: "qrcode",
            qrcode: qr,
            isDefault: whatsapp.isDefault,
            tenantId: whatsapp.tenantId
          }
        });
        baseLogger.info(`QR Code generated for ${whatsapp.name} - notified frontend`);
        return;
      }

      if (connection === "connecting") {
        baseLogger.info(`Session ${whatsapp.name} is connecting...`);
        await whatsapp.update({
          status: "CONNECTING",
          qrcode: ""
        });
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || "Unknown error";

        baseLogger.info(
          `Connection closed for ${whatsapp.name} (status code: ${statusCode}, error: ${errorMessage})`
        );

        // Clean up session first
        await removeBaileysSession(whatsapp.id);

        // Define when NOT to reconnect (fatal errors)
        const fatalErrors = [
          DisconnectReason.loggedOut,
          DisconnectReason.forbidden,
          DisconnectReason.badSession,
          DisconnectReason.multideviceMismatch
        ];

        const shouldReconnect = 
          !fatalErrors.includes(statusCode) && 
          currentRetries < MAX_RECONNECT_ATTEMPTS;

        if (!shouldReconnect) {
          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            baseLogger.info(
              `Session ${whatsapp.name} logged out - clearing session and requiring new QR`
            );

            // Clear the session directory to force new QR generation
            const sessionDir = join(
              __dirname,
              "..",
              "..",
              "session",
              `session-${whatsapp.id}`
            );
            try {
              await rm(sessionDir, { recursive: true, force: true });
              baseLogger.info(`Cleared session directory for ${whatsapp.name}`);
            } catch (err) {
              baseLogger.warn(`Could not clear session directory: ${err}`);
            }
          }

          await whatsapp.update({
            status: "DISCONNECTED",
            qrcode: "",
            retries: 0
          });
          return;
        }

        // Simple reconnection with delay
        const newRetries = currentRetries + 1;
        const retryDelay = Math.min(5000 * newRetries, 30000); // Max 30 seconds

        await whatsapp.update({
          status: "DISCONNECTED",
          qrcode: "",
          retries: newRetries
        });

        baseLogger.info(
          `Scheduling reconnection attempt ${newRetries}/${MAX_RECONNECT_ATTEMPTS} in ${retryDelay}ms`
        );

        setTimeout(async () => {
          try {
            // Double-check we're not already initializing
            if (initializingSession.has(whatsapp.id)) {
              baseLogger.info(
                `Session ${whatsapp.name} already initializing, skipping`
              );
              return;
            }

            baseLogger.info(`Reconnection attempt ${newRetries} for ${whatsapp.name}`);

            // Refresh whatsapp data before reconnecting
            await whatsapp.reload();
            const newSession = await initBaileys(whatsapp, phoneNumber);
            sessions.push(newSession);
          } catch (err) {
            baseLogger.error(`Reconnection attempt ${newRetries} failed: ${err}`);

            if (newRetries >= MAX_RECONNECT_ATTEMPTS) {
              baseLogger.error(`All reconnection attempts exhausted for ${whatsapp.name}`);
              await whatsapp.update({
                status: "DISCONNECTED",
                qrcode: "",
                retries: 0
              });
            }
          }
        }, retryDelay);
      }

      if (connection === "open") {
        baseLogger.info(`Session ${whatsapp.name} connected successfully!`);
        await whatsapp.update({
          status: "CONNECTED",
          qrcode: "",
          retries: 0
        });

        // Setup message handlers after successful connection
        try {
          const setupHandlers = await getSetupAdditionalHandlers();
          setupHandlers(wbot, whatsapp);
          baseLogger.info(`Message handlers configured for ${whatsapp.name}`);
        } catch (err) {
          baseLogger.error(`Error setting up message handlers: ${err}`);
        }

        // Emit event to frontend when successfully connected
        const io = await getSocketIO();
        io.emit(`${whatsapp.tenantId}:whatsappSession`, {
          action: "update",
          session: {
            id: whatsapp.id,
            name: whatsapp.name,
            status: "CONNECTED",
            qrcode: "",
            isDefault: whatsapp.isDefault,
            tenantId: whatsapp.tenantId
          }
        });
      }
    });

    // Add session to active sessions list
    sessions.push(wbot);
    baseLogger.info(`WhatsApp session initialized for ${whatsapp.name}`);

    // Remove from initializing set after successful initialization
    initializingSession.delete(whatsapp.id);

    // Implement pairing code flow if phoneNumber is present
    if (phoneNumber) {
      baseLogger.info(`Starting authentication via number: ${phoneNumber}`);

      // Wait for connection to be ready before attempting pairing
      const waitForConnection = async () => {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            baseLogger.debug(`Attempt ${attempts + 1} to wait for connection for pairing...`);

            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error("Timeout waiting for connection"));
              }, 30000);

              const checkConnection = () => {
                if ((wbot as any).connection === "open" && (wbot as any).ws) {
                  clearTimeout(timeout);
                  resolve();
                } else if ((wbot as any).connection === "close") {
                  clearTimeout(timeout);
                  reject(new Error("Connection closed before pairing"));
                } else {
                  setTimeout(checkConnection, 1000);
                }
              };

              checkConnection();
            });

            baseLogger.debug(`Connection ready for pairing on attempt ${attempts + 1}`);
            return;
          } catch (err: any) {
            attempts++;
            baseLogger.warn(`Failed attempt ${attempts} to wait for connection: ${err.message}`);

            if (attempts < maxAttempts) {
              baseLogger.info("Waiting before next attempt...");
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
        }

        throw new Error(`Failed all ${maxAttempts} attempts to establish connection`);
      };

      try {
        await waitForConnection();
        baseLogger.debug("Connection established successfully for pairing");

        // Small delay to ensure stability
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (typeof wbot.requestPairingCode === "function") {
          try {
            baseLogger.debug(`Starting requestPairingCode for ${whatsapp.name}`);
            const pairingCode = await wbot.requestPairingCode(phoneNumber);

            baseLogger.info(`Pairing code generated successfully for ${whatsapp.name}: ${pairingCode}`);

            // Emit pairing code to frontend via websocket
            const io = await getSocketIO();
            io.emit(`${whatsapp.tenantId}:pairingCode`, {
              whatsappId: whatsapp.id,
              pairingCode
            });

            baseLogger.debug("Pairing code sent to frontend via WebSocket");
          } catch (err: any) {
            baseLogger.error(`Error generating pairing code for ${whatsapp.name}: ${err.message}`);
          }
        } else {
          baseLogger.error(
            "requestPairingCode not available in this Baileys version.",
            {
              baileysVersion: await getBaileysVersion(),
              whatsappName: whatsapp.name
            }
          );
        }
      } catch (err: any) {
        baseLogger.error(`Error waiting for connection for pairing: ${err.message}`);
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
      status: "DISCONNECTED",
      qrcode: "",
      retries: (whatsapp.retries || 0) + 1
    });
    throw err;
  }
}

// Function to force session restart
export const restartBaileysSession = async (
  whatsappId: number
): Promise<BaileysClient | null> => {
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
    const sessionDir = join(
      __dirname,
      "..",
      "..",
      "session",
      `session-${whatsappId}`
    );
    try {
      await rm(sessionDir, { recursive: true, force: true });
      baseLogger.info("Cleared session directory for fresh start");
    } catch (err) {
      baseLogger.warn(`Could not clear session directory: ${err}`);
    }

    // Reset database status
    await whatsapp.update({
      status: "DISCONNECTED",
      qrcode: "",
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

// Utility functions
export const getAllSessions = (): BaileysClient[] => {
  return sessions.filter(session => {
    const connectionState = (session as any)?.connection;
    return connectionState === "open" || connectionState === "connecting";
  });
};

export const getSessionCount = (): number => {
  return sessions.length;
};

export const isSessionConnected = (whatsappId: number): boolean => {
  const session = getBaileysSession(whatsappId);
  return session ? (session as any)?.connection === "open" : false;
};

export { sessions };
