import { logger } from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { ensureWhatsappInstance } from "../../helpers/WhatsappHelper";
import AppError from "../../errors/AppError";

interface Request {
  tenantId: number | string;
}

const ListWhatsAppsService = async (tenantId: number | string): Promise<Whatsapp[]> => {
  try {
    // Garantir que tenantId é um número
    const numericTenantId = Number(tenantId);
    if (isNaN(numericTenantId)) {
      logger.error(`Invalid tenantId provided: ${tenantId}`);
      throw new AppError("Invalid tenant ID", 400);
    }

    logger.info(`Listing WhatsApp instances for tenant ${numericTenantId}`);

    // Buscar instâncias do banco de dados
    const whatsapps = await Whatsapp.findAll({
      where: { tenantId: numericTenantId },
      order: [["name", "ASC"]]
    });

    logger.info(`Found ${whatsapps.length} WhatsApp instances in database`);

    // Validar cada instância
    const validWhatsapps = await Promise.all(
      whatsapps.map(async (whatsapp) => {
        try {
          // Garantir que é uma instância válida do modelo
          const validInstance = await ensureWhatsappInstance(whatsapp);
          
          // Validar campos críticos
          if (!validInstance.id || !validInstance.tenantId || !validInstance.name) {
            logger.error(`Invalid WhatsApp instance found: ${JSON.stringify(validInstance)}`);
            return null;
          }

          // Garantir que os tipos estão corretos
          if (typeof validInstance.id !== 'number' || 
              typeof validInstance.tenantId !== 'number') {
            logger.error(`Invalid type for WhatsApp instance fields: ${JSON.stringify(validInstance)}`);
            return null;
          }

          return validInstance;
        } catch (err) {
          logger.error(`Error validating WhatsApp instance: ${err.message}`);
          return null;
        }
      })
    );

    // Filtrar instâncias inválidas
    const filteredWhatsapps = validWhatsapps.filter((w): w is Whatsapp => w !== null);

    logger.info(`Returning ${filteredWhatsapps.length} valid WhatsApp instances`);

    return filteredWhatsapps;
  } catch (err) {
    logger.error(`Error in ListWhatsAppsService: ${err.message}`);
    throw err;
  }
};

export default ListWhatsAppsService;
