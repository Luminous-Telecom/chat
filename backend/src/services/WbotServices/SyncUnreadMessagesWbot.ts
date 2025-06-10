import { logger } from "../../utils/logger";
import { BaileysClient } from "../../types/baileys";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import { BaileysMessageAdapter } from "../BaileysServices/BaileysMessageAdapter";

const SyncUnreadMessagesWbot = async (wbot: BaileysClient, tenantId: number): Promise<void> => {
  try {
    // Since fetchUnreadMessages is not available in the current version,
    // we'll use a different approach to sync messages
    const messages = await Message.findAll({
      where: {
        tenantId,
        read: false,
        fromMe: false
      },
      include: [
        {
          model: Ticket,
          as: "ticket",
          where: { tenantId },
          include: ["contact"]
        }
      ]
    });

    for (const message of messages) {
      const ticket = message.ticket;
      if (!ticket) continue;

      const io = getIO();
      io.to(`${tenantId}-${ticket.id.toString()}`).emit(`${tenantId}-appMessage`, {
        action: "create",
        message: message.toJSON()
      });

      await message.update({ read: true });
    }

    logger.info(`Synced ${messages.length} unread messages for tenant ${tenantId}`);
  } catch (err) {
    logger.error(`Error syncing unread messages: ${err}`);
  }
};

export default SyncUnreadMessagesWbot;
