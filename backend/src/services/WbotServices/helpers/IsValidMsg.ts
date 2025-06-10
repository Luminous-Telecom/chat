import { proto } from "@whiskeysockets/baileys";

const isValidMsg = (msg: proto.IWebMessageInfo): boolean => {
  if (msg.key.remoteJid === "status@broadcast") return false;

  const messageType = msg.message?.conversation
    ? "conversation"
    : msg.message?.imageMessage
    ? "image"
    : msg.message?.videoMessage
    ? "video"
    : msg.message?.audioMessage
    ? "audio"
    : msg.message?.documentMessage
    ? "document"
    : msg.message?.stickerMessage
    ? "sticker"
    : msg.message?.extendedTextMessage
    ? "conversation"
    : undefined;

  if (
    messageType === "conversation" ||
    messageType === "audio" ||
    messageType === "video" ||
    messageType === "image" ||
    messageType === "document" ||
    messageType === "sticker"
  )
    return true;
  return false;
};

export default isValidMsg;
