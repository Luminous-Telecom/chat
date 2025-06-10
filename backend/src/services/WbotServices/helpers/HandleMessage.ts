import { WASocket, proto } from "@whiskeysockets/baileys";
import Contact from "../../../models/Contact";
import { logger } from "../../../utils/logger";
import FindOrCreateTicketService from "../../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../../WhatsappService/ShowWhatsAppService";
import IsValidMsg from "./IsValidMsg";
import VerifyContact from "./VerifyContact";
import VerifyMediaMessage from "./VerifyMediaMessage";
import VerifyMessage from "./VerifyMessage";
import verifyBusinessHours from "./VerifyBusinessHours";
import VerifyStepsChatFlowTicket from "../../ChatFlowServices/VerifyStepsChatFlowTicket";
import Queue from "../../../libs/Queue";
import Setting from "../../../models/Setting";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

interface InternalMessage {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
    participant?: string;
  };
  message?: proto.IMessage;
  messageTimestamp?: number;
  pushName?: string;
  status?: number;
}

interface IMe {
  id: {
    server: string;
    user: string;
  };
  pushname: string;
}

// Função para verificar se a sessão está saudável
const isSessionHealthy = (wbot: Session): boolean => {
  try {
    return !!(wbot && wbot.user && wbot.user.id);
  } catch (error) {
    return false;
  }
};

// Função para executar operações com timeout e retry
const executeWithTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number = 10000,
  operationName: string = 'operation'
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout in ${operationName} after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } catch (error: any) {
    logger.warn(`Error in ${operationName}: ${error.message}`);
    throw error;
  }
};

// Função para verificar se o erro é recuperável
const isRecoverableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  const recoverablePatterns = [
    'evaluation failed',
    'minified invariant', 
    'protocol error',
    'target closed',
    'navigation',
    'timeout',
    'cannot read properties of undefined',
    'participants'
  ];
  
  return recoverablePatterns.some(pattern => message.includes(pattern));
};

const HandleMessage = async (msg: proto.IWebMessageInfo, wbot: Session): Promise<void> => {
  if (!IsValidMsg(msg)) return;

  try {
    let msgContact: IMe;
    let groupContact: Contact | undefined;

    if (msg.key.remoteJid === "status@broadcast") {
      msgContact = {
        id: {
          server: "c.us",
          user: msg.key.participant || msg.key.remoteJid || ""
        },
        pushname: msg.pushName || ""
      };
    } else {
      const msgKey = msg.key.remoteJid || msg.key.participant || "";
      msgContact = {
        id: {
          server: msgKey.endsWith("@g.us") ? "g.us" : "c.us",
          user: msgKey.split("@")[0]
        },
        pushname: msg.pushName || ""
      };
    }

    if (msg.key.remoteJid?.endsWith("@g.us")) {
      const groupData = await wbot.groupMetadata(msg.key.remoteJid);
      groupContact = await VerifyContact({
        name: groupData.subject,
        number: msg.key.remoteJid,
        isGroup: true,
        tenantId: wbot.tenantId,
        pushname: groupData.subject,
        isUser: false,
        isWAContact: true,
        origem: "whatsapp"
      });
    }

    const contact = await VerifyContact({
      name: msgContact.pushname || msgContact.id.user,
      number: msgContact.id.user,
      isGroup: msgContact.id.server === "g.us",
      tenantId: wbot.tenantId,
      pushname: msgContact.pushname,
      isUser: false,
      isWAContact: true,
      origem: "whatsapp"
    });

    const unreadMessages = msg.key.fromMe ? 0 : 1;

    const ticket = await FindOrCreateTicketService({
      contact,
      whatsappId: wbot.id,
      unreadMessages,
      tenantId: wbot.tenantId,
      groupContact,
      msg,
      channel: "whatsapp"
    });

    const hasMedia = Boolean(
      msg.message?.imageMessage ||
      msg.message?.videoMessage ||
      msg.message?.audioMessage ||
      msg.message?.documentMessage ||
      msg.message?.stickerMessage
    );

    if (hasMedia) {
      await VerifyMediaMessage({ msg, ticket, contact });
    } else {
      await VerifyMessage({ msg, ticket, contact });
    }

    // Verificar horário comercial
    const isBusinessHours = await verifyBusinessHours(msg as any, ticket);

    if (!isBusinessHours && !msg.key.fromMe) {
      const setting = await Setting.findOne({
        where: {
          key: "chatBotType",
          tenantId: ticket.tenantId
        }
      });

      if (setting?.value === "queue") {
        await ticket.update({ status: "pending" });
        await ticket.reload();
      }
    }

    // Verificar fluxo de chatbot
    if (!msg.key.fromMe && ticket.status === "pending") {
      await VerifyStepsChatFlowTicket(msg, ticket);
    }

  } catch (err) {
    logger.error("Error handling message:", err);
  }
};

export default HandleMessage;