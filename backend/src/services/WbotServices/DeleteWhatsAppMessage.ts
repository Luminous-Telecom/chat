import AppError from "../../errors/AppError";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { StartWhatsAppSessionVerify } from "./StartWhatsAppSessionVerify";
import { getIO } from "../../libs/socket";
import { getBaileys } from "../../libs/baileys";

const DeleteWhatsAppMessage = async (
  id: string,
  messageId: string,
  tenantId: string | number
): Promise<void> => {
  if (!messageId || messageId === "null") {
    await Message.update(
      {
        isDeleted: true,
        status: "canceled"
      },
      { where: { id } }
    );
    const message = await Message.findByPk(id, {
      include: [
        {
          model: Ticket,
          as: "ticket",
          include: ["contact"],
          where: { tenantId }
        }
      ]
    });
    if (message) {
      const io = getIO();
      // .to(`tenant:${tenantId}:notification`)
      io.to(`tenant:${tenantId}:${message.ticket.id}`).emit(
        `tenant:${tenantId}:appMessage`,
        {
          action: "update",
          message,
          ticket: message.ticket,
          contact: message.ticket.contact
        }
      );
    }
    return;
  }
  const message = await Message.findOne({
    where: { messageId },
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact"],
        where: { tenantId }
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  const { ticket } = message;
  const wbot = getBaileys(ticket.whatsappId);

  if (!wbot) {
    throw new AppError("ERR_NO_WHATSAPP_SESSION");
  }

  try {
    await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g" : "s"}.whatsapp.net`,
      {
        delete: {
          id: messageId,
          fromMe: true
        }
      }
    );
  } catch (err) {
    // StartWhatsAppSessionVerify(ticket.whatsappId, err);
    throw new AppError("ERR_DELETE_WAPP_MSG");
  }

  await message.update({ isDeleted: true });

  const io = getIO();
  // .to(`tenant:${tenantId}:notification`)
  io.to(`tenant:${tenantId}:${message.ticket.id}`).emit(
    `tenant:${tenantId}:appMessage`,
    {
      action: "update",
      message,
      contact: ticket.contact
    }
  );
};

export default DeleteWhatsAppMessage;
