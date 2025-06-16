import AppError from "../../errors/AppError";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { StartWhatsAppSessionVerify } from "./StartWhatsAppSessionVerify";
import { getIO } from "../../libs/socket";
import GetTicketWbot from "../../helpers/GetTicketWbot";

const DeleteWhatsAppMessage = async (
  id: string,
  messageId: string,
  tenantId: string | number
): Promise<void> => {
  if (!messageId || messageId === "null") {
    await Message.update(
      {
        isDeleted: true,
        status: "canceled",
      },
      { where: { id } }
    );
    const message = await Message.findByPk(id, {
      include: [
        {
          model: Ticket,
          as: "ticket",
          include: ["contact"],
          where: { tenantId },
        },
      ],
    });
    if (message) {
      const io = getIO();
      // Emitir diretamente para o canal que o frontend está escutando
      io.emit(`tenant:${tenantId}:appMessage`, {
        action: "update",
        message,
        ticket: message.ticket,
        contact: message.ticket.contact,
      });

      // Também emitir para o canal específico para compatibilidade
      io.to(`tenant:${tenantId}:${message.ticket.id}`).emit(
        `tenant:${tenantId}:appMessage`,
        {
          action: "update",
          message,
          ticket: message.ticket,
          contact: message.ticket.contact,
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
        where: { tenantId },
      },
    ],
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  const { ticket } = message;

  const session = await GetTicketWbot(ticket);
  const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

  const messageToDelete = await GetWbotMessage(ticket, messageId);

  try {
    if (!messageToDelete) {
      throw new AppError("ERROR_NOT_FOUND_MESSAGE");
    }
    await (session as any).sendMessage(chatId, {
      protocolMessage: {
        type: 0, // 0 = message deletion
        key: messageToDelete.key,
      },
    });
  } catch (err) {
    // StartWhatsAppSessionVerify(ticket.whatsappId, err);
    throw new AppError("ERR_DELETE_WAPP_MSG");
  }

  await message.update({ isDeleted: true });

  const io = getIO();
  // Emitir diretamente para o canal que o frontend está escutando
  io.emit(`tenant:${tenantId}:appMessage`, {
    action: "update",
    message,
    contact: ticket.contact,
  });

  // Também emitir para o canal específico para compatibilidade
  io.to(`tenant:${tenantId}:${message.ticket.id}`).emit(
    `tenant:${tenantId}:appMessage`,
    {
      action: "update",
      message,
      contact: ticket.contact,
    }
  );
};

export default DeleteWhatsAppMessage;
