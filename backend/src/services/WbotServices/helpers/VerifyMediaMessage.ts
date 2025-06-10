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

const VerifyMediaMessage = async ({
  msg,
  ticket,
  contact
}: Request): Promise<Message | null> => {
  if (!msg.message) return null;

  const messageBody = getMessageBody(msg);
  let messageType: string | null = null;
  let mediaData: any = null;

  if (msg.message.imageMessage) {
    messageType = "image";
    mediaData = msg.message.imageMessage;
  } else if (msg.message.videoMessage) {
    messageType = "video";
    mediaData = msg.message.videoMessage;
  } else if (msg.message.audioMessage) {
    messageType = "audio";
    mediaData = msg.message.audioMessage;
  } else if (msg.message.documentMessage) {
    messageType = "document";
    mediaData = msg.message.documentMessage;
  }

  if (!messageType || !mediaData) {
    return null;
  }

  const messageData = {
    messageId: msg.key.id || "",
    ticketId: ticket.id,
    contactId: contact.id,
    body: messageBody,
    fromMe: msg.key.fromMe || false,
    read: msg.key.fromMe || false,
    mediaType: messageType,
    mediaUrl: mediaData.url || "",
    ack: msg.status,
    dataJson: JSON.stringify({
      messageType,
      mediaKey: mediaData.mediaKey,
      mimetype: mediaData.mimetype,
      fileName: mediaData.fileName,
      caption: mediaData.caption
    })
  };

  await ticket.update({
    lastMessage: messageBody || messageType
  });

  return CreateMessageService({ messageData, tenantId: ticket.tenantId });
};

export default VerifyMediaMessage;
