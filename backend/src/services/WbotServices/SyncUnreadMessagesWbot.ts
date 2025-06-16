import { logger } from "../../utils/logger";
import { BaileysClient } from "../../types/baileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import { BaileysMessageAdapter } from "../BaileysServices/BaileysMessageAdapter";

const SyncUnreadMessagesWbot = async (
  wbot: BaileysClient,
  tenantId: number
): Promise<void> => {
  try {
    // Removida a sincronização automática de mensagens não lidas
    // para evitar marcação automática ao abrir o sistema
    logger.info(`SyncUnreadMessagesWbot disabled for tenant ${tenantId}`);
  } catch (err) {
    logger.error(`Error in SyncUnreadMessagesWbot: ${err}`);
  }
};

export default SyncUnreadMessagesWbot;
