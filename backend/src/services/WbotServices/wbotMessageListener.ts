import { getBaileys } from "../../libs/baileys";
import { logger } from "../../utils/logger";
import { WASocket, proto, WAMessage, WACallEvent } from "@whiskeysockets/baileys";
import HandleMessage from "../../helpers/HandleMessage";
import HandleMsgAck from "../../helpers/HandleMsgAck";
import VerifyCall from "../../helpers/VerifyCall";
import Ticket from "../../models/Ticket";

interface Session extends WASocket {
  id: number;
  tenantId: number;
}

interface InternalMessage {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  body: string;
  ack: number;
  deviceType: string;
  isStatus: boolean;
  broadcast: boolean;
  fromMe: boolean;
  hasMedia: boolean;
  mediaType?: "image" | "video" | "audio" | "document";
  mediaUrl?: string;
  mediaName?: string;
  timestamp: number;
}

interface InternalCall {
  id: string;
  timestamp: number;
  fromMe: boolean;
  status: string;
  deviceType: string;
  canHandleLocally: boolean;
  webClientShouldHandle: boolean;
  peerJid: string;
}

interface BaileysCall {
  id: string;
  status: "offer" | "ringing" | "timeout" | "reject" | "accept" | "end";
  from: string;
  timestamp: number;
}

const wbotMessageListener = (wbot: Session): void => {
  wbot.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type === "notify") {
      for (const msg of messages) {
        if (Boolean(msg.key.fromMe) || msg.key.remoteJid === "status@broadcast") {
          continue;
        }

        if (!msg.key.id) {
          logger.warn("Message without ID received, skipping...");
          continue;
        }

        const internalMessage: InternalMessage = {
          key: {
            id: msg.key.id,
            remoteJid: msg.key.remoteJid || "",
            fromMe: Boolean(msg.key.fromMe)
          },
          body: msg.message?.conversation || 
                msg.message?.extendedTextMessage?.text || 
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                msg.message?.documentMessage?.caption ||
                "",
          ack: 0,
          deviceType: "whatsapp",
          isStatus: false,
          broadcast: false,
          fromMe: Boolean(msg.key.fromMe),
          hasMedia: Boolean(
            msg.message?.imageMessage ||
            msg.message?.videoMessage ||
            msg.message?.audioMessage ||
            msg.message?.documentMessage
          ),
          mediaType: msg.message?.imageMessage ? "image" :
                    msg.message?.videoMessage ? "video" :
                    msg.message?.audioMessage ? "audio" :
                    msg.message?.documentMessage ? "document" :
                    undefined,
          mediaUrl: msg.message?.imageMessage?.url ||
                   msg.message?.videoMessage?.url ||
                   msg.message?.audioMessage?.url ||
                   msg.message?.documentMessage?.url || undefined,
          mediaName: msg.message?.documentMessage?.fileName || undefined,
          timestamp: Number(msg.messageTimestamp) || Date.now()
        };

        await HandleMessage(internalMessage, wbot);
      }
    }
  });

  wbot.ev.on("message-receipt.update", async (receipts) => {
    for (const receipt of receipts) {
      if (!receipt.key.id) {
        logger.warn("Receipt without ID received, skipping...");
        continue;
      }

      const internalMessage: InternalMessage = {
        key: {
          id: receipt.key.id,
          remoteJid: receipt.key.remoteJid || "",
          fromMe: Boolean(receipt.key.fromMe)
        },
        body: "",
        ack: receipt.receipt.receiptTimestamp ? 2 : 1,
        deviceType: "whatsapp",
        isStatus: false,
        broadcast: false,
        fromMe: Boolean(receipt.key.fromMe),
        hasMedia: false,
        timestamp: Number(receipt.receipt.receiptTimestamp) || Date.now()
      };

      await HandleMsgAck(internalMessage, receipt.receipt);
    }
  });

  wbot.ev.on("call", async (calls) => {
    for (const call of calls) {
      const ticket = await Ticket.findOne({
        where: {
          contact: {
            number: call.from.split("@")[0]
          },
          whatsappId: wbot.id
        }
      });

      if (!ticket) {
        logger.error("Ticket not found for call:", call);
        continue;
      }

      const baileysCall: BaileysCall = {
        id: call.id,
        status: call.status === "terminate" ? "end" : call.status,
        from: call.from,
        timestamp: Date.now()
      };

      await VerifyCall(baileysCall, ticket);
    }
  });
};

export default wbotMessageListener;
