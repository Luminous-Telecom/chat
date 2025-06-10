import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import { getBaileys, initBaileys, removeBaileys } from "../../libs/baileys";
import Whatsapp from "../../models/Whatsapp";
import { ensureWhatsappInstance, safeUpdateWhatsapp } from "../../helpers/WhatsappHelper";
import { WhatsAppErrors } from "../../utils/errorHandler";
import { StartTbotSession } from "../TbotServices/StartTbotSession";
import { StartInstaBotSession } from "../InstagramBotServices/StartInstaBotSession";
import { StartMessengerBot } from "../MessengerChannelServices/StartMessengerBot";
import { StartWaba360 } from "../WABA360/StartWaba360";
import { verificarSaudeSessao, sincronizarEstadoSessao } from "../../libs/WhatsAppConnectionManager";
import wbotMessageListener from "./wbotMessageListener";
import wbotMonitor from "./wbotMonitor";
import { WASocket, DisconnectReason, BaileysEventMap } from "@whiskeysockets/baileys";

// Map para controlar tentativas de reconexão
const reconnectionAttempts = new Map<number, number>();
const lastErrorTime = new Map<number, number>();

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  isRetry: boolean = false
): Promise<void> => {
  const io = getIO();
  let whatsappInstance: Whatsapp | null = null;

  try {
    // Garantir que temos uma instância válida do WhatsApp
    whatsappInstance = await ensureWhatsappInstance(whatsapp);
    
    if (!whatsappInstance) {
      throw new Error("Failed to get valid WhatsApp instance");
    }

    // Se não for retry, verificar se a sessão já está ativa na memória
    if (!isRetry) {
      try {
        const existingSession = getBaileys(whatsappInstance.id) as Session;
        const isSessionHealthy = existingSession && 
                                existingSession.user && 
                                existingSession.user.id;

        if (isSessionHealthy) {
          // Verificar saúde da sessão
          const estaSaudavel = await verificarSaudeSessao(whatsappInstance.id);
          if (estaSaudavel && (whatsappInstance.status === "CONNECTED" || whatsappInstance.status === "READY")) {
            logger.info(`WhatsApp ${whatsappInstance.name} (ID: ${whatsappInstance.id}) already in valid state: ${whatsappInstance.status}`);
            return;
          }
          
          // Se a sessão não está saudável, remover e reconectar
          logger.warn(`WhatsApp ${whatsappInstance.name} (ID: ${whatsappInstance.id}) found in memory but not healthy, removing and reconnecting`);
          await removeBaileys(whatsappInstance.id);
        }
      } catch (error) {
        // Ignora erro se sessão não existir na memória
        logger.debug(`No existing session found for WhatsApp ${whatsappInstance.id}`);
      }
    }
    
    // Sincronizar estado antes de iniciar nova sessão
    await sincronizarEstadoSessao(whatsappInstance);
    
    // Log detalhado do estado atual
    logger.info(`[StartBaileysSession] Starting session ${whatsappInstance.name} (ID: ${whatsappInstance.id}) - Status: ${whatsappInstance.status}, isRetry: ${isRetry}`);

    // Atualizar estado inicial
    await safeUpdateWhatsapp(whatsappInstance, { 
      status: "OPENING",
      qrcode: "",
      retries: (whatsappInstance.retries || 0) + (isRetry ? 1 : 0)
    });

    // Emitir atualização inicial
    io.emit(`${whatsappInstance.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsappInstance
    });

    if (whatsappInstance.type === "whatsapp") {
      logger.info(`[StartBaileysSession] Initializing new session for ${whatsappInstance.id}`);
      
      try {
        // Garantir que o objeto WhatsApp está válido antes de iniciar
        if (!whatsappInstance.id || !whatsappInstance.tenantId) {
          throw WhatsAppErrors.invalidObject(`Invalid WhatsApp object: missing required fields (id: ${whatsappInstance.id}, tenantId: ${whatsappInstance.tenantId})`);
        }

        // Inicializar sessão Baileys
        const wbot = await initBaileys(whatsappInstance) as Session;
        if (!wbot) {
          throw WhatsAppErrors.initializationFailed("Failed to initialize WhatsApp client");
        }

        // Aguardar a sessão estar pronta
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Session initialization timeout"));
          }, 30000); // 30 segundos de timeout

          const unprocess = wbot.ev.process((events: Partial<BaileysEventMap>) => {
            const update = events["connection.update"];
            if (update) {
              if (update.connection === "open") {
                clearTimeout(timeout);
                unprocess();
                resolve();
              } else if (update.connection === "close") {
                clearTimeout(timeout);
                unprocess();
                reject(new Error(`Connection closed during initialization: ${update.lastDisconnect?.error}`));
              }
            }
          });
        });

        // Configurar listeners após a sessão estar pronta
        wbotMessageListener(wbot);
        wbotMonitor(wbot, whatsappInstance);
        
        // Resetar contadores de tentativas em caso de sucesso
        reconnectionAttempts.delete(whatsappInstance.id);
        lastErrorTime.delete(whatsappInstance.id);
        
        logger.info(`[StartBaileysSession] Successfully initialized session for ${whatsappInstance.id}`);
        
        // Atualizar estado para CONNECTED
        await safeUpdateWhatsapp(whatsappInstance, {
          status: "CONNECTED",
          qrcode: ""
        });

        io.emit(`${whatsappInstance.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsappInstance
        });

      } catch (err) {
        logger.error(`Error starting WhatsApp session for ${whatsappInstance.name}: ${err.message}`);
        
        // Atualizar estado de erro
        await safeUpdateWhatsapp(whatsappInstance, {
          status: "DISCONNECTED",
          qrcode: "",
          retries: (whatsappInstance.retries || 0) + 1
        });

        io.emit(`${whatsappInstance.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsappInstance
        });
        
        throw err;
      }
    } else if (whatsappInstance.type === "telegram") {
      await StartTbotSession(whatsappInstance);
    } else if (whatsappInstance.type === "instagram") {
      await StartInstaBotSession(whatsappInstance);
    } else if (whatsappInstance.type === "messenger") {
      await StartMessengerBot(whatsappInstance);
    } else if (whatsappInstance.type === "waba") {
      await StartWaba360(whatsappInstance);
    }
  } catch (err: any) {
    logger.error(`StartWhatsAppSession | Error for ${whatsappInstance?.name || 'unknown'}: ${err.message}`);
    
    // Recarregar status atual do WhatsApp se possível
    if (whatsappInstance?.id) {
      try {
        await whatsappInstance.reload();
        // Sincronizar estado após erro
        await sincronizarEstadoSessao(whatsappInstance);
        
        // Atualizar estado usando safeUpdateWhatsapp
        await safeUpdateWhatsapp(whatsappInstance, {
          status: "DISCONNECTED",
          qrcode: "",
          retries: (whatsappInstance.retries || 0) + 1
        });
      } catch (reloadErr) {
        logger.warn(`Could not reload WhatsApp ${whatsappInstance.name} status: ${reloadErr}`);
      }
      
      // Verificar se a sessão está em estado válido apesar do erro
      const validStates = ["CONNECTED", "READY", "AUTHENTICATED"];
      if (validStates.includes(whatsappInstance.status)) {
        logger.info(`WhatsApp ${whatsappInstance.name} is in valid state (${whatsappInstance.status}) despite error - keeping session active`);
        return;
      }
      
      // Verificar se é estado de QR code válido
      if (whatsappInstance.status === "qrcode" && whatsappInstance.qrcode) {
        logger.info(`WhatsApp ${whatsappInstance.name} in QR code state - keeping session active for user authentication`);
        return;
      }
    }
    
    throw err;
  }
};

export default StartWhatsAppSession;