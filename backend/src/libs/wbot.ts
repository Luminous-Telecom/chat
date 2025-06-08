/* eslint-disable camelcase */
import { Client, LocalAuth, NoAuth, DefaultOptions, WAState } from "whatsapp-web.js";
import path from "path";
import { rm } from "fs/promises";
import { getIO } from "./socket";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import { isSessionClosedError } from "../helpers/HandleSessionError";
import SyncUnreadMessagesWbot from "../services/WbotServices/SyncUnreadMessagesWbot";
import AppError from "../errors/AppError";
import QRCode from "qrcode";
import fs from "fs";

interface Session extends Client {
  id: number;
}

interface SessionState {
  state: WAState | null;
  data?: any;
}

const sessions: Session[] = [];

// Health check para sessões
const sessionHealthCheck = new Map<number, NodeJS.Timeout>();

// Função para verificar saúde da sessão
const checkSessionHealth = async (whatsappId: number): Promise<void> => {
  try {
    const session = getWbot(whatsappId);
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    
    if (!whatsapp) return;
    
    // Verificar se a sessão ainda está ativa
    if (!session || !session.info || session.pupPage?.isClosed()) {
      logger.warn(`Session health check failed for WhatsApp ${whatsappId} (${whatsapp.name}), attempting reconnection`);
      
      // Atualizar status no banco
      await whatsapp.update({ status: "DISCONNECTED" });
      
      // Remover sessão inválida
      removeWbot(whatsappId);
      
      // Tentar reconectar usando o sistema de retry
      const { StartWhatsAppSession, getReconnectionAttempts } = require('../services/WbotServices/StartWhatsAppSession');
      
      // Só tentar reconectar se não estiver em muitas tentativas
      const attempts = getReconnectionAttempts(whatsappId);
      if (attempts < 3) {
        logger.info(`Health check triggering reconnection for WhatsApp ${whatsappId} (attempt ${attempts + 1}/3)`);
        await StartWhatsAppSession(whatsapp, true);
      } else {
        logger.warn(`Health check skipping reconnection for WhatsApp ${whatsappId} - too many attempts`);
      }
    } else {
      // Sessão parece saudável, verificar se o status no banco está correto
      if (whatsapp.status !== "CONNECTED" && whatsapp.status !== "READY") {
        logger.info(`Health check updating status for WhatsApp ${whatsappId} from ${whatsapp.status} to CONNECTED`);
        await whatsapp.update({ status: "CONNECTED" });
      }
    }
  } catch (error: any) {
    if (error.message !== "ERR_WAPP_NOT_INITIALIZED") {
      logger.error(`Error in session health check for ${whatsappId}: ${error.message}`);
    }
  }
};

// Iniciar health check para uma sessão
const startSessionHealthCheck = (whatsappId: number): void => {
  // Limpar health check anterior se existir
  const existingCheck = sessionHealthCheck.get(whatsappId);
  if (existingCheck) {
    clearInterval(existingCheck);
  }
  
  // Verificar a cada 5 minutos
  const healthCheckInterval = setInterval(() => {
    checkSessionHealth(whatsappId);
  }, 5 * 60 * 1000);
  
  sessionHealthCheck.set(whatsappId, healthCheckInterval);
};

// Parar health check para uma sessão
const stopSessionHealthCheck = (whatsappId: number): void => {
  const healthCheck = sessionHealthCheck.get(whatsappId);
  if (healthCheck) {
    clearInterval(healthCheck);
    sessionHealthCheck.delete(whatsappId);
  }
};

// Args otimizados para estabilidade (removidos argumentos problemáticos)
const stable_args = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu",
  "--disable-web-security",
  "--disable-features=TranslateUI",
  "--disable-extensions",
  "--disable-default-apps",
  "--mute-audio",
  "--no-default-browser-check",
  "--autoplay-policy=user-gesture-required",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-popup-blocking"
];

// Cache do QR Code
const qrCodeCache = new Map<number, { data: string; image: string; timestamp: number }>();

// Cache para controlar timeout de inicialização
const initTimeouts = new Map<number, NodeJS.Timeout>();

const generateQrCodeImage = async (qrData: string, whatsappId: number): Promise<string> => {
  try {
    // Verificar cache
    const cached = qrCodeCache.get(whatsappId);
    if (cached && cached.data === qrData && (Date.now() - cached.timestamp) < 15000) {
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

    // Armazenar no cache
    qrCodeCache.set(whatsappId, {
      data: qrData,
      image: qrCodeDataURL,
      timestamp: Date.now()
    });

    return qrCodeDataURL;
  } catch (error: any) {
    logger.error(`Error generating QR Code image: ${error}`);
    return qrData;
  }
};

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

export const removeWbot = (whatsappId: number): void => {
  try {
    // Limpar timeout se existir
    const timeoutId = initTimeouts.get(whatsappId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      initTimeouts.delete(whatsappId);
    }
    
    // Parar health check
    stopSessionHealthCheck(whatsappId);

    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      const session = sessions[sessionIndex];
      
      // Destroy com timeout para evitar travamento
      const destroyPromise = new Promise<void>((resolve) => {
        try {
          session.destroy();
          resolve();
        } catch (err) {
          logger.warn(`Error destroying session ${whatsappId}: ${err}`);
          resolve();
        }
      });
      
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          logger.warn(`Timeout destroying session ${whatsappId}`);
          resolve();
        }, 5000);
      });
      
      Promise.race([destroyPromise, timeoutPromise]).finally(() => {
        sessions.splice(sessionIndex, 1);
        logger.info(`Session ${whatsappId} removed from sessions array`);
      });
    }
    
    qrCodeCache.delete(whatsappId);
  } catch (err: any) {
    if (!isSessionClosedError(err)) {
      logger.error(`removeWbot | Error: ${err}`);
    } else {
      logger.warn(`removeWbot | Session already closed for whatsapp ${whatsappId}`);
    }
  }
};

// Função para verificar se deve usar timeout baseado no estado
const shouldUseTimeout = (whatsapp: Whatsapp): boolean => {
  const validStates = ["CONNECTED", "AUTHENTICATED", "READY", "qrcode"];
  return !validStates.includes(whatsapp.status);
};

const args: string[] = process.env.CHROME_ARGS
  ? process.env.CHROME_ARGS.split(",")
  : stable_args;

args.unshift(`--user-agent=${DefaultOptions.userAgent}`);

export const initWbot = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise<Session>(async (resolve, reject) => {
    try {
      const io = getIO();
      const sessionName = whatsapp.name;
      const { tenantId } = whatsapp;
      let authStrategy: LocalAuth | NoAuth;

      // Limpar timeout anterior se existir
      const existingTimeout = initTimeouts.get(whatsapp.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        initTimeouts.delete(whatsapp.id);
      }

      // Estratégia de autenticação
      const sessionPath = path.resolve(__dirname, "..", "..", ".wwebjs_auth", `session-wbot-${whatsapp.id}`);
      const dataPath = path.resolve(__dirname, "..", "..", ".wwebjs_auth");
      
      // Garantir que o diretório existe
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true, mode: 0o775 });
      }
      
      // Verificar se existe sessão salva
      const hasLocalSession = fs.existsSync(sessionPath);
      const hasDbSession = whatsapp?.session && 
        (typeof whatsapp.session === 'string' ? whatsapp.session.trim() !== "" : 
         typeof whatsapp.session === 'object' && whatsapp.session !== null);
      
      if (hasLocalSession || hasDbSession) {
        try {
          authStrategy = new LocalAuth({ 
            clientId: `session-wbot-${whatsapp.id}`,
            dataPath: dataPath
          });
          logger.info(`Using existing session for whatsapp ${whatsapp.id} (Local: ${hasLocalSession}, DB: ${hasDbSession})`);
        } catch (error: any) {
          logger.warn(`Error setting up LocalAuth for whatsapp ${whatsapp.id}, falling back to NoAuth: ${error.message}`);
          authStrategy = new NoAuth();
        }
      } else {
        logger.info(`No existing session found for whatsapp ${whatsapp.id}, using NoAuth`);
        authStrategy = new NoAuth();
      }

      // Configuração do cliente com timeouts mais generosos
      const wbot = new Client({
        authStrategy: authStrategy,
        puppeteer: {
          headless: true,
          executablePath: process.env.CHROME_BIN || undefined,
          args,
          timeout: 60000,
          defaultViewport: null,
          devtools: false,
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false
        },
        webVersion: process.env.WEB_VERSION || "2.2409.2",
        webVersionCache: {
          type: "remote",
          remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html"
        },
        qrMaxRetries: 0,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 5000
      }) as Session;

      wbot.id = whatsapp.id;

      // Flag para controlar se já foi resolvido
      let sessionResolved = false;

      // Função segura para resolver apenas uma vez
      const resolveSession = (value: Session) => {
        if (!sessionResolved) {
          sessionResolved = true;
          const timeoutId = initTimeouts.get(whatsapp.id);
          if (timeoutId) {
            clearTimeout(timeoutId);
            initTimeouts.delete(whatsapp.id);
          }
          resolve(value);
        }
      };

      const rejectSession = (error: Error) => {
        if (!sessionResolved) {
          sessionResolved = true;
          const timeoutId = initTimeouts.get(whatsapp.id);
          if (timeoutId) {
            clearTimeout(timeoutId);
            initTimeouts.delete(whatsapp.id);
          }
          reject(error);
        }
      };

      // Timeout de segurança mais inteligente
      if (shouldUseTimeout(whatsapp)) {
        const timeoutId = setTimeout(async () => {
          try {
            await whatsapp.reload();
            
            logger.warn(`Initialization timeout check for whatsapp ${whatsapp.id} after 300 seconds - Current status: ${whatsapp.status}`);
            
            const validStates = ["qrcode", "CONNECTED", "AUTHENTICATED", "READY"];
            if (validStates.includes(whatsapp.status)) {
              logger.info(`WhatsApp ${whatsapp.id} is in valid state (${whatsapp.status}), not timing out`);
              return;
            }
            
            if (wbot && wbot.pupPage && !wbot.pupPage.isClosed()) {
              try {
                const pageResponsive = await Promise.race([
                  wbot.pupPage.evaluate(() => document.readyState),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
                ]);
                
                if (pageResponsive) {
                  logger.info(`WhatsApp ${whatsapp.id} browser session is responsive, not timing out`);
                  return;
                }
              } catch (testError) {
                logger.warn(`WhatsApp ${whatsapp.id} responsiveness test failed: ${testError}`);
              }
            }
            
            if (wbot && wbot.info && wbot.info.wid) {
              logger.info(`WhatsApp ${whatsapp.id} has valid session info, not timing out`);
              return;
            }
            
            logger.warn(`WhatsApp ${whatsapp.id} initialization timeout - rejecting`);
            rejectSession(new Error("Initialization timeout"));
          } catch (error: any) {
            logger.error(`Error in timeout check for WhatsApp ${whatsapp.id}: ${error}`);
          }
        }, 300000);

        initTimeouts.set(whatsapp.id, timeoutId);
      }

      // Inicializar com retry em caso de erro
      try {
        wbot.initialize();
      } catch (initError: any) {
        logger.error(`Error initializing wbot for ${whatsapp.id}: ${initError.message}`);
        rejectSession(new Error(`Initialization failed: ${initError.message}`));
        return;
      }
      
      // Evento QR Code
      wbot.on("qr", async (qr: string) => {
        if (whatsapp.status === "CONNECTED" || whatsapp.status === "AUTHENTICATED") {
          logger.info(`Ignoring QR for ${sessionName}-ID: ${whatsapp.id} - already connected`);
          return;
        }
        
        logger.info(`QR CODE generated for ${sessionName}-ID: ${whatsapp.id}`);
        
        try {
          const qrCodeImage = await generateQrCodeImage(qr, whatsapp.id);
          
          await whatsapp.update({ 
            qrcode: qrCodeImage,
            status: "qrcode", 
            retries: 0 
          });

          const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
          if (sessionIndex === -1) {
            wbot.id = whatsapp.id;
            sessions.push(wbot);
          }
          
          // Iniciar health check para esta sessão
          startSessionHealthCheck(whatsapp.id);

          io.emit(`${tenantId}:whatsappSession`, {
            action: "update",
            session: {
              id: whatsapp.id,
              name: whatsapp.name,
              status: "qrcode",
              qrcode: qrCodeImage,
              number: whatsapp.number
            }
          });

          logger.info(`QR Code processed for whatsapp ${whatsapp.id}`);
        } catch (error: any) {
          logger.error(`Error processing QR code: ${error}`);
          try {
            await whatsapp.update({ 
              qrcode: qr,
              status: "qrcode", 
              retries: 0 
            });
          } catch (updateError: any) {
            logger.error(`Error updating QR fallback: ${updateError}`);
          }
        }
      });

      // Eventos de debug
      wbot.on("change_state", async (state: string) => {
        logger.debug(`WhatsApp ${whatsapp.id} state changed to: ${state}`);
        
        try {
          // Tentar obter o estado atual da sessão
          let sessionState: SessionState = { state: null };
          
          // Tentar diferentes métodos para obter o estado
          try {
            // Método 1: Usar o estado do cliente
            const clientState = await wbot.getState();
            if (clientState) {
              sessionState = { state: clientState, data: clientState };
            }
          } catch (stateError) {
            logger.debug(`Could not get state from client: ${stateError.message}`);
            
            try {
              // Método 2: Usar o estado do puppeteer
              if (wbot.pupPage && !wbot.pupPage.isClosed()) {
                const pupState = await wbot.pupPage.evaluate(() => {
                  return (window as any).Store?.State?.default?.state || null;
                });
                if (pupState) {
                  sessionState = { state: pupState as WAState, data: pupState };
                }
              }
            } catch (pupError) {
              logger.debug(`Could not get state from puppeteer: ${pupError.message}`);
            }
          }
          
          // Se conseguimos obter o estado, salvar
          if (sessionState.state) {
            logger.info(`Saving session state for ${whatsapp.id} (state: ${state})`);
            await whatsapp.update({
              session: sessionState.data,
              status: state
            });
          }
          
          // Atualizar status no banco
          await whatsapp.update({ status: state });
          
          // Emitir atualização via socket
          io.emit(`${tenantId}:whatsappSession`, {
            action: "update",
            session: {
              id: whatsapp.id,
              name: whatsapp.name,
              status: state,
              qrcode: "",
              number: whatsapp.number
            }
          });
        } catch (error: any) {
          logger.error(`Error handling state change: ${error.message}`);
        }
      });

      // Evento authenticated
      wbot.on("authenticated", async (session: any) => {
        logger.info(`Session: ${sessionName} AUTHENTICATED`);
        
        try {
          // Adicionar sessão na memória imediatamente
          const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
          if (sessionIndex === -1) {
            wbot.id = whatsapp.id;
            sessions.push(wbot);
            logger.info(`Session ${whatsapp.id} added to memory during authentication`);
          } else {
            // Se já existe, atualizar
            sessions[sessionIndex] = wbot;
            logger.info(`Session ${whatsapp.id} updated in memory during authentication`);
          }

          // Criar diretório da sessão se não existir
          const sessionPath = path.resolve(__dirname, "..", "..", ".wwebjs_auth", `session-wbot-${whatsapp.id}`);
          if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true, mode: 0o775 });
            logger.info(`Created session directory for whatsapp ${whatsapp.id}`);
          }
          
          // Se temos uma sessão válida, salvar imediatamente
          if (session) {
            logger.info(`Saving initial session data for ${whatsapp.id}`);
            try {
              await whatsapp.update({ 
                session: session,
                status: "AUTHENTICATED"
              });
              logger.info(`Initial session data saved successfully for ${whatsapp.id}`);
            } catch (error: any) {
              logger.error(`Failed to save initial session data: ${error.message}`);
            }
          } else {
            logger.info(`No initial session data for ${whatsapp.id}, will wait for ready event`);
          }
          
          // Atualizar status e emitir evento
          await whatsapp.update({ status: "AUTHENTICATED" });
          io.emit(`${tenantId}:whatsappSession`, {
            action: "update",
            session: {
              id: whatsapp.id,
              name: whatsapp.name,
              status: "AUTHENTICATED",
              qrcode: "",
              number: whatsapp.number
            }
          });

          // Iniciar health check para esta sessão
          startSessionHealthCheck(whatsapp.id);
          
        } catch (error: any) {
          logger.error(`Error in authenticated event: ${error.message}`);
        }
      });

      // Evento auth_failure
      wbot.on("auth_failure", async (msg: string) => {
        logger.error(`Authentication failure for ${sessionName}: ${msg}`);
        
        try {
          const currentRetries = whatsapp.retries || 0;
          
          await whatsapp.update({
            status: "DISCONNECTED",
            session: "",
            qrcode: "",
            retries: currentRetries + 1
          });

          if (currentRetries >= 2) {
            logger.info(`Clearing session for ${whatsapp.id} after ${currentRetries + 1} auth failures`);
            await apagarPastaSessao(whatsapp.id);
            await whatsapp.update({ retries: 0 });
          }

          io.emit(`${tenantId}:whatsappSession`, {
            action: "update",
            session: {
              id: whatsapp.id,
              name: whatsapp.name,
              status: "DISCONNECTED",
              qrcode: "",
              number: whatsapp.number
            }
          });
        } catch (error: any) {
          logger.error(`Error handling auth failure: ${error}`);
        }
        
        rejectSession(new Error(`Authentication failed: ${msg}`));
      });

      // Função para verificar se a sessão está saudável
      const isSessionHealthy = async (wbot: Session): Promise<boolean> => {
        try {
          if (!wbot || !wbot.pupPage || wbot.pupPage.isClosed()) {
            logger.warn(`Session health check failed: wbot or page invalid`);
            return false;
          }

          if (!wbot.info || !wbot.info.wid) {
            logger.warn(`Session health check failed: no valid session info`);
            return false;
          }

          // Verificar se a página está responsiva
          try {
            const isResponsive = await Promise.race([
              wbot.pupPage.evaluate(() => {
                return document.readyState === 'complete' && 
                       (document.querySelector('[data-testid="app"]') !== null ||
                        document.querySelector('#app') !== null ||
                        document.querySelector('.app') !== null ||
                        typeof (window as any).Store !== 'undefined');
              }),
              new Promise<boolean>((_, reject) => 
                setTimeout(() => reject(new Error('Page not responsive')), 5000)
              )
            ]);
            
            if (!isResponsive) {
              logger.warn(`Session health check failed: page not responsive`);
              return false;
            }
            
            return true;
          } catch (error) {
            logger.warn(`Session health check failed: ${error.message}`);
            return false;
          }
        } catch (error) {
          logger.warn(`Session health check failed: ${error.message}`);
          return false;
        }
      };

      // Evento ready
      wbot.on("ready", async () => {
        logger.info(`Session: ${sessionName} READY`);

        try {
          // Verificar saúde da sessão antes de prosseguir
          const isHealthy = await isSessionHealthy(wbot);
          if (!isHealthy) {
            logger.warn(`Session ${whatsapp.id} not healthy in ready event, waiting for recovery`);
            return;
          }

          // Verificar se a sessão já está na memória
          const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
          if (sessionIndex === -1) {
            // Se por algum motivo a sessão não estiver na memória, adicionar
            wbot.id = whatsapp.id;
            sessions.push(wbot);
            logger.info(`Session ${whatsapp.id} added to memory during ready event (was missing)`);
          } else {
            // Atualizar a sessão existente
            sessions[sessionIndex] = wbot;
            logger.info(`Session ${whatsapp.id} updated in memory during ready event`);
          }

          // Tentar obter e salvar o estado atual da sessão com retry
          let retryCount = 0;
          const maxRetries = 3;
          let sessionState: SessionState = { state: null };

          while (retryCount < maxRetries && !sessionState.state) {
            try {
              // Tentar obter o estado do cliente
              const clientState = await wbot.getState();
              if (clientState) {
                sessionState = { state: clientState, data: clientState };
                logger.info(`Successfully got session state for ${whatsapp.id} (attempt ${retryCount + 1})`);
                break;
              }
            } catch (stateError: any) {
              logger.warn(`Failed to get session state (attempt ${retryCount + 1}): ${stateError.message}`);
            }

            // Se não conseguiu, tentar via puppeteer
            if (!sessionState.state && wbot.pupPage && !wbot.pupPage.isClosed()) {
              try {
                const pupState = await wbot.pupPage.evaluate(() => {
                  return (window as any).Store?.State?.default?.state || null;
                });
                if (pupState) {
                  sessionState = { state: pupState as WAState, data: pupState };
                  logger.info(`Got session state via puppeteer for ${whatsapp.id}`);
                  break;
                }
              } catch (pupError: any) {
                logger.warn(`Failed to get state via puppeteer (attempt ${retryCount + 1}): ${pupError.message}`);
              }
            }

            retryCount++;
            if (retryCount < maxRetries) {
              logger.info(`Retrying to get session state for ${whatsapp.id} (${retryCount + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos entre tentativas
            }
          }

          // Se conseguimos obter o estado, salvar
          if (sessionState.state) {
            logger.info(`Saving final session state for ${whatsapp.id}`);
            await whatsapp.update({
              session: sessionState.data,
              status: "CONNECTED",
              qrcode: "",
              retries: 0,
              number: wbot?.info?.wid?.user
            });
            logger.info(`Session state saved successfully for ${whatsapp.id}`);
          } else {
            logger.error(`Failed to get session state after ${maxRetries} attempts for ${whatsapp.id}`);
          }

          try {
            wbot.sendPresenceAvailable();
          } catch (presenceError: any) {
            logger.warn(`Error sending presence for ${whatsapp.id}: ${presenceError.message}`);
          }
          
          // Processar informações adicionais em background
          setImmediate(async () => {
            try {
              const info: any = wbot?.info;
              let wbotVersion: string = "";
              let wbotBrowser: string = "";
              
              try {
                wbotVersion = await Promise.race([
                  wbot.getWWebVersion(),
                  new Promise<string>((_, reject) => 
                    setTimeout(() => reject(new Error('timeout')), 10000)
                  )
                ]).catch(() => "unknown");
                
                wbotBrowser = await Promise.race([
                  wbot.pupBrowser?.version() || Promise.resolve(""),
                  new Promise<string>((_, reject) => 
                    setTimeout(() => reject(new Error('timeout')), 5000)
                  )
                ]).catch(() => "unknown");
              } catch (error: any) {
                logger.warn(`Error getting version info: ${error.message}`);
              }
              
              await whatsapp.update({
                phone: {
                  ...(info || {}),
                  wbotVersion,
                  wbotBrowser
                }
              });

              io.emit(`${tenantId}:whatsappSession`, {
                action: "readySession",
                session: {
                  id: whatsapp.id,
                  name: whatsapp.name,
                  status: "CONNECTED",
                  number: wbot?.info?.wid?.user,
                  phone: whatsapp.phone
                }
              });

              // Sincronizar mensagens com delay maior
              setTimeout(async () => {
                try {
                  if (wbot && wbot.pupPage && !wbot.pupPage.isClosed() && wbot.info) {
                    await SyncUnreadMessagesWbot(wbot, tenantId);
                  } else {
                    logger.warn(`Skipping message sync for ${whatsapp.id} - session not ready`);
                  }
                } catch (error: any) {
                  const errorMessage = error.message || '';
                  
                  if (errorMessage.includes('participants') || errorMessage.includes('Cannot read properties of undefined')) {
                    logger.error(`WhatsApp participants/undefined property error for ${whatsapp.id} - session may be unstable`);
                  } else if (errorMessage.includes('Evaluation failed')) {
                    logger.error(`Puppeteer evaluation failed for ${whatsapp.id} - WhatsApp Web interface issue`);
                  } else if (errorMessage.includes('Execution context was destroyed')) {
                    logger.error(`Execution context destroyed for ${whatsapp.id} - browser page was closed`);
                  } else if (errorMessage.includes('Protocol error')) {
                    logger.error(`Protocol error for ${whatsapp.id} - connection issue`);
                  } else {
                    logger.warn(`Error syncing messages for ${whatsapp.id}: ${errorMessage}`);
                  }
                }
              }, 10000);
            } catch (error: any) {
              logger.error(`Error updating additional info: ${error}`);
            }
          });
          
          resolveSession(wbot);
        } catch (error: any) {
          logger.error(`Error in ready event: ${error}`);
          rejectSession(error);
        }
      });

      // Evento disconnected
      wbot.on("disconnected", async (reason: string) => {
        logger.info(`Session: ${sessionName} DISCONNECTED: ${reason}`);
        
        try {
          // Verificar se a sessão ainda está válida antes de desconectar
          const isHealthy = await isSessionHealthy(wbot);
          if (isHealthy) {
            logger.info(`Session ${whatsapp.id} still healthy despite disconnect event, attempting recovery`);
            return;
          }
          
          // Tentar salvar o estado atual antes de desconectar
          try {
            const currentState = await wbot.getState();
            if (currentState) {
              await whatsapp.update({
                session: currentState,
                status: "DISCONNECTED",
                qrcode: ""
              });
              logger.info(`Saved session state before disconnect for ${whatsapp.id}`);
            }
          } catch (stateError: any) {
            logger.warn(`Could not save state before disconnect: ${stateError.message}`);
          }

          // Não remover a sessão imediatamente, dar chance de recuperação
          setTimeout(async () => {
            const stillHealthy = await isSessionHealthy(wbot);
            if (!stillHealthy) {
              logger.info(`Session ${whatsapp.id} not recovered, removing from memory`);
              removeWbot(whatsapp.id);
              
              // Tentar reconectar usando o sistema de retry
              const { StartWhatsAppSession, getReconnectionAttempts } = require('../services/WbotServices/StartWhatsAppSession');
              const attempts = getReconnectionAttempts(whatsapp.id);
              if (attempts < 3) {
                logger.info(`Attempting to reconnect session ${whatsapp.id} (attempt ${attempts + 1}/3)`);
                await StartWhatsAppSession(whatsapp, true);
              }
            }
          }, 10000); // Aguardar 10 segundos antes de tentar reconectar

          io.emit(`${tenantId}:whatsappSession`, {
            action: "update",
            session: {
              id: whatsapp.id,
              name: whatsapp.name,
              status: "DISCONNECTED",
              qrcode: "",
              number: whatsapp.number
            }
          });
        } catch (error: any) {
          logger.error(`Error handling disconnection: ${error}`);
        }
      });

      // Eventos de debug
      wbot.on("change_state", (state: string) => {
        logger.debug(`WhatsApp ${whatsapp.id} state changed to: ${state}`);
      });

      wbot.on("error", (error: Error) => {
        logger.error(`WhatsApp ${whatsapp.id} client error: ${error.message}`);
        
        if (error.message.includes('Protocol error') || 
            error.message.includes('Target closed') ||
            error.message.includes('Session closed')) {
          logger.warn(`Non-critical error for ${whatsapp.id}, not rejecting initialization`);
        }
      });

    } catch (err: any) {
      logger.error(`initWbot error: ${err}`);
      reject(err);
    }
  });
};

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
  if (sessionIndex === -1) {
    logger.warn(`Session ${whatsappId} not found in memory. Sessions in memory: ${sessions.length}`);
    logger.warn(`Available session IDs: ${sessions.map(s => s.id).join(', ')}`);
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

// Função para restaurar sessão na memória
const restoreSessionInMemory = async (whatsapp: Whatsapp): Promise<boolean> => {
  try {
    // Verificar se já existe na memória
    const existingSession = sessions.find(s => s.id === whatsapp.id);
    if (existingSession) {
      logger.info(`Session ${whatsapp.id} already in memory`);
      return true;
    }

    // Verificar se temos dados de sessão válidos
    if (!whatsapp.session) {
      logger.warn(`No session data available for ${whatsapp.id}`);
      return false;
    }

    // Tentar inicializar a sessão
    try {
      const wbot = await initWbot(whatsapp);
      if (wbot) {
        logger.info(`Successfully restored session ${whatsapp.id} in memory`);
        return true;
      }
    } catch (error: any) {
      logger.error(`Failed to restore session ${whatsapp.id}: ${error.message}`);
    }

    return false;
  } catch (error: any) {
    logger.error(`Error restoring session ${whatsapp.id}: ${error.message}`);
    return false;
  }
};

// Função para iniciar todas as sessões
export const StartAllWhatsAppsSessions = async (): Promise<void> => {
  try {
    const whatsapps = await Whatsapp.findAll();
    logger.info(`[StartAllWhatsAppsSessions] Iniciando ${whatsapps.length} sessões do WhatsApp`);
    
    // Array para armazenar as sessões que precisam ser sincronizadas
    const sessionsToSync: Whatsapp[] = [];
    
    for (const whatsapp of whatsapps) {
      logger.info(`[StartAllWhatsAppsSessions] Iniciando sessão: ${whatsapp.name} (ID: ${whatsapp.id}, Status: ${whatsapp.status})`);
      
      // Verificar se já está em um estado válido
      if (["CONNECTED", "AUTHENTICATED", "READY"].includes(whatsapp.status)) {
        logger.info(`WhatsApp ${whatsapp.name} already in valid state: ${whatsapp.status}`);
        
        // Tentar restaurar a sessão na memória
        const restored = await restoreSessionInMemory(whatsapp);
        if (restored) {
          logger.info(`Successfully restored session ${whatsapp.id} in memory`);
          // Sincronizar imediatamente após restaurar
          await syncSessionStatus();
          continue;
        }
        
        // Se não conseguiu restaurar, tentar reconectar
        logger.info(`Failed to restore session ${whatsapp.id}, attempting reconnection`);
        const { StartWhatsAppSession } = require('../services/WbotServices/StartWhatsAppSession');
        await StartWhatsAppSession(whatsapp, true);
        // Sincronizar imediatamente após reconectar
        await syncSessionStatus();
      } else {
        // Iniciar nova sessão
        const { StartWhatsAppSession } = require('../services/WbotServices/StartWhatsAppSession');
        await StartWhatsAppSession(whatsapp, false);
        // Sincronizar imediatamente após iniciar
        await syncSessionStatus();
      }
    }

    // Iniciar o sync periódico após um curto delay
    setTimeout(() => {
      logger.info("Starting periodic session sync");
      syncSessionStatus();
    }, 5 * 60 * 1000); // 5 minutos de delay para o próximo sync

  } catch (error: any) {
    logger.error(`Error starting WhatsApp sessions: ${error.message}`);
  }
};

// Função para verificar e sincronizar estado das sessões
export const syncSessionStatus = async (): Promise<void> => {
  try {
    const whatsapps = await Whatsapp.findAll({
      where: {
        status: ["CONNECTED", "READY", "AUTHENTICATED"]
      }
    });
    
    logger.info(`Periodic sync: ${whatsapps.length} sessions in DB, ${sessions.length} in memory`);
    
    for (const whatsapp of whatsapps) {
      const sessionInMemory = sessions.find(s => s.id === whatsapp.id);
      
      if (!sessionInMemory) {
        logger.warn(`Session ${whatsapp.id} (${whatsapp.name}) not in memory during periodic sync`);
        
        // Tentar restaurar a sessão na memória primeiro
        const restored = await restoreSessionInMemory(whatsapp);
        if (restored) {
          logger.info(`Successfully restored session ${whatsapp.id} during periodic sync`);
          continue;
        }
        
        // Se não conseguiu restaurar, atualizar status no banco e tentar reconectar
        await whatsapp.update({ status: "DISCONNECTED" });
        
        // Tentar reconectar automaticamente
        const { StartWhatsAppSession } = require('../services/WbotServices/StartWhatsAppSession');
        logger.info(`Attempting to reconnect session ${whatsapp.id} during periodic sync`);
        
        try {
          await StartWhatsAppSession(whatsapp, true);
        } catch (error: any) {
          logger.error(`Failed to reconnect session ${whatsapp.id}: ${error.message}`);
        }
      } else {
        // Verificar se a sessão em memória está realmente ativa
        if (!sessionInMemory.info || sessionInMemory.pupPage?.isClosed()) {
          logger.warn(`Session ${whatsapp.id} in memory but not active during periodic sync`);
          await whatsapp.update({ status: "DISCONNECTED" });
          removeWbot(whatsapp.id);
        }
      }
    }
  } catch (error: any) {
    logger.error(`Error in periodic session sync: ${error.message}`);
  }
};

// Função para obter informações de debug das sessões
export const getSessionsDebugInfo = (): any => {
  return {
    sessionsInMemory: sessions.length,
    sessionIds: sessions.map(s => ({
      id: s.id,
      hasInfo: !!s.info,
      isPageClosed: s.pupPage?.isClosed() || false,
      state: s.info?.wid || 'no-info'
    }))
  };
};

// Função para limpeza periódica de cache
export const cleanupInitCache = (): void => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutos
  
  for (const [whatsappId, cache] of qrCodeCache.entries()) {
    if (now - cache.timestamp > maxAge) {
      qrCodeCache.delete(whatsappId);
    }
  }
  
  logger.debug('Init cache cleanup completed');
};