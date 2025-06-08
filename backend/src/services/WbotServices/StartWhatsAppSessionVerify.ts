import { initWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";

// Função auxiliar para validar e atualizar o objeto whatsapp
const safeUpdateWhatsapp = async (whatsapp: Whatsapp, updateData: any): Promise<boolean> => {
  try {
    // Validações básicas
    if (!whatsapp) {
      logger.error(`safeUpdateWhatsapp: whatsapp é null ou undefined`);
      return false;
    }
    
    if (!whatsapp.id) {
      logger.error(`safeUpdateWhatsapp: whatsapp.id é inválido`);
      return false;
    }
    
    if (typeof whatsapp.update !== "function") {
      logger.error(`safeUpdateWhatsapp: whatsapp.update não é uma função para ID ${whatsapp.id}`);
      
      // Tentar recarregar o objeto do banco de dados
      try {
        const freshWhatsapp = await Whatsapp.findByPk(whatsapp.id);
        if (freshWhatsapp && typeof freshWhatsapp.update === "function") {
          await freshWhatsapp.update(updateData);
          logger.info(`safeUpdateWhatsapp: Objeto whatsapp recarregado e atualizado com sucesso para ID ${whatsapp.id}`);
          return true;
        } else {
          logger.error(`safeUpdateWhatsapp: Falha ao recarregar objeto whatsapp para ID ${whatsapp.id}`);
          return false;
        }
      } catch (reloadError) {
        logger.error(`safeUpdateWhatsapp: Erro ao recarregar whatsapp ${whatsapp.id}: ${reloadError}`);
        return false;
      }
    }
    
    // Se chegou até aqui, o objeto é válido
    await whatsapp.update(updateData);
    return true;
  } catch (error) {
    logger.error(`safeUpdateWhatsapp: Erro ao atualizar whatsapp ${whatsapp?.id || 'unknown'}: ${error}`);
    return false;
  }
};

export const StartWhatsAppSessionVerify = async (
  whatsappId: number,
  err?: Error
): Promise<void> => {
  try {
    const io = getIO();
    
    // Verificar se o erro é crítico
    if (err) {
      const criticalErrors = [
        'ECONNREFUSED',
        'ENOTFOUND',
        'TIMEOUT',
        'Protocol error'
      ];
      
      const isCritical = criticalErrors.some(errorType => 
        err.message.includes(errorType)
      );
      
      if (isCritical) {
        logger.error(`Critical error detected for WhatsApp ${whatsappId}: ${err.message}`);
        return;
      }
    }
    
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    
    if (whatsapp) {
      await safeUpdateWhatsapp(whatsapp, { status: "OPENING" });
      
      io.emit(`${whatsapp?.tenantId}:whatsappSession`, {
        action: "update",
        session: whatsapp
      });
      
      const wbot = await initWbot(whatsapp);
      
      wbotMonitor(wbot, whatsapp);
    }
  } catch (error: any) {
    logger.error(`StartWhatsAppSessionVerify error for ${whatsappId}: ${error.message}`);
  }
};
