import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { getBaileysSession, removeBaileysSession, initBaileys } from "../../libs/baileys";
import HandleBaileysMessage from "../BaileysServices/HandleBaileysMessage";
import { BaileysClient } from "../../types/baileys";
import { getIO } from "../../libs/socket";
import AppError from "../../errors/AppError";
import HandleMsgAck from "./helpers/HandleMsgAck";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  try {
    // Verifica se já existe uma sessão ativa
    const existingSession = getBaileysSession(whatsapp.id);
    if (existingSession) {
      const state = (existingSession as any)?.connection;
      if (state === 'open') {
        logger.info(`Session already exists and is connected for ${whatsapp.name}`);
        
        // Apenas adiciona os handlers que não estão no initBaileys
        setupAdditionalHandlers(existingSession, whatsapp);
        return;
      } else {
        // Remove a sessão antiga se não estiver ativa
        await removeBaileysSession(whatsapp.id);
      }
    }

    // Inicializa nova sessão (já inclui handlers de conexão)
    const wbot = await initBaileys(whatsapp);
    
    // Configura handlers adicionais específicos da aplicação
    setupAdditionalHandlers(wbot, whatsapp);
    
    // Configura handler para notificações WebSocket
    setupSocketNotifications(wbot, whatsapp);

    logger.info(`WhatsApp session service initialized for ${whatsapp.name}`);
  } catch (err) {
    logger.error(`Error starting WhatsApp session: ${err}`);
    throw new AppError(`Failed to start WhatsApp session: ${err.message}`, 500);
  }
};

// Função para configurar handlers adicionais que não estão no initBaileys
const setupAdditionalHandlers = (wbot: BaileysClient, whatsapp: Whatsapp): void => {
  // Remove listeners existentes para evitar duplicação
  wbot.ev.removeAllListeners('messages.upsert');
  wbot.ev.removeAllListeners('messages.update');
  
  // Handler para mensagens
  wbot.ev.on('messages.upsert', async (m: any) => {
    try {
      const messages = m.messages;
      if (messages.length === 0) {
        return;
      }

      for (const msg of messages) {
        await HandleBaileysMessage(msg, wbot);
      }
    } catch (err) {
      logger.error(`[DEBUG] Error handling message for ${whatsapp.name}:`, err);
    }
  });

  // Handler para atualizações de mensagens (leitura, entrega, etc.)
  wbot.ev.on('messages.update', async (messageUpdate: any) => {
    try {
      if (!Array.isArray(messageUpdate)) {
        return;
      }

      for (const update of messageUpdate) {

        if (update.key && typeof update.update === 'object') {
          const messageId = update.key.id;
          const messageUpdate = update.update;

          // Processa ACK se presente
          if (messageUpdate.ack !== undefined) {
            await HandleMsgAck({
              id: { id: messageId, _serialized: messageId },
              ...update
            }, messageUpdate.ack);
          }
          
          // Processa status se presente
          if (messageUpdate.status !== undefined) {
            
            // Mapeia status para ACK
            const statusToAck = {
              1: 0,  // Pending -> ACK 0
              2: 1,  // Sent -> ACK 1
              3: 2,  // Delivered -> ACK 2
              4: 3   // Read -> ACK 3
            };
            
            const ack = statusToAck[messageUpdate.status] ?? messageUpdate.status;
            
            await HandleMsgAck({
              id: { id: messageId, _serialized: messageId },
              ...update
            }, ack);
          }
        }
      }
    } catch (err) {
      logger.error(`[ERROR] Error handling message update for ${whatsapp.name}:`, err);
    }
  });

  // Handler para recibos de mensagem
  wbot.ev.on('message-receipt.update', async (receiptUpdate: any) => {
    try {
      if (!Array.isArray(receiptUpdate)) {
        return;
      }

      for (const receipt of receiptUpdate) {
        if (receipt.key && receipt.receipt) {

          // Se o recibo indica leitura, atualiza o ACK
          if (receipt.receipt.readTimestamp) {
            await HandleMsgAck({
              id: { id: receipt.key.id },
              ...receipt
            }, 3); // ACK 3 = lido
          }
        }
      }
    } catch (err) {
      logger.error(`[ERROR] Error handling receipt update for ${whatsapp.name}:`, err);
    }
  });

  // Handler para atualizações de contatos
  wbot.ev.on('contacts.update', async (contactUpdate: any) => {
    try {
      // Aqui você pode sincronizar contatos
    } catch (err) {
      logger.error(`[ERROR] Error handling contacts update for ${whatsapp.name}:`, err);
    }
  });

  // Handler para atualizações de chats
  wbot.ev.on('chats.update', async (chatUpdate: any) => {
    try {
      // Aqui você pode sincronizar chats
    } catch (err) {
      //logger.error(`Error handling chats update for ${whatsapp.name}: ${err}`);
    }
  });
};

// Função para configurar notificações WebSocket
const setupSocketNotifications = (wbot: BaileysClient, whatsapp: Whatsapp): void => {
  const io = getIO();

  // Handler para mudanças de conexão (para notificar o frontend)
  wbot.ev.on('connection.update', async ({ connection, qr }) => {
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
          tenantId: whatsapp.tenantId
        }
      });

      // Log específico para cada estado
      if (qr) {
        logger.info(`QR Code generated for ${whatsapp.name} - notified frontend`);
      } else if (connection === 'open') {
        logger.info(`Session ${whatsapp.name} connected - notified frontend`);
      } else if (connection === 'close') {
        logger.info(`Session ${whatsapp.name} disconnected - notified frontend`);
      }
    } catch (err) {
      logger.error(`Error notifying frontend for ${whatsapp.name}: ${err}`);
    }
  });
};

// Função para parar uma sessão
export const StopWhatsAppSession = async (whatsappId: number): Promise<void> => {
  try {
    logger.info(`Stopping WhatsApp session for ID: ${whatsappId}`);
    await removeBaileysSession(whatsappId);
    
    // Atualiza status no banco
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (whatsapp) {
      await whatsapp.update({
        status: "DISCONNECTED",
        qrcode: null,
        retries: 0
      });

      // Notifica frontend
      const io = getIO();
      io.emit(`${whatsapp.tenantId}:whatsappSession`, {
        action: "update",
        session: whatsapp
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
export const GetSessionStatus = (whatsappId: number): {
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
    connected: connectionState === 'open',
    connectionState
  };
};