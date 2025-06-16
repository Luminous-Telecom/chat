import { BaileysClient as Client } from "../../types/baileys";

import HandleMessage from "./helpers/HandleMessage";
import HandleMsgAck from "./helpers/HandleMsgAck";
import VerifyCall from "./VerifyCall";

interface Session extends Client {
  id: number;
}

const wbotMessageListener = (wbot: Session): void => {
  // const queue = `whatsapp::${wbot.id}`;
  (wbot as any).ev.on("message_create", async msg => {
    // desconsiderar atualização de status
    if (msg.isStatus) {
      return;
    }
    HandleMessage(msg, wbot);
  });

  (wbot as any).ev.on("media_uploaded", async msg => {
    HandleMessage(msg, wbot);
  });

  (wbot as any).ev.on("message_ack", async (msg, ack) => {
    HandleMsgAck(msg, ack);
  });

  (wbot as any).ev.on("call", async call => {
    VerifyCall(call, wbot);
  });
};

export { wbotMessageListener, HandleMessage };
