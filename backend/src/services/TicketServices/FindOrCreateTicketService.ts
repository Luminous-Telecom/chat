// import { subHours } from "date-fns";
import { Op } from "sequelize";

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ShowTicketService from "./ShowTicketService";
import CampaignContacts from "../../models/CampaignContacts";
import socketEmit from "../../helpers/socketEmit";
// import CheckChatBotWelcome from "../../helpers/CheckChatBotWelcome";
import CheckChatBotFlowWelcome from "../../helpers/CheckChatBotFlowWelcome";
import CreateLogTicketService from "./CreateLogTicketService";
import MessageModel from "../../models/Message";
import ListSettingsService from "../SettingServices/ListSettingsService";

interface Data {
  contact: Contact;
  whatsappId: number;
  unreadMessages: number;
  tenantId: number | string;
  groupContact?: Contact;
  msg?: WbotMessage | any;
  isSync?: boolean;
  channel: string;
}

const FindOrCreateTicketService = async ({
  contact,
  whatsappId,
  unreadMessages,
  tenantId,
  groupContact,
  msg,
  isSync,
  channel,
}: Data): Promise<Ticket | any> => {
  // se for uma mensagem de campanha, não abrir tícket
  if (msg && msg.fromMe) {
    const msgCampaign = await CampaignContacts.findOne({
      where: {
        contactId: contact.id,
        messageId: msg.id?.id || msg.message_id || msg.item_id,
      },
    });
    if (msgCampaign?.id) {
      return { isCampaignMessage: true };
    }
  }

  if (msg && msg.fromMe) {
    const farewellMessage = await MessageModel.findOne({
      where: { messageId: msg.id?.id || msg.message_id || msg.item_id },
      include: ["ticket"],
    });

    if (
      farewellMessage?.ticket?.status === "closed" &&
      farewellMessage?.ticket.lastMessage === msg.body
    ) {
      const ticket = farewellMessage.ticket as any;
      ticket.isFarewellMessage = true;
      return ticket;
    }
  }

  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"],
      },
      tenantId,
      whatsappId,
      contactId: groupContact ? groupContact.id : contact.id,
    },
    include: [
      {
        model: Contact,
        as: "contact",
        include: [
          "extraInfo",
          "tags",

        ],
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"],
      },
      {
        association: "whatsapp",
        attributes: ["id", "name"],
      },
    ],
  });

  if (ticket) {
    // Para todos os canais, usar o valor calculado de unreadMessages
    // que já considera as mensagens não lidas existentes + nova mensagem
    await ticket.update({ unreadMessages: unreadMessages });
    socketEmit({
      tenantId,
      type: "ticket:update",
      payload: ticket,
    });
    return ticket;
  }

  if (groupContact) {
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id,
        tenantId,
        whatsappId,
      },
      order: [["updatedAt", "DESC"]],
      include: [
        {
          model: Contact,
          as: "contact",
          include: [
            "extraInfo",
            "tags",

          ],
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name"],
        },
        {
          association: "whatsapp",
          attributes: ["id", "name"],
        },
      ],
    });

    if (ticket) {
      await ticket.update({
        status: "pending",
        userId: undefined,
        unreadMessages,
      });

      socketEmit({
        tenantId,
        type: "ticket:update",
        payload: ticket,
      });

      return ticket;
    }
  } else {
    ticket = await Ticket.findOne({
      where: {
        // updatedAt: {
        //   [Op.between]: [+subHours(new Date(), 24), +new Date()]
        // },
        status: {
          [Op.in]: ["open", "pending"],
        },
        tenantId,
        whatsappId,
        contactId: contact.id,
      },
      order: [["updatedAt", "DESC"]],
      include: [
        {
          model: Contact,
          as: "contact",
          include: [
            "extraInfo",
            "tags",

          ],
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name"],
        },
        {
          association: "whatsapp",
          attributes: ["id", "name"],
        },
      ],
    });

    if (ticket) {
      await ticket.update({
        status: "pending",
        userId: undefined,
        unreadMessages,
      });

      socketEmit({
        tenantId,
        type: "ticket:update",
        payload: ticket,
      });

      return ticket;
    }
  }



  const ticketObj: any = {
    contactId: groupContact ? groupContact.id : contact.id,
    status: "pending",
    isGroup: !!groupContact,
    unreadMessages,
    whatsappId,
    tenantId,
    channel,
  };



  const ticketCreated = await Ticket.create(ticketObj);

  await CreateLogTicketService({
    ticketId: ticketCreated.id,
    type: "create",
  });

  if ((msg && !msg.fromMe) || !ticketCreated.userId || isSync) {
    await CheckChatBotFlowWelcome(ticketCreated);
  }

  ticket = await ShowTicketService({ id: ticketCreated.id, tenantId });
  ticket.setDataValue("isCreated", true);

  socketEmit({
    tenantId,
    type: "ticket:update",
    payload: ticket,
  });

  return ticket;
};

export default FindOrCreateTicketService;
