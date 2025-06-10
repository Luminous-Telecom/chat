import { proto } from "@whiskeysockets/baileys";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import CreateMessageService from "../../MessageServices/CreateMessageService";
import { getMessageBody } from "../../../utils/messages";

interface Request {
  msg: proto.IWebMessageInfo;
  ticket: Ticket;
  contact: Contact;
}

const VerifyMessage = async ({
  msg,
  ticket,
  contact
}: Request): Promise<Message | null> => {
  if (!msg.message) return null;

  const messageBody = getMessageBody(msg);
  if (!messageBody) return null;

  const messageData = {
    messageId: msg.key.id || "",
    ticketId: ticket.id,
    contactId: contact.id,
    body: messageBody,
    fromMe: msg.key.fromMe || false,
    read: msg.key.fromMe || false,
    mediaType: "chat",
    ack: msg.status
  };

  await ticket.update({
    lastMessage: messageBody
  });

  return CreateMessageService({ messageData, tenantId: ticket.tenantId });
};

export default VerifyMessage;
