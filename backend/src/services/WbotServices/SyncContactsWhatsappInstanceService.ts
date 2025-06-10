import { QueryTypes } from "sequelize";
import { getBaileys } from "../../libs/baileys";
import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";
import { WASocket, Contact as BaileysContact } from "@whiskeysockets/baileys";

interface Session extends WASocket {
  id: number;
  tenantId: number;
  store?: {
    contacts: { [key: string]: BaileysContact };
  };
}

const SyncContactsWhatsappInstanceService = async (
  whatsappId: number,
  tenantId: number
): Promise<void> => {
  const wbot = getBaileys(whatsappId) as Session;

  let contacts: { [key: string]: BaileysContact } | undefined;

  try {
    // Get contacts from Baileys store
    contacts = wbot.store?.contacts;
  } catch (err) {
    logger.error(
      `Could not get whatsapp contacts from phone. Check connection page. | Error: ${err}`
    );
  }

  if (!contacts) {
    throw new AppError("ERR_CONTACTS_NOT_EXISTS_WHATSAPP", 404);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/ban-types
    const dataArray: object[] = [];
    await Promise.all(
      Object.entries(contacts).map(async ([id, contact]) => {
        // Skip group chats
        if (id.endsWith('@g.us')) {
          return;
        }

        // Extract number from JID
        const number = id.split('@')[0];
        
        // Get name from contact info - Baileys Contact type has 'name' and 'notify' properties
        const name = contact.name || contact.notify;
        
        if (name) {
          const contactObj = { name, number, tenantId };
          dataArray.push(contactObj);
        }
      })
    );

    if (dataArray.length) {
      const d = new Date().toJSON();
      const query = `INSERT INTO "Contacts" (number, name, "tenantId", "createdAt", "updatedAt") VALUES
        ${dataArray
          .map((e: any) => {
            return `('${e.number}',
            '${e.name}',
            '${e.tenantId}',
            '${d}'::timestamp,
            '${d}'::timestamp)`;
          })
          .join(",")}
        ON CONFLICT (number, "tenantId") DO NOTHING`;

      await Contact.sequelize?.query(query, {
        type: QueryTypes.INSERT
      });
    }
  } catch (error) {
    console.error(error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Sync contacts WhatsApp instance service failed: ${error.message || error}`, 500);
  }
};

export default SyncContactsWhatsappInstanceService;
