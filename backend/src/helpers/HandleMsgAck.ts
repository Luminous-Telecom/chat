import { WASocket } from "@whiskeysockets/baileys";
import Message from "../models/Message";
import { logger } from "../utils/logger";

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
  timestamp: number;
}

const HandleMsgAck = async (msg: InternalMessage, receipt: any): Promise<void> => {
  try {
    const message = await Message.findOne({
      where: { messageId: msg.key.id }
    });

    if (!message) {
      logger.info(`Message not found for ack: ${msg.key.id}`);
      return;
    }

    await message.update({
      ack: msg.ack,
      read: msg.ack === 2
    });

  } catch (err) {
    logger.error(`Error handling message ack: ${err}`);
  }
};

export default HandleMsgAck; 