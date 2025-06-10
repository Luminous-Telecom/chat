import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getBaileys } from "../../libs/baileys";
import { logger } from "../../utils/logger";

const GetProfilePicUrl = async (
  number: string,
  tenantId: string | number
): Promise<string> => {
  try {
    const defaultWhatsapp = await GetDefaultWhatsApp(tenantId);
    const wbot = getBaileys(defaultWhatsapp.id);

    // Format number to WhatsApp format
    const formattedNumber = number.replace(/\D/g, "");
    const jid = `${formattedNumber}@s.whatsapp.net`;

    // Get profile picture URL using Baileys
    const profilePicUrl = await wbot.profilePictureUrl(jid);
    return profilePicUrl || "";
  } catch (error) {
    logger.error(`GetProfilePicUrl - ${error}`);
    return "";
  }
};

export default GetProfilePicUrl;
