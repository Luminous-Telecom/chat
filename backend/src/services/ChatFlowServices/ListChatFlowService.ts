import { logger } from "../../utils/logger";
import ChatFlow from "../../models/ChatFlow";
import AppError from "../../errors/AppError";

interface Request {
  tenantId: number | string;
}

const ListChatFlowService = async ({ tenantId }: Request): Promise<ChatFlow[]> => {
  try {
    // Garantir que tenantId é um número
    const numericTenantId = Number(tenantId);
    if (isNaN(numericTenantId)) {
      logger.error(`Invalid tenantId provided: ${tenantId}`);
      throw new AppError("Invalid tenant ID", 400);
    }

    logger.info(`Listing ChatFlow instances for tenant ${numericTenantId}`);

    // Buscar instâncias do banco de dados
    const chatFlows = await ChatFlow.findAll({
      where: { tenantId: numericTenantId },
      order: [["name", "ASC"]]
    });

    logger.info(`Found ${chatFlows.length} ChatFlow instances in database`);

    // Validar cada instância
    const validChatFlows = chatFlows.map(chatFlow => {
      try {
        // Validar campos críticos
        if (!chatFlow.id || !chatFlow.tenantId || !chatFlow.name) {
          logger.error(`Invalid ChatFlow instance found: ${JSON.stringify(chatFlow)}`);
          return null;
        }

        // Garantir que os tipos estão corretos
        if (typeof chatFlow.id !== 'number' || 
            typeof chatFlow.tenantId !== 'number') {
          logger.error(`Invalid type for ChatFlow instance fields: ${JSON.stringify(chatFlow)}`);
          return null;
        }

        // Garantir que é uma instância válida do modelo
        if (!(chatFlow instanceof ChatFlow)) {
          logger.error(`Invalid ChatFlow instance type: ${typeof chatFlow}`);
          return null;
        }

        return chatFlow;
      } catch (err) {
        logger.error(`Error validating ChatFlow instance: ${err.message}`);
        return null;
      }
    });

    // Filtrar instâncias inválidas
    const filteredChatFlows = validChatFlows.filter((cf): cf is ChatFlow => cf !== null);

    logger.info(`Returning ${filteredChatFlows.length} valid ChatFlow instances`);

    return filteredChatFlows;
  } catch (err) {
    logger.error(`Error in ListChatFlowService: ${err.message}`);
    throw err;
  }
};

export default ListChatFlowService;
