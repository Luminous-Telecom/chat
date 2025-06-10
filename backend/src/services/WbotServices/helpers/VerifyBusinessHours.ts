import { proto } from "@whiskeysockets/baileys";
import socketEmit from "../../../helpers/socketEmit";
import Setting from "../../../models/Setting";
import Ticket from "../../../models/Ticket";
import CreateMessageSystemService from "../../MessageServices/CreateMessageSystemService";
import CreateLogTicketService from "../../TicketServices/CreateLogTicketService";

const verifyBusinessHours = async (
  msg: proto.IWebMessageInfo,
  ticket: Ticket
): Promise<boolean> => {
  const settings = await Setting.findOne({
    where: {
      key: "businessHours",
      tenantId: ticket.tenantId
    }
  });

  if (!settings?.value) {
    return true;
  }

  const businessHours = JSON.parse(settings.value);
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();

  const dayConfig = businessHours[currentDay];
  if (!dayConfig || !dayConfig.enabled) {
    if (!msg.key.fromMe) {
      const messageData = {
        body: "Fora do horário de atendimento. Por favor, retorne em horário comercial.",
        fromMe: true,
        read: true,
        sendType: "bot"
      };

      await CreateMessageSystemService({
        msg: messageData,
        tenantId: ticket.tenantId,
        ticket,
        sendType: messageData.sendType,
        status: "pending"
      });

      await ticket.update({
        status: "closed",
        unreadMessages: 0
      });

      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "closed"
      });

      socketEmit({
        tenantId: ticket.tenantId,
        type: "ticket:update",
        payload: ticket
      });
    }
    return false;
  }

  const [startHour, startMinutes] = dayConfig.start.split(":").map(Number);
  const [endHour, endMinutes] = dayConfig.end.split(":").map(Number);

  const currentTimeInMinutes = currentHour * 60 + currentMinutes;
  const startTimeInMinutes = startHour * 60 + startMinutes;
  const endTimeInMinutes = endHour * 60 + endMinutes;

  if (
    currentTimeInMinutes < startTimeInMinutes ||
    currentTimeInMinutes > endTimeInMinutes
  ) {
    if (!msg.key.fromMe) {
      const messageData = {
        body: "Fora do horário de atendimento. Por favor, retorne em horário comercial.",
        fromMe: true,
        read: true,
        sendType: "bot"
      };

      await CreateMessageSystemService({
        msg: messageData,
        tenantId: ticket.tenantId,
        ticket,
        sendType: messageData.sendType,
        status: "pending"
      });

      await ticket.update({
        status: "closed",
        unreadMessages: 0
      });

      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "closed"
      });

      socketEmit({
        tenantId: ticket.tenantId,
        type: "ticket:update",
        payload: ticket
      });
    }
    return false;
  }

  return true;
};

export default verifyBusinessHours;
