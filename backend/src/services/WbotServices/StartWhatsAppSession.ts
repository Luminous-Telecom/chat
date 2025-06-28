import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import {
  getBaileysSession,
  removeBaileysSession,
  initBaileys,
} from "../../libs/baileys";
import HandleBaileysMessage from "../BaileysServices/HandleBaileysMessage";
import { BaileysClient } from "../../types/baileys";
import { getIO } from "../../libs/socket";
import AppError from "../../errors/AppError";
import HandleMsgAck from "./helpers/HandleMsgAck";
import Message from "../../models/Message";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number,
  phoneNumber?: string
): Promise<void> => {
  try {
    // Verifica se já existe uma sessão ativa
    const existingSession = getBaileysSession(whatsapp.id);
    if (existingSession) {
      const state = (existingSession as any)?.connection;
      if (state === "open") {
        logger.info(
          `Session already exists and is connected for ${whatsapp.name}`
        );

        // Apenas adiciona os handlers que não estão no initBaileys
        setupAdditionalHandlers(existingSession, whatsapp);
        return;
      }
      // Remove a sessão antiga se não estiver ativa
      await removeBaileysSession(whatsapp.id);
    }

    // Inicializa nova sessão (já inclui handlers de conexão)
    const wbot = await initBaileys(whatsapp, phoneNumber);

    // Configura handlers adicionais específicos da aplicação
    setupAdditionalHandlers(wbot, whatsapp);

    // Configura handler para notificações WebSocket
    setupSocketNotifications(wbot, whatsapp);
  } catch (err) {
    logger.error(`Error starting WhatsApp session: ${err}`);
    throw new AppError(`Failed to start WhatsApp session: ${err.message}`, 500);
  }
};

// Função para configurar handlers adicionais que não estão no initBaileys
export const setupAdditionalHandlers = (
  wbot: BaileysClient,
  whatsapp: Whatsapp
): void => {
  // Remove listeners existentes para evitar duplicação
  wbot.ev.removeAllListeners("messages.upsert");
  wbot.ev.removeAllListeners("messages.update");

  // Handler para mensagens
  wbot.ev.on("messages.upsert", async (m: any) => {
    try {
      const { messages } = m;
      if (messages.length === 0) {
        return;
      }

      for (const msg of messages) {
        // Sempre ignorar mensagens de grupos - verificar ANTES de qualquer processamento
        const isGroup = msg.key?.remoteJid?.endsWith("@g.us");
        
        // Se é mensagem de grupo, pula completamente
        if (isGroup) {
          continue; // Não processa, não loga, ignora totalmente
        }

        await HandleBaileysMessage(msg, wbot);
      }
    } catch (err) {
      logger.error(`[setupAdditionalHandlers] Error handling message for ${whatsapp.name}:`, err);
    }
  });

  // Handler para atualizações de mensagens (leitura, entrega, etc.)
  wbot.ev.on("messages.update", async (messageUpdate: any) => {
    try {
      if (!Array.isArray(messageUpdate)) {
        return;
      }

      for (const update of messageUpdate) {
        if (update.key && typeof update.update === "object") {
          // Sempre ignorar updates de mensagens de grupos
          const isGroup = update.key?.remoteJid?.endsWith("@g.us");
          
          // Se é update de mensagem de grupo, pula completamente
          if (isGroup) {
            continue; // Não processa ACKs de grupos
          }

          const messageId = update.key.id;
          const updateData = update.update;

          // Determina o novo ACK baseado no update recebido
          let newAck = null;

          // Processa ACK direto se presente
          if (updateData.ack !== undefined) {
            newAck = updateData.ack;
          // eslint-disable-next-line brace-style
          }
          // Processa status e converte para ACK
          else if (updateData.status !== undefined) {
            const statusToAck = {
              1: 0, // Pending -> ACK 0
              2: 1, // Sent -> ACK 1
              3: 2, // Delivered -> ACK 2
              4: 3, // Read -> ACK 3
            };

            newAck = statusToAck[updateData.status] ?? updateData.status;
          }

          // Se não há ACK para processar, continua
          if (newAck === null) {
            continue;
          }

          // CORREÇÃO CRÍTICA: Sempre chamar HandleMsgAck para que ele decida se é campanha ou mensagem regular
          // O HandleMsgAck vai verificar primeiro se é uma mensagem de campanha e depois mensagem regular
          await HandleMsgAck(
            {
              key: update.key,
              ...update,
            },
            newAck
          );

          // Busca a mensagem regular para lógica adicional (apenas se necessário)
          const currentMessage = await Message.findOne({
            where: {
              [Op.or]: [
                { messageId },
                { messageId: messageId?.toString() },
                { messageId: messageId?.toLowerCase() },
                { messageId: messageId?.toUpperCase() },
              ],
              fromMe: true,
              isDeleted: false,
            },
            order: [["createdAt", "DESC"]],
            lock: true,
          });

          // Se encontrou mensagem regular e o ACK pula de 1 para 3, processar intermediário
          if (currentMessage && currentMessage.ack === 1 && newAck === 3) {
            
            // Primeiro processa ACK 2 (delivered)
            await HandleMsgAck(
              {
                key: update.key,
                ...update,
              },
              2
            );

            // Aguarda um pouco para garantir que o frontend processe o ACK 2
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
    } catch (err) {
      logger.error(`[messages.update] Error processing message update: ${err}`);
    }
  });

  // Handler para atualizações de contatos
  wbot.ev.on("contacts.update", async (contactUpdate: any) => {
    try {
      // Aqui você pode sincronizar contatos
    } catch (err) {
      logger.error(
        `[ERROR] Error handling contacts update for ${whatsapp.name}:`,
        err
      );
    }
  });

  // Handler para atualizações de chats
  wbot.ev.on("chats.update", async (chatUpdate: any) => {
    try {
      // Aqui você pode sincronizar chats
    } catch (err) {
      // logger.error(`Error handling chats update for ${whatsapp.name}: ${err}`);
    }
  });
};

// Função para configurar notificações WebSocket
const setupSocketNotifications = (
  wbot: BaileysClient,
  whatsapp: Whatsapp
): void => {
  const io = getIO();

  // Handler para mudanças de conexão (para notificar o frontend)
  wbot.ev.on("connection.update", async ({ connection, qr }) => {
    try {
      // Recarrega dados atualizados do banco
      await whatsapp.reload();

      // Notifica o frontend sobre mudanças de status
      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
        action: "update",
        session: {
          id: whatsapp.id,
          name: whatsapp.name,
          status: whatsapp.status,
          qrcode: whatsapp.qrcode,
          isDefault: whatsapp.isDefault,
          tenantId: whatsapp.tenantId,
        },
      });

      // Log específico para cada estado
      if (qr) {
        logger.info(
          `QR Code generated for ${whatsapp.name} - notified frontend`
        );
      } else if (connection === "open") {
        logger.info(`Session ${whatsapp.name} connected - notified frontend`);
      } else if (connection === "close") {
        logger.info(
          `Session ${whatsapp.name} disconnected - notified frontend`
        );
      }
    } catch (err) {
      logger.error(`Error notifying frontend for ${whatsapp.name}: ${err}`);
    }
  });
};

// Função para parar uma sessão
export const StopWhatsAppSession = async (
  whatsappId: number
): Promise<void> => {
  try {
    logger.info(`Stopping WhatsApp session for ID: ${whatsappId}`);
    await removeBaileysSession(whatsappId);

    // Atualiza status no banco
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (whatsapp) {
      await whatsapp.update({
        status: "DISCONNECTED",
        qrcode: undefined,
        retries: 0,
      });

      // Notifica frontend
      const io = getIO();
      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
        action: "update",
        session: whatsapp,
      });
    }

    logger.info(`WhatsApp session stopped for ID: ${whatsappId}`);
  } catch (err) {
    logger.error(`Error stopping WhatsApp session ${whatsappId}: ${err}`);
    throw new AppError(`Failed to stop WhatsApp session: ${err.message}`, 500);
  }
};

// Função para reiniciar uma sessão
export const RestartWhatsAppSession = async (
  whatsappId: number,
  companyId: number
): Promise<void> => {
  try {
    logger.info(`Restarting WhatsApp session for ID: ${whatsappId}`);

    // Para a sessão atual
    await StopWhatsAppSession(whatsappId);

    // Aguarda um pouco para garantir limpeza
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Busca dados atualizados e reinicia
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("WhatsApp instance not found", 404);
    }

    await StartWhatsAppSession(whatsapp, companyId);

    logger.info(`WhatsApp session restarted for ID: ${whatsappId}`);
  } catch (err) {
    logger.error(`Error restarting WhatsApp session ${whatsappId}: ${err}`);
    throw err;
  }
};

// Função para verificar status da sessão
export const GetSessionStatus = (
  whatsappId: number
): {
  exists: boolean;
  connected: boolean;
  connectionState?: string;
} => {
  const session = getBaileysSession(whatsappId);

  if (!session) {
    return { exists: false, connected: false };
  }

  const connectionState = (session as any)?.connection;

  return {
    exists: true,
    connected: connectionState === "open",
    connectionState,
  };
};
