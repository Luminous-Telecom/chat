import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { getBaileysSession, removeBaileysSession, initBaileys } from "../../libs/baileys";
import HandleBaileysMessage from "../BaileysServices/HandleBaileysMessage";
import { BaileysClient } from "../../types/baileys";
import { getIO } from "../../libs/socket";
import AppError from "../../errors/AppError";
import HandleMsgAck from "./helpers/HandleMsgAck";
import Message from "../../models/Message";
import { Op } from "sequelize";

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
export const setupAdditionalHandlers = (wbot: BaileysClient, whatsapp: Whatsapp): void => {
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
    logger.info(`[messages.update] Received update: ${JSON.stringify(messageUpdate, null, 2)}`);
    
    if (!Array.isArray(messageUpdate)) {
      logger.info(`[messages.update] Update is not an array, ignoring`);
      return;
    }

    for (const update of messageUpdate) {
      logger.info(`[messages.update] Processing update: ${JSON.stringify(update, null, 2)}`);
      
      if (update.key && typeof update.update === 'object') {
        const messageId = update.key.id;
        const updateData = update.update;
        
        logger.info(`[messages.update] Message ID: ${messageId}, Update: ${JSON.stringify(updateData, null, 2)}`);

        // Busca a mensagem atual para verificar o ACK
        let currentMessage = await Message.findOne({
          where: {
            [Op.or]: [
              { messageId: messageId },
              { messageId: messageId?.toString() },
              { messageId: messageId?.toLowerCase() },
              { messageId: messageId?.toUpperCase() }
            ],
            fromMe: true,
            isDeleted: false
          },
          order: [['createdAt', 'DESC']],
          lock: true
        });

        if (!currentMessage) {
          logger.warn(`[messages.update] No message found for ID ${messageId}, searching in recent messages...`);
          
          // Busca em mensagens recentes (últimas 5 minutos)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const recentMessage = await Message.findOne({
            where: {
              fromMe: true,
              isDeleted: false,
              createdAt: {
                [Op.gte]: fiveMinutesAgo
              },
              // Não atualiza se já tiver um messageId e for diferente
              [Op.or]: [
                { messageId: null },
                { messageId: messageId },
                { messageId: messageId?.toString() },
                { messageId: messageId?.toLowerCase() },
                { messageId: messageId?.toUpperCase() }
              ]
            },
            order: [['createdAt', 'DESC']],
            lock: true
          });

          if (recentMessage) {
            // Se a mensagem já tem um messageId diferente, ignora a atualização
            if (recentMessage.messageId && recentMessage.messageId !== messageId) {
              logger.info(`[messages.update] Ignoring update for ID ${messageId} as message ${recentMessage.id} already has messageId ${recentMessage.messageId}`);
              continue;
            }

            logger.info(`[messages.update] Found recent message ${recentMessage.id} with messageId ${recentMessage.messageId}`);
            // Atualiza o messageId da mensagem recente
            await recentMessage.update({ messageId });
            logger.info(`[messages.update] Updated message ${recentMessage.id} with new messageId ${messageId}`);
            
            // Atualiza a referência da mensagem atual para continuar o processamento
            currentMessage = recentMessage;
            await currentMessage.reload();
            logger.info(`[messages.update] Message ${currentMessage.id} reloaded with current ACK ${currentMessage.ack}`);
          } else {
            logger.info(`[messages.update] No recent message found for ID ${messageId}, ignoring update`);
            continue;
          }
        }

        logger.info(`[messages.update] Found message ${currentMessage.id} with current ack ${currentMessage.ack} and messageId ${currentMessage.messageId}`);

        // Se a mensagem já tem um messageId diferente, ignora a atualização
        if (currentMessage.messageId && currentMessage.messageId !== messageId) {
          logger.info(`[messages.update] Ignoring update for ID ${messageId} as message ${currentMessage.id} already has messageId ${currentMessage.messageId}`);
          continue;
        }

        // Determina o novo ACK baseado no update recebido
        let newAck = null;

        // Processa ACK direto se presente
        if (updateData.ack !== undefined) {
          newAck = updateData.ack;
          logger.info(`[messages.update] Direct ACK received: ${newAck}`);
        }
        // Processa status e converte para ACK
        else if (updateData.status !== undefined) {
          const statusToAck = {
            1: 0,  // Pending -> ACK 0
            2: 1,  // Sent -> ACK 1
            3: 2,  // Delivered -> ACK 2
            4: 3   // Read -> ACK 3
          };
          
          newAck = statusToAck[updateData.status] ?? updateData.status;
          logger.info(`[messages.update] Status ${updateData.status} converted to ACK ${newAck}`);
        }

        // Se não há ACK para processar, continua
        if (newAck === null) {
          logger.info(`[messages.update] No ACK or status to process for message ${messageId}`);
          continue;
        }

        // Verifica se o novo ACK é válido (não regressivo)
        if (currentMessage.ack >= newAck) {
          logger.info(`[messages.update] Ignoring ACK ${newAck} for message ${messageId} as current ACK ${currentMessage.ack} is higher or equal`);
          continue;
        }

        // CORREÇÃO PRINCIPAL: Processa ACKs intermediários para arquivos de mídia
        // Se pular diretamente de ACK 1 para ACK 3, processa primeiro o ACK 2
        if (currentMessage.ack === 1 && newAck === 3) {
          logger.info(`[messages.update] Message ${messageId} jumping from ACK 1 to ACK 3, processing ACK 2 first`);
          
          // Primeiro processa ACK 2 (delivered)
          await HandleMsgAck({
            key: update.key,
            ...update
          }, 2);
          
          // Aguarda um pouco para garantir que o frontend processe o ACK 2
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Recarrega a mensagem para ter o ACK atualizado
          await currentMessage.reload();
          
          logger.info(`[messages.update] Processed intermediate ACK 2 for message ${messageId}, current ACK: ${currentMessage.ack}`);
        }

        // Agora processa o ACK final
        logger.info(`[messages.update] Processing final ACK ${newAck} for message ${messageId}`);
        await HandleMsgAck({
          key: update.key,
          ...update
        }, newAck);
        
        logger.info(`[messages.update] Successfully processed ACK ${newAck} for message ${messageId}`);
      }
    }
  } catch (err) {
    logger.error(`[messages.update] Error processing update: ${err}`);
    logger.error(`[messages.update] Error stack: ${err.stack}`);
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