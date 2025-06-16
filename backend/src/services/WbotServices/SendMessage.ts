import { join } from "path";
import fs from "fs";
import Message from "../../models/Message";
import { logger } from "../../utils/logger";
import { getWbot } from "../../libs/wbot";

const SendMessage = async (message: Message): Promise<void> => {
  logger.info(`SendMessage: ${message.id}`);
  const wbot = getWbot(message.ticket.whatsappId);
  let sendedMessage;

  let quotedMsgSerializedId: string | undefined;
  const { ticket } = message;
  const contactNumber = message.contact.number;
  const typeGroup = ticket?.isGroup ? "g" : "c";
  const chatId = `${contactNumber}@${typeGroup}.us`;

  if (message.quotedMsg) {
    quotedMsgSerializedId = `${message.quotedMsg.fromMe}_${contactNumber}@${typeGroup}.us_${message.quotedMsg.messageId}`;
  }

  if (message.mediaType !== "chat" && message.mediaName) {
    const customPath = join(__dirname, "..", "..", "..", "public");
    const mediaPath = join(customPath, message.mediaName);
    const buffer = await fs.promises.readFile(mediaPath);
    const mimetype = message.mediaType;
    const caption = message.body;
    const options = {
      quotedMessageId: quotedMsgSerializedId,
      linkPreview: false,
      sendAudioAsVoice: false,
    };
    sendedMessage = await wbot.sendMessage(
      chatId,
      { image: buffer, mimetype, caption },
      options
    );
  } else {
    const options = {
      quotedMessageId: quotedMsgSerializedId,
      linkPreview: false,
      sendAudioAsVoice: false,
    };
    sendedMessage = await wbot.sendMessage(chatId, message.body, options);
  }

  // enviar old_id para substituir no front a mensagem corretamente
  const messageToUpdate = {
    ...message,
    ...sendedMessage,
    id: message.id,
    messageId: sendedMessage.id.id,
    status: "sended",
  };

  await Message.update({ ...messageToUpdate }, { where: { id: message.id } });

  logger.info("rabbit::sendedMessage", sendedMessage.id.id);
};

export default SendMessage;
