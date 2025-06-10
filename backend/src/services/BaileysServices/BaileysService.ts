import { WASocket } from "@whiskeysockets/baileys";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";

const sessions: { [key: number]: WASocket } = {};

export const getBaileys = (whatsappId: number): WASocket | null => {
  try {
    const session = sessions[whatsappId];
    if (!session) {
      logger.error(`No Baileys session found for whatsapp ${whatsappId}`);
      return null;
    }
    return session;
  } catch (err) {
    logger.error(`Error getting Baileys session: ${err}`);
    return null;
  }
};

export const setBaileys = (whatsappId: number, session: WASocket): void => {
  try {
    sessions[whatsappId] = session;
    const io = getIO();
    io.emit("whatsappSession", {
      action: "update",
      session: {
        whatsappId,
        status: session.user ? "CONNECTED" : "DISCONNECTED"
      }
    });
  } catch (err) {
    logger.error(`Error setting Baileys session: ${err}`);
  }
};

export const removeBaileys = (whatsappId: number): void => {
  try {
    delete sessions[whatsappId];
    const io = getIO();
    io.emit("whatsappSession", {
      action: "update",
      session: {
        whatsappId,
        status: "DISCONNECTED"
      }
    });
  } catch (err) {
    logger.error(`Error removing Baileys session: ${err}`);
  }
};

export const getBaileysSessions = (): { [key: number]: WASocket } => {
  return sessions;
}; 