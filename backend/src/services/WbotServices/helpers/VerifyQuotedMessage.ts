// import { WbotMessage } from '../../../types/baileys';
import Message from "../../../models/Message";

const VerifyQuotedMessage = async (
  msg: WbotMessage
): Promise<Message | null> => {
  if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) return null;

  const quotedId = msg.message.extendedTextMessage.contextInfo.stanzaId;
  const quotedMsg = await Message.findOne({
    where: { messageId: quotedId ?? null }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};

export default VerifyQuotedMessage;
