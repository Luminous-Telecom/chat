import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getBaileys } from "../../libs/baileys";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import { proto } from "@whiskeysockets/baileys";
import { WASocket } from "@whiskeysockets/baileys";

interface BaileysContact {
  name?: string;
  pushName?: string;
  verifiedName?: string;
}

interface Session extends WASocket {
  id: number;
  tenantId: number;
  store?: {
    contacts: { [key: string]: BaileysContact };
  };
}

const ImportContactsService = async (
  tenantId: string | number
): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(tenantId);
  const wbot = getBaileys(defaultWhatsapp.id) as Session;

  try {
    // Get all contacts from Baileys store
    const contacts = wbot.store?.contacts || {};
    
    if (contacts) {
      await Promise.all(
        Object.entries(contacts).map(async ([id, contact]) => {
          if (!id || id.includes('g.us')) {
            return null;
          }

          // Extract number from JID (remove @s.whatsapp.net)
          const number = id.split('@')[0];
          const baileysContact = contact as BaileysContact;
          const name = baileysContact.name || baileysContact.pushName || baileysContact.verifiedName || number;

          const numberExists = await Contact.findOne({
            where: { number, tenantId }
          });

          if (numberExists) return null;

          return Contact.create({ 
            number, 
            name, 
            tenantId,
            pushname: baileysContact.pushName,
            isWAContact: true
          });
        })
      );
    }
  } catch (err) {
    logger.error(
      `Could not get whatsapp contacts from phone. Check connection page. | Error: ${err}`
    );
  }
};

export default ImportContactsService;
