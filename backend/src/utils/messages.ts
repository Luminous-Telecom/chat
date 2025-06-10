import { proto } from "@whiskeysockets/baileys";

export const getMessageBody = (msg: proto.IWebMessageInfo): string => {
  if (!msg.message) return "";

  return msg.message.conversation || 
    msg.message.extendedTextMessage?.text || 
    msg.message.imageMessage?.caption || 
    msg.message.videoMessage?.caption || 
    msg.message.documentMessage?.caption || 
    "";
}; 