import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  proto
} from "baileys";
import { Boom } from "@hapi/boom";
import { join } from "path";
import { rm } from "fs/promises";
import pino from "pino";
import { logger as baseLogger } from "../utils/logger";
import { BaileysClient } from "../types/baileys";
import Whatsapp from "../models/Whatsapp";

// Store personalizado para contatos
interface ContactInfo {
  id: string;
  name?: string;
  pushname?: string;
  notify?: string;
  number: string; // CORREÇÃO: Adicionar number como obrigatório
  isGroup: boolean;
  lastSeen?: number;
}

const contactStores = new Map<number, Map<string, ContactInfo>>();

// Função para obter ou criar store de contatos para uma sessão
const getContactStore = (sessionId: number): Map<string, ContactInfo> => {
  if (!contactStores.has(sessionId)) {
    contactStores.set(sessionId, new Map());
  }
  return contactStores.get(sessionId)!;
};

// Função para limpar store de contatos
const clearContactStore = (sessionId: number): void => {
  contactStores.delete(sessionId);
};

// Dynamic imports for circular dependency resolution
let socketIO: any;
let setupAdditionalHandlers: any;

// Cache para evitar múltiplas importações
const moduleCache = new Map<string, any>();

// Lazy load modules to avoid circular dependencies
const getSocketIO = async () => {
  if (!socketIO) {
    if (moduleCache.has('socket')) {
      socketIO = moduleCache.get('socket');
    } else {
      const socketModule = await import("./socket");
      socketIO = socketModule.getIO();
      moduleCache.set('socket', socketIO);
    }
  }
  return socketIO;
};

const getSetupAdditionalHandlers = async () => {
  if (!setupAdditionalHandlers) {
    if (moduleCache.has('handlers')) {
      setupAdditionalHandlers = moduleCache.get('handlers');
    } else {
      const module = await import("../services/WbotServices/StartWhatsAppSession");
      setupAdditionalHandlers = module.setupAdditionalHandlers;
      moduleCache.set('handlers', setupAdditionalHandlers);
    }
  }
  return setupAdditionalHandlers;
};

// Cache para versão do Baileys
let baileysVersion = "unknown";

const getBaileysVersion = async (): Promise<string> => {
  if (baileysVersion !== "unknown") {
    return baileysVersion;
  }
  
  try {
    const packageJson = require("baileys/package.json");
    baileysVersion = String(packageJson.version || "unknown");
    return baileysVersion;
  } catch (err) {
    baileysVersion = "unknown";
    return baileysVersion;
  }
};

// Array to store active sessions
const sessions: BaileysClient[] = [];

// Maximum number of reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 3;

// Track sessions being initialized to prevent duplicates
const initializingSession = new Set<number>();

// Sistema de fila otimizado com throttling inteligente
const messageQueue = new Map<number, proto.IWebMessageInfo[]>();
const processingLock = new Set<number>();
const lastProcessTime = new Map<number, number>();

// Configurações otimizadas
const MAX_QUEUE_SIZE = 200; // Aumentado para suportar mais mensagens
const PROCESSING_DELAY = 5; // Reduzido para processamento mais rápido
const BATCH_SIZE = 15; // Aumentado para processar mais mensagens por vez
const IDLE_TIMEOUT = 300000; // 5 minutos para limpeza de filas inativas

const processMessageQueue = async (whatsappId: number): Promise<void> => {
  if (processingLock.has(whatsappId)) {
    return; // Já está processando
  }

  const queue = messageQueue.get(whatsappId);
  if (!queue || queue.length === 0) {
    return;
  }

  processingLock.add(whatsappId);
  lastProcessTime.set(whatsappId, Date.now());

  try {
    // Processar em lotes maiores para melhor throughput
    const batch = queue.splice(0, BATCH_SIZE);

    // Filtrar grupos antes do processamento pesado
    const filteredBatch = batch.filter(msg => {
      const isGroup = msg.key?.remoteJid?.endsWith("@g.us");
      return !isGroup; // Só processa se não for grupo
    });

    if (filteredBatch.length === 0) {
      // Se só tinha mensagens de grupo, processar próximo lote imediatamente
      if (queue.length > 0) {
        setImmediate(() => processMessageQueue(whatsappId));
      }
      return;
    }

    // Cache do handler para evitar imports repetitivos
    const handleBaileysMessage = moduleCache.get('baileysHandler') || 
      (await import("../services/BaileysServices/HandleBaileysMessage")).default;
    
    if (!moduleCache.has('baileysHandler')) {
      moduleCache.set('baileysHandler', handleBaileysMessage);
    }

    const session = getBaileysSession(whatsappId);
    if (!session) {
      baseLogger.warn(`[processMessageQueue] Session ${whatsappId} not found`);
      return;
    }

    // Processar mensagens em paralelo com controle de erro individual
    const processingPromises = filteredBatch.map(async (msg, index) => {
      try {
        await handleBaileysMessage(msg, session);
      } catch (msgErr) {
        baseLogger.error(`[processMessageQueue] Error processing message ${index}: ${msgErr}`);
      }
    });

    // Aguardar todas as mensagens do lote
    await Promise.all(processingPromises);
    
    // Processamento contínuo otimizado
    if (queue.length > 0) {
      // Delay adaptativo baseado no tamanho da fila
      const adaptiveDelay = queue.length > 50 ? 1 : PROCESSING_DELAY;
      await new Promise<void>(resolve => {
        setTimeout(resolve, adaptiveDelay);
      });
      setImmediate(() => processMessageQueue(whatsappId));
    }
  } catch (err) {
    baseLogger.error(`[processMessageQueue] Error in queue processing: ${err}`);
  } finally {
    processingLock.delete(whatsappId);
  }
};

const addToMessageQueue = (whatsappId: number, msg: proto.IWebMessageInfo): void => {
  // Filtro rápido de grupos no ponto de entrada
  const isGroup = msg.key?.remoteJid?.endsWith("@g.us");
  if (isGroup) {
    return; // Não adiciona grupos à fila
  }

  if (!messageQueue.has(whatsappId)) {
    messageQueue.set(whatsappId, []);
  }

  const queue = messageQueue.get(whatsappId)!;
  
  // Gestão inteligente da fila
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Remove mensagens mais antigas, mas preserva as mais recentes
    const toRemove = Math.floor(queue.length * 0.2); // Remove 20% das mais antigas
    queue.splice(0, toRemove);
    baseLogger.warn(`[addToMessageQueue] Queue optimized for session ${whatsappId}, removed ${toRemove} old messages`);
  }

  queue.push(msg);
  
  // Iniciar processamento otimizado
  setImmediate(() => processMessageQueue(whatsappId));
};

// Limpeza periódica de filas inativas
setInterval(() => {
  const now = Date.now();
  for (const [whatsappId, lastTime] of lastProcessTime.entries()) {
    if (now - lastTime > IDLE_TIMEOUT) {
      messageQueue.delete(whatsappId);
      lastProcessTime.delete(whatsappId);
      baseLogger.debug(`[cleanup] Removed idle queue for session ${whatsappId}`);
    }
  }
}, IDLE_TIMEOUT);

// Enhanced session removal with optimized cleanup
export const removeBaileysSession = async (
  whatsappId: number
): Promise<void> => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
  if (sessionIndex !== -1) {
    const session = sessions[sessionIndex];
    try {
      baseLogger.info(`Cleaning up session for WhatsApp ID: ${whatsappId}`);

      // Limpeza otimizada
      initializingSession.delete(whatsappId);
      messageQueue.delete(whatsappId);
      processingLock.delete(whatsappId);
      lastProcessTime.delete(whatsappId);
      clearContactStore(whatsappId);

      // Remove event listeners essenciais (otimizado)
      const criticalEvents = [
        "connection.update",
        "creds.update", 
        "messages.upsert",
        "messages.update"
      ];

      try {
        criticalEvents.forEach(event => {
          (session.ev as any).removeAllListeners(event);
        });

        // Remove outros listeners em lote
        const otherEvents = [
          "message-receipt.update", "presence.update", "contacts.update",
          "chats.update", "groups.update", "group-participants.update",
          "blocklist.set", "blocklist.update", "call"
        ];

        otherEvents.forEach(event => {
          try {
            (session.ev as any).removeAllListeners(event);
          } catch (e) {
            // Ignorar se evento não existir
          }
        });
      } catch (eventErr) {
        baseLogger.warn(`Error removing event listeners: ${eventErr}`);
      }

      // Logout otimizado
      try {
        const wsState = (session as any)?.ws?.readyState;
        if (wsState === 1) { // WebSocket.OPEN
          // Timeout rápido para logout
          const logoutPromise = session.logout();
          const timeoutPromise = new Promise<void>(resolve => setTimeout(() => resolve(), 3000));
          
          await Promise.race([logoutPromise, timeoutPromise]);
          baseLogger.info(`Session ${whatsappId} logout completed`);
        }
      } catch (err) {
        baseLogger.warn(`Error during logout: ${err}`);
      }

      // Remove da lista de sessões
      sessions.splice(sessionIndex, 1);
      baseLogger.info(`Session ${whatsappId} removed from active sessions`);

    } catch (err) {
      baseLogger.error(`Error cleaning up session ${whatsappId}: ${err}`);
    }
  }
};

// Session getter otimizado com cache
const sessionStatusCache = new Map<number, { status: string; timestamp: number }>();
const CACHE_TTL = 5000; // 5 segundos de cache

export const getBaileysSession = (
  whatsappId: number
): BaileysClient | undefined => {
  const session = sessions.find(s => s.id === whatsappId);
  if (!session) return undefined;

  // Verificação de status com cache
  const now = Date.now();
  const cached = sessionStatusCache.get(whatsappId);
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    if (cached.status === "unusable") return undefined;
    return session;
  }

  const connectionState = (session as any)?.connection;
  
  // Estados utilizáveis otimizados
  const usableStates = ["open", "connecting"];
  const isUsable = usableStates.includes(connectionState);

  // Cache do resultado
  sessionStatusCache.set(whatsappId, {
    status: isUsable ? "usable" : "unusable",
    timestamp: now
  });

  if (!isUsable && connectionState === "close") {
    baseLogger.warn(`Session ${whatsappId} is closed - connection: ${connectionState}`);
    return undefined;
  }

  return session;
};

// Main function to initialize Baileys with optimizations
export async function initBaileys(
  whatsapp: Whatsapp,
  phoneNumber?: string
): Promise<BaileysClient> {
  try {
    // Prevent multiple simultaneous initializations
    if (initializingSession.has(whatsapp.id)) {
      baseLogger.info(`Session ${whatsapp.name} already initializing, skipping`);
      throw new Error("Session already being initialized");
    }

    initializingSession.add(whatsapp.id);

    baseLogger.info(`Initializing WhatsApp session for ${whatsapp.name} (ID: ${whatsapp.id})`);

    // Phone number mode optimization OR when status is CONNECTING (force new QR code)
    if (phoneNumber || whatsapp.status === "CONNECTING") {
      baseLogger.info("Phone number mode or CONNECTING status - clearing session");

      const existingSession = sessions.find(s => s.id === whatsapp.id);
      if (existingSession) {
        await removeBaileysSession(whatsapp.id);
      }

      // Clear session directory with error handling
      const sessionDir = join(__dirname, "..", "..", "session", `session-${whatsapp.id}`);
      try {
        await rm(sessionDir, { recursive: true, force: true });
        baseLogger.info(`Session directory cleared for ${whatsapp.name}`);
      } catch (err) {
        baseLogger.warn(`Error clearing session directory: ${err}`);
      }

      await whatsapp.update({
        status: "CONNECTING",
        qrcode: "",
        retries: 0
      });

      // Reduced delay for faster startup
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Check retry limits
    const currentRetries = whatsapp.retries || 0;
    if (currentRetries >= MAX_RECONNECT_ATTEMPTS) {
      baseLogger.error(`Max reconnection attempts reached for ${whatsapp.name}`);
      await whatsapp.update({
        status: "DISCONNECTED",
        qrcode: "",
        retries: 0
      });
      throw new Error("Maximum reconnection attempts reached");
    }

    // Cleanup existing session if any
    const existingSession = sessions.find(s => s.id === whatsapp.id);
    if (existingSession) {
      baseLogger.info(`Cleaning up existing session for ${whatsapp.name}`);
      await removeBaileysSession(whatsapp.id);
      await new Promise(resolve => setTimeout(resolve, 200)); // Reduced delay
    }

    // Initialize auth state
    const sessionDir = join(__dirname, "..", "..", "session", `session-${whatsapp.id}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    // Optimized socket configuration
    const wbot = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS("Chrome"),
      connectTimeoutMs: phoneNumber ? 45000 : 12000, // Reduced for faster connection
      defaultQueryTimeoutMs: 10000, // Reduced for faster responses
      emitOwnEvents: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: false,
      retryRequestDelayMs: phoneNumber ? 2000 : 500, // Much faster retries
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      keepAliveIntervalMs: 10000, // Balanced keep-alive
      qrTimeout: phoneNumber ? 0 : 20000, // Faster QR timeout
      getMessage: async () => undefined, // Always return undefined quickly
      shouldIgnoreJid: (jid) => {
        // Optimized JID filtering
        if (!jid || typeof jid !== 'string') return false;
        return jid.includes('@broadcast') || 
               jid.includes('@newsletter') || 
               jid.endsWith('@g.us'); // Also ignore groups at socket level
      },
      linkPreviewImageThumbnailWidth: 0,
      fireInitQueries: true,
      transactionOpts: {
        maxCommitRetries: phoneNumber ? 3 : 1, // Reduced retries
        delayBetweenTriesMs: phoneNumber ? 1000 : 500 // Faster delays
      },
      patchMessageBeforeSending: message => {
        // Optimized message patching
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
      logger: pino({ level: "silent" }) // Completely silent for performance
    });

    // Add necessary properties and cast to BaileysClient
    const baileysClient = wbot as unknown as BaileysClient;
    (baileysClient as any).id = whatsapp.id;
    (baileysClient as any).connection = "connecting";
    
    // Add required methods to match BaileysClient interface
    (baileysClient as any).getContactById = async (id: string) => {
      // Implement aggressive contact name search
      let contactName = "";
      let contactPushname = "";
      const contactNumber = id.replace(/\D/g, "");
      
      try {
        // Método 1: Business Profile
        try {
          const businessProfile = await wbot.getBusinessProfile(id);
          if (businessProfile && (businessProfile as any)?.description) {
            contactName = (businessProfile as any).description || "";
            contactPushname = (businessProfile as any).description || "";
          }
        } catch (businessErr) {
          baseLogger.debug(`[getContactById] No business profile`);
        }
        
        // Método 2: Profile Picture + onWhatsApp
        if (!contactName) {
          try {
            const profilePic = await wbot.profilePictureUrl(id, 'image');
            if (profilePic) {
              const contactInfo = await wbot.onWhatsApp(contactNumber);
              if (contactInfo && contactInfo.length > 0) {
                const contact = contactInfo[0] as any;
                contactName = contact.notify || contact.name || "";
                contactPushname = contact.notify || "";
              }
            }
          } catch (profileErr) {
            baseLogger.debug(`[getContactById] No profile picture method`);
          }
        }
        
        // Método 3: Status
        if (!contactName) {
          try {
            const status = await wbot.fetchStatus(id) as any;
            if (status?.setBy && status.setBy !== contactNumber) {
              contactName = status.setBy;
              contactPushname = status.setBy;
            }
          } catch (statusErr) {
            baseLogger.debug(`[getContactById] No status method`);
          }
        }
        
        if (!contactName) {
          // No name found, will use number
        }
        
      } catch (error) {
        baseLogger.warn(`[getContactById] Error: ${error}`);
      }
      
      return {
        id: { user: contactNumber, _serialized: id },
        name: contactName,
        pushname: contactPushname,
        number: contactNumber,
        isGroup: id.endsWith("@g.us"),
        isMe: false,
        isWAContact: true,
        isMyContact: true,
        getProfilePicUrl: async () => ""
      } as any;
    };

    // Adicionar store personalizado para contatos
    (baileysClient as any).store = {
      contacts: getContactStore(whatsapp.id)
    };

    // Função para sincronizar contatos do WhatsApp
    (baileysClient as any).syncContacts = async (): Promise<ContactInfo[]> => {
      const contactStore = getContactStore(whatsapp.id);
      const contacts: ContactInfo[] = [];
      
      try {
        baseLogger.info(`[syncContacts] Iniciando sincronização de contatos para sessão ${whatsapp.id}`);
        
        // Método 1: Tentar obter contatos via onWhatsApp com números conhecidos
        // Este método funciona para números que já interagiram
        
        // Método 2: Usar eventos de mensagens recebidas para coletar contatos
        // Os contatos serão coletados automaticamente quando mensagens chegarem
        
        // Método 3: Tentar buscar contatos da agenda do telefone (limitado)
        try {
          // Esta funcionalidade é limitada no WhatsApp Web
          const chats = await wbot.groupFetchAllParticipating();
          
          for (const [chatId, chatInfo] of Object.entries(chats)) {
            if (chatId.endsWith('@g.us')) {
              // Processar participantes de grupos
              for (const participant of chatInfo.participants || []) {
                const contactId = participant.id;
                const number = contactId.split('@')[0];
                
                                 if (!contactStore.has(contactId)) {
                   const contactInfo: ContactInfo = {
                     id: contactId,
                     name: participant.notify || number,
                     pushname: participant.notify || "",
                     notify: participant.notify || "",
                     number: number, // CORREÇÃO: Adicionar número aqui também
                     isGroup: false,
                     lastSeen: Date.now()
                   };
                   
                   contactStore.set(contactId, contactInfo);
                   contacts.push(contactInfo);
                 }
              }
            }
          }
        } catch (groupErr) {
          baseLogger.debug(`[syncContacts] Erro ao buscar grupos: ${groupErr}`);
        }
        
        baseLogger.info(`[syncContacts] Sincronização concluída. ${contacts.length} contatos encontrados para sessão ${whatsapp.id}`);
        return contacts;
        
      } catch (error) {
        baseLogger.error(`[syncContacts] Erro na sincronização: ${error}`);
        throw error;
      }
    };
    
    (baileysClient as any).getNumberId = async (number: string) => {
      // Implement getNumberId method
      return { _serialized: `${number}@c.us` };
    };
    
    (baileysClient as any).logout = async () => {
      // Implement logout method
      await wbot.logout();
    };

    // Optimized credentials handler with debouncing
    let credsSaveTimeout: NodeJS.Timeout;
    wbot.ev.on("creds.update", async () => {
      clearTimeout(credsSaveTimeout);
      credsSaveTimeout = setTimeout(async () => {
        try {
          await saveCreds();
          baseLogger.info(`Credentials updated for session ${whatsapp.id}`);
          await whatsapp.update({ retries: 0 });
        } catch (err) {
          baseLogger.error(`Error saving credentials: ${err}`);
        }
      }, 1000); // Debounce saves
    });

    // Optimized connection update handler
    wbot.ev.on("connection.update", async update => {
      const { connection, lastDisconnect, qr } = update;

      // Update connection state
      (wbot as any).connection = connection;
      
      // Invalidate cache on connection change
      sessionStatusCache.delete(whatsapp.id);

      if (phoneNumber && qr) {
        return; // Ignore QR in phone mode
      }

      if (qr) {
        await whatsapp.update({
          status: "qrcode",
          qrcode: qr,
          retries: 0
        });
        
        const io = await getSocketIO();
        const sessionData = {
          action: "update",
          session: {
            id: whatsapp.id,
            name: whatsapp.name,
            status: "qrcode",
            qrcode: qr,
            isDefault: whatsapp.isDefault,
            tenantId: whatsapp.tenantId
          }
        };
        
        io.emit(`${whatsapp.tenantId}:whatsappSession`, sessionData);
        return;
      }

      if (connection === "connecting") {
        await whatsapp.update({
          status: "CONNECTING",
          qrcode: ""
        });
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        // Clean up session first
        await removeBaileysSession(whatsapp.id);

        // Optimized fatal error check
        const fatalErrors = [
          DisconnectReason.loggedOut,
          DisconnectReason.forbidden,
          DisconnectReason.badSession,
          DisconnectReason.multideviceMismatch
        ];

        const shouldReconnect = !fatalErrors.includes(statusCode) && 
                               currentRetries < MAX_RECONNECT_ATTEMPTS;

        if (!shouldReconnect) {
          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            // Clear session directory for fresh start
            const sessionDir = join(__dirname, "..", "..", "session", `session-${whatsapp.id}`);
            try {
              await rm(sessionDir, { recursive: true, force: true });
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

        // Optimized reconnection with exponential backoff
        const newRetries = currentRetries + 1;
        const retryDelay = Math.min(2000 * Math.pow(2, newRetries - 1), 30000); // Exponential backoff

        await whatsapp.update({
          status: "DISCONNECTED",
          qrcode: "",
          retries: newRetries
        });

        setTimeout(async () => {
          try {
            if (initializingSession.has(whatsapp.id)) {
              return; // Already initializing
            }

            await whatsapp.reload();
            const newSession = await initBaileys(whatsapp, phoneNumber);
            sessions.push(newSession);
          } catch (err) {
            baseLogger.error(`Reconnection attempt ${newRetries} failed: ${err}`);

            if (newRetries >= MAX_RECONNECT_ATTEMPTS) {
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
        await whatsapp.update({
          status: "CONNECTED",
          qrcode: "",
          retries: 0
        });

        // Setup handlers after successful connection
        try {
          const setupHandlers = await getSetupAdditionalHandlers();
          setupHandlers(wbot, whatsapp);
          baseLogger.info(`Message handlers configured for ${whatsapp.name}`);
        } catch (err) {
          baseLogger.error(`Error setting up message handlers: ${err}`);
        }

        // Emit connection event
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

    // Add session to active sessions
    sessions.push(baileysClient);
    initializingSession.delete(whatsapp.id);

    // Optimized pairing code flow
    if (phoneNumber) {
      const waitForConnection = async () => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 30000);

          const checkConnection = () => {
            const state = (baileysClient as any).connection;
            if (state === "open" && (baileysClient as any).ws) {
              clearTimeout(timeout);
              resolve();
            } else if (state === "close") {
              clearTimeout(timeout);
              reject(new Error("Connection closed"));
            } else {
              setTimeout(checkConnection, 500); // Check every 500ms
            }
          };

          checkConnection();
        });
      };

      try {
        await waitForConnection();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced delay

        // Note: requestPairingCode functionality removed as it's not available in new Baileys version
        // If pairing code is needed, it should be implemented differently
        baseLogger.info(`Phone number mode activated for ${whatsapp.name}, but pairing code generation is not available in this Baileys version`);
        
      } catch (err: any) {
        baseLogger.error(`Error in pairing flow: ${err.message}`);
        throw err;
      }
    }

    return baileysClient;
  } catch (err) {
    baseLogger.error(`Error initializing Baileys for ${whatsapp.name}: ${err}`);

    // Cleanup on error
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

// Optimized session restart
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

    // Optimized cleanup
    await removeBaileysSession(whatsappId);

    // Clear session directory
    const sessionDir = join(__dirname, "..", "..", "session", `session-${whatsappId}`);
    try {
      await rm(sessionDir, { recursive: true, force: true });
    } catch (err) {
      baseLogger.warn(`Could not clear session directory: ${err}`);
    }

    // Reset status
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

// Utility functions optimized
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