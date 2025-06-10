import { proto } from "@whiskeysockets/baileys";
import Message from "../../../models/Message";
import { getMessageBody } from "../../../utils/messages";

interface Request {
  msg: proto.IWebMessageInfo;
  tenantId: string | number;
}

const VerifyQuotedMessage = async ({
  msg,
  tenantId
}: Request): Promise<Message | null> => {
  if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    return null;
  }

  const quoted = msg.message.extendedTextMessage.contextInfo;
  if (!quoted.stanzaId) {
    return null;
  }

  const quotedMsg = await Message.findOne({
    where: { messageId: quoted.stanzaId, tenantId },
    include: [
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!quotedMsg) {
    return null;
  }

  // Se a mensagem citada já tiver uma mensagem citada, retorna ela
  if (quotedMsg.quotedMsg) {
    return quotedMsg.quotedMsg;
  }

  // Se não tiver, retorna a própria mensagem citada
  return quotedMsg;
};

export default VerifyQuotedMessage;
