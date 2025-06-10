import { proto } from "@whiskeysockets/baileys";
import Message from "../../models/Message";

const isMessageExistsService = async (msg: proto.IWebMessageInfo): Promise<boolean> => {
  const messageId = msg?.key?.id;
  
  if (!messageId) {
    console.log("ID da mensagem não encontrado");
    return false;
  }

  const message = await Message.findOne({
    where: { messageId }
  });

  if (!message) {
    console.log("Mensagem não existe", messageId);
    return false;
  }
  console.log("Mensagem existente", messageId);

  return true;
};

export default isMessageExistsService;
