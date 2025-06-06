/* eslint-disable camelcase */
import { Client, LocalAuth, NoAuth, DefaultOptions } from "whatsapp-web.js";
import path from "path";
import { rm } from "fs/promises";
import { getIO } from "./socket";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import { isSessionClosedError } from "../helpers/HandleSessionError";
import SyncUnreadMessagesWbot from "../services/WbotServices/SyncUnreadMessagesWbot";
import AppError from "../errors/AppError";
import QRCode from "qrcode";

interface Session extends Client {
  id: number;
}

const sessions: Session[] = [];

// Args otimizados para melhor performance
const optimized_args = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--single-process",
  "--disable-gpu",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-web-security",
  "--disable-features=TranslateUI,VizDisplayCompositor",
  "--disable-extensions",
  "--disable-component-extensions-with-background-pages",
  "--disable-default-apps",
  "--mute-audio",
  "--no-default-browser-check",
  "--autoplay-policy=user-gesture-required",
  "--disable-background-networking",
  "--disable-sync",
  "--metrics-recording-only",
  "--disable-prompt-on-repost",
  "--disable-hang-monitor",
  "--disable-client-side-phishing-detection",
  "--disable-popup-blocking",
  "--disable-domain-reliability",
  "--disable-component-update"
];

// Cache do QR Code
const qrCodeCache = new Map<number, { data: string; image: string; timestamp: number }>();

const generateQrCodeImage = async (qrData: string, whatsappId: number): Promise<string> => {
  try {
    // Verificar cache
    const cached = qrCodeCache.get(whatsappId);
    if (cached && cached.data === qrData && (Date.now() - cached.timestamp) < 10000) {
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
  } catch (error: any) {
    logger.info(`apagarPastaSessao:: ${pathSession}`);
    logger.error(error);
  }
};

export const removeWbot = (whatsappId: number): void => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].destroy();
      sessions.splice(sessionIndex, 1);
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

const args: string[] = process.env.CHROME_ARGS
  ? process.env.CHROME_ARGS.split(",")
  : optimized_args;

args.unshift(`--user-agent=${DefaultOptions.userAgent}`);

export const initWbot = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise<Session>(async (resolve, reject) => {
    try {
      const io = getIO();
      const sessionName = whatsapp.name;
      const { tenantId } = whatsapp;
      let authStrategy: LocalAuth | NoAuth;

      // Estratégia de autenticação
      if (whatsapp?.session && whatsapp.session.trim() !== "") {
        try {
          const sessionCfg = JSON.parse(whatsapp.session);
          if (sessionCfg && typeof sessionCfg === 'object') {
            authStrategy = new LocalAuth({ 
              clientId: `wbot-${whatsapp.id}`,
              dataPath: path.resolve(__dirname, "..", "..", ".wwebjs_auth") 
            });
            logger.info(`Using LocalAuth for whatsapp ${whatsapp.id}`);
          } else {
            throw new Error("Invalid session data");
          }
        } catch (error: any) {
          logger.warn(`Invalid session for whatsapp ${whatsapp.id}, using NoAuth`);
          await whatsapp.update({ session: "", qrcode: "", status: "OPENING" });
          authStrategy = new NoAuth();
        }
      } else {
        authStrategy = new NoAuth();
      }

      // Configuração do cliente
      const wbot = new Client({
        authStrategy: authStrategy,
        puppeteer: {
          headless: true,
          executablePath: process.env.CHROME_BIN || undefined,
          args,
          timeout: 30000,
          defaultViewport: null,
          devtools: false
        },
        webVersion: process.env.WEB_VERSION || "2.2409.2",
        webVersionCache: {
          type: "remote",
          remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html"
        },
        qrMaxRetries: 3
      }) as Session;

      wbot.id = whatsapp.id;
      wbot.initialize();

      // Evento QR Code
      wbot.on("qr", async (qr: string) => {
        if (whatsapp.status === "CONNECTED") return;
        
        logger.info(`QR CODE generated for ${sessionName}-ID: ${whatsapp.id}`);
        
        setImmediate(async () => {
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
            await whatsapp.update({ 
              qrcode: qr,
              status: "qrcode", 
              retries: 0 
            });
          }
        });
      });

      // Evento authenticated
      wbot.on("authenticated", async (session: any) => {
        logger.info(`Session: ${sessionName} AUTHENTICATED`);
        
        try {
          await whatsapp.update({
            session: JSON.stringify(session),
            qrcode: "",
            status: "AUTHENTICATED"
          });
          
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
          
        } catch (error: any) {
          logger.error(`Error saving session: ${error}`);
        }
      });

      // Evento auth_failure
      wbot.on("auth_failure", async (msg: string) => {
        logger.error(`Authentication failure for ${sessionName}: ${msg}`);
        
        try {
          await whatsapp.update({
            status: "DISCONNECTED",
            session: "",
            qrcode: "",
            retries: (whatsapp.retries || 0) + 1
          });

          if ((whatsapp.retries || 0) > 2) {
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
        
        reject(new Error("Authentication failed"));
      });

      // Evento ready
      wbot.on("ready", async () => {
        logger.info(`Session: ${sessionName} READY`);

        try {
          await whatsapp.update({
            status: "CONNECTED",
            qrcode: "",
            retries: 0,
            number: wbot?.info?.wid?.user
          });

          io.emit(`${tenantId}:whatsappSession`, {
            action: "update",
            session: {
              id: whatsapp.id,
              name: whatsapp.name,
              status: "CONNECTED",
              qrcode: "",
              number: wbot?.info?.wid?.user
            }
          });

          const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
          if (sessionIndex === -1) {
            wbot.id = whatsapp.id;
            sessions.push(wbot);
          }

          wbot.sendPresenceAvailable();
          
          // Sincronização em background
          setImmediate(async () => {
            try {
              const info: any = wbot?.info;
              let wbotVersion: string = "";
              let wbotBrowser: string = "";
              
              try {
                wbotVersion = await wbot.getWWebVersion();
                wbotBrowser = await wbot.pupBrowser?.version() || "";
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

              // Sincronizar mensagens com delay
              setTimeout(async () => {
                try {
                  await SyncUnreadMessagesWbot(wbot, tenantId);
                } catch (error: any) {
                  // Tratar especificamente erros relacionados a participants
                  if (error.message && error.message.includes('participants')) {
                    logger.error(`WhatsApp participants error for ${whatsapp.id} - session may be unstable`);
                    logger.error('Consider restarting this WhatsApp session if the error persists');
                  } else if (error.message && error.message.includes('Evaluation failed')) {
                    logger.error(`Puppeteer evaluation failed for ${whatsapp.id} - WhatsApp Web interface issue`);
                  } else {
                    logger.warn(`Error syncing messages for ${whatsapp.id}: ${error.message}`);
                  }
                  
                  // Não fazer throw para evitar crash da aplicação
                }
              }, 5000);

            } catch (error: any) {
              logger.error(`Error updating additional info: ${error}`);
            }
          });
          
          resolve(wbot);
        } catch (error: any) {
          logger.error(`Error in ready event: ${error}`);
          reject(error);
        }
      });

      // Evento disconnected
      wbot.on("disconnected", async (reason: string) => {
        logger.info(`Session: ${sessionName} DISCONNECTED: ${reason}`);
        
        try {
          await whatsapp.update({
            status: "DISCONNECTED",
            qrcode: ""
          });

          removeWbot(whatsapp.id);

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

      // Timeout de segurança
      setTimeout(() => {
        if (whatsapp.status !== "CONNECTED" && whatsapp.status !== "AUTHENTICATED") {
          logger.warn(`Initialization timeout for whatsapp ${whatsapp.id}`);
          reject(new Error("Initialization timeout"));
        }
      }, 45000);

    } catch (err: any) {
      logger.error(`initWbot error: ${err}`);
      reject(err);
    }
  });
};

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};