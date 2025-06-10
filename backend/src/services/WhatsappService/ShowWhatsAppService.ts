import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";
import { ensureWhatsappInstance } from "../../helpers/WhatsappHelper";

interface Data {
  id: string | number;
  tenantId?: string | number;
  isInternal?: boolean;
}

const ShowWhatsAppService = async ({
  id,
  tenantId,
  isInternal = false
}: Data): Promise<Whatsapp> => {
  try {
    logger.info(`Fetching WhatsApp instance ${id} for tenant ${tenantId}`);
    
    // Garantir que id e tenantId são números
    const numericId = Number(id);
    const numericTenantId = tenantId ? Number(tenantId) : undefined;
    
    if (isNaN(numericId)) {
      throw new Error(`Invalid WhatsApp ID: ${id}`);
    }
    
    if (numericTenantId && isNaN(numericTenantId)) {
      throw new Error(`Invalid tenant ID: ${tenantId}`);
    }

    const attr = [
      "id",
      "qrcode",
      "name",
      "status",
      "plugged",
      "isDefault",
      "tokenTelegram",
      "instagramUser",
      "type",
      "createdAt",
      "updatedAt",
      "number",
      "phone",
      "tenantId",
      "wabaBSP",
      "tokenAPI",
      "fbPageId",
      "farewellMessage",
      "chatFlowId"
    ];
    
    if (isInternal) {
      attr.push("instagramKey");
    }

    const whatsapp = await Whatsapp.findByPk(numericId, {
      attributes: attr
    });

    if (!whatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }

    if (numericTenantId && whatsapp.tenantId !== numericTenantId) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }

    // Garantir que é uma instância válida do modelo
    const validInstance = await ensureWhatsappInstance(whatsapp);
    
    // Validar campos críticos
    if (typeof validInstance.id !== 'number' || 
        typeof validInstance.tenantId !== 'number' || 
        typeof validInstance.name !== 'string') {
      logger.error(`WhatsApp ${validInstance.id} has invalid fields:`, {
        id: validInstance.id,
        tenantId: validInstance.tenantId,
        name: validInstance.name
      });
      throw new Error("Invalid WhatsApp instance data");
    }

    logger.debug(`Found valid WhatsApp instance: ${validInstance.name} (ID: ${validInstance.id})`);
    return validInstance;
  } catch (err) {
    logger.error(`Error in ShowWhatsAppService: ${err.message}`);
    throw err;
  }
};

export default ShowWhatsAppService;
