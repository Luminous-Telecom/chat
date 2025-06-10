import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";

type WhatsappInput = Whatsapp | number | { id: number };

export const ensureWhatsappInstance = async (whatsapp: WhatsappInput): Promise<Whatsapp> => {
  try {
    if (typeof whatsapp === 'number') {
      const instance = await Whatsapp.findByPk(whatsapp);
      if (!instance) {
        throw new Error(`WhatsApp ${whatsapp} not found in database`);
      }
      return instance;
    }
    
    if (whatsapp instanceof Whatsapp) {
      return whatsapp;
    }
    
    // At this point, whatsapp must be an object with an id
    const instance = await Whatsapp.findByPk(whatsapp.id);
    if (!instance) {
      throw new Error(`WhatsApp ${whatsapp.id} not found in database`);
    }
    return instance;
  } catch (err) {
    logger.error(`Error ensuring WhatsApp instance: ${err}`);
    throw err;
  }
};

export const safeUpdateWhatsapp = async (whatsapp: WhatsappInput, data: Partial<Whatsapp>): Promise<Whatsapp> => {
  const instance = await ensureWhatsappInstance(whatsapp);
  return instance.update(data);
}; 