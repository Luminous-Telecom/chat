import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";

const ImportContactsService = async (
  tenantId: string | number,
  ticket: Ticket
): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(tenantId);

  const wbot = getWbot(defaultWhatsapp.id);

  let phoneContacts;

  try {
    const session = await GetTicketWbot(ticket);
    const contacts = Object.values((session as any).store.contacts || {}) as any[];

    const contactsStore = contacts.map((c: any) => ({
      number: (c.id || '').split('@')[0].replace(/\D/g, ''),
      name: c.name || c.notify || c.pushname || ""
    }));

    phoneContacts = contactsStore.map(({ number, name }) => ({ number, name }));
  } catch (err) {
    logger.error(
      `Could not get whatsapp contacts from phone. Check connection page. | Error: ${err}`
    );
  }

  if (phoneContacts) {
    await Promise.all(
      phoneContacts.map(async ({ number, name }) => {
        if (!number) {
          return null;
        }
        if (!name) {
          name = number;
        }

        const numberExists = await Contact.findOne({
          where: { number: number.replace(/\D/g, ''), tenantId }
        });

        if (numberExists) return null;

        return Contact.create({ number: number.replace(/\D/g, ''), name, tenantId });
      })
    );
  }
};

export default ImportContactsService;
