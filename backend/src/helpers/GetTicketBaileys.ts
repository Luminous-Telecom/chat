import { WASocket } from "@whiskeysockets/baileys";
import { getBaileys } from "../services/BaileysServices/BaileysService";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";

const GetTicketBaileys = async (ticket: Ticket): Promise<WASocket> => {
  if (!ticket.whatsappId) {
    const defaultWhatsapp = await GetDefaultWhatsApp(ticket.tenantId);
    await ticket.$set("whatsapp", defaultWhatsapp);
  }

  const wbot = getBaileys(ticket.whatsappId);
  
  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  return wbot;
};

export default GetTicketBaileys;