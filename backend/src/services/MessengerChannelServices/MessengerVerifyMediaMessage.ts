import { join } from "path";
import axios from "axios";
import fs, { createWriteStream } from "fs";
import contentDiposition from "content-disposition";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

import Message from "../../models/Message";
import CreateMessageService from "../MessageServices/CreateMessageService";
import Whatsapp from "../../models/Whatsapp";
import { EventMessage, MessengerRawEvent } from "./MessengerTypes";
import getQuotedForMessageId from "../../helpers/getQuotedForMessageId";
import { createMediaPreviewMessage } from "../../utils/mediaPreviewHelper";

interface IMessage extends EventMessage {
  type: string;
  timestamp: number;
}

const downloadFile = async (url: string, filename: string): Promise<string> => {
  const request = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  const parseDisposition: any = request.headers["content-disposition"]
    ? contentDiposition.parse(request.headers["content-disposition"] || "")
    : { parameters: {} };
  let name = "";

  const filenameExists: any = parseDisposition?.parameters?.filename;
  if (filenameExists) {
    const fileName: any = parseDisposition.parameters.filename;
    name = `${new Date().getTime()}-${fileName}`;
  } else {
    const contentType = request.headers["content-type"];
    const ext = contentType.split("/")[1];
    name = `${filename}-${new Date().getTime()}.${ext}`;
  }

  const publicDir = join(__dirname, "..", "..", "..", "public");
  const receivedDir = join(publicDir, "received");

  // Verificar se os diretórios existem
  try {
    await fs.promises.access(publicDir);
    try {
      await fs.promises.access(receivedDir);
    } catch (err) {
      await fs.promises.mkdir(receivedDir, { recursive: true });
    }
  } catch (err) {
    await fs.promises.mkdir(publicDir, { recursive: true });
    await fs.promises.mkdir(receivedDir, { recursive: true });
  }

  const pathFile = join(receivedDir, name);

  await new Promise((resolve, reject) => {
    request.data
      .pipe(createWriteStream(pathFile))
      .on("finish", async () => resolve(name))
      .on("error", (error: any) => {
        console.error("ERROR DONWLOAD", error);
        reject(new Error(error));
      });
  });

  return `received/${name}`;
};

const MessengerVerifyMediaMessage = async (
  channel: Whatsapp,
  msg: MessengerRawEvent | any,
  ticket: Ticket,
  contact: Contact
): Promise<Message | void> => {
  // const quotedMsg = await VerifyQuotedMessage(msg);
  let filename;

  await Promise.all(
    msg.message.attachments.map(async (item: any, idx: any) => {
      const name = `${ticket.id}_${msg.message_id}`;
      filename = await downloadFile(item.payload.url, name);
      let quotedMsgId;

      if (msg?.message?.reply_to?.mid) {
        const messageQuoted = await getQuotedForMessageId(
          msg.message.reply_to.mid,
          ticket.tenantId
        );
        quotedMsgId = messageQuoted?.id || undefined;
      }

      const messageData = {
        // idx necessário em função do id ser o mesmo para todos os anexos
        messageId: idx > 0 ? `${msg.message_id}__${idx}` : msg.message_id || "",
        ticketId: ticket.id,
        contactId: contact.id,
        body: msg.message?.text || "",
        fromMe: msg.fromMe,
        read: false,
        mediaUrl: msg.fromMe ? `sent/${name}` : `received/${name}`,
        mediaType: msg.type,
        quotedMsgId,
        timestamp: +msg.timestamp,
        status: "received",
      };

      // Criar mensagem descritiva para o preview
      const mimetype = "application/octet-stream";// Tipo genérico para Messenger
      const displayMessage = createMediaPreviewMessage(
        msg.message?.text, 
        filename || "arquivo", 
        mimetype
      );

      await ticket.update({
        lastMessage: displayMessage,
        lastMessageAt: new Date().getTime(),
        answered: false,
      });

      await CreateMessageService({
        messageData,
        tenantId: ticket.tenantId,
      });
      // return newMessage;
    })
  );
};

export default MessengerVerifyMediaMessage;
