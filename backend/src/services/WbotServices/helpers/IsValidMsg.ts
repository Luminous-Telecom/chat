// Não precisa importar WbotMessage, pois é global

const isValidMsg = (msg: WbotMessage): boolean => {
  if (msg.from === "status@broadcast") return false;
  
  // Verificar se é mensagem de canal/newsletter do WhatsApp
  if (msg.from && (msg.from.includes('@newsletter') || msg.from.includes('newsletter'))) {
    return false;
  }
  
  if (
    msg.type === "chat" ||
    msg.type === "audio" ||
    msg.type === "ptt" ||
    msg.type === "video" ||
    msg.type === "image" ||
    msg.type === "document" ||
    msg.type === "vcard" ||
    msg.type === "sticker"
  )
    return true;
  return false;
};

export default isValidMsg;
