import { BaileysClient as Session } from "../types/baileys";
import { getBaileysSession } from "../libs/baileys";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import Ticket from "../models/Ticket";

const GetTicketWbot = async (ticket: Ticket): Promise<Session> => {
  if (!ticket.whatsappId) {
    const defaultWhatsapp = await GetDefaultWhatsApp(ticket.tenantId);

    await ticket.$set("whatsapp", defaultWhatsapp);
  }

  const wbot = getBaileysSession(ticket.whatsappId);

  if (!wbot) {
    throw new Error("ERR_WAPP_NOT_INITIALIZED");
  }

  // Checagem adicional: garantir que a sessão está conectada
  if ((wbot as any).connection !== "open") {
    throw new Error("ERR_WAPP_NOT_CONNECTED");
  }

  return wbot;
};

export default GetTicketWbot;
