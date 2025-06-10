import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getBaileys } from "../../libs/baileys";
import { logger } from "../../utils/logger";
// import { StartWhatsAppSessionVerify } from "./StartWhatsAppSessionVerify";

const CheckIsValidContact = async (
  number: string,
  tenantId: string | number
): Promise<any> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(tenantId);

  const wbot = getBaileys(defaultWhatsapp.id);

  try {
    // Format number to WhatsApp format
    const formattedNumber = number.replace(/\D/g, "");
    const jid = `${formattedNumber}@s.whatsapp.net`;

    // Check if number exists using fetchStatus
    const status = await wbot.fetchStatus(jid);
    if (!status) {
      throw new AppError("invalidNumber", 400);
    }

    return jid;
  } catch (err: any) {
    logger.error(`CheckIsValidContact | Error: ${err}`);
    // StartWhatsAppSessionVerify(defaultWhatsapp.id, err);
    if (err.message === "invalidNumber") {
      throw new AppError("ERR_WAPP_INVALID_CONTACT");
    }
    throw new AppError("ERR_WAPP_CHECK_CONTACT");
  }
};

export default CheckIsValidContact;
