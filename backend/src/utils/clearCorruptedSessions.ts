import { rm } from "fs/promises";
import { join } from "path";
import { logger } from "./logger";
import Whatsapp from "../models/Whatsapp";
import { removeBaileysSession } from "../libs/baileys";

/**
 * Utilitário para limpar sessões corrompidas do Baileys
 * Útil quando há problemas de criptografia ou sessões instáveis
 */
export const clearCorruptedSessions = async (): Promise<void> => {
  try {
    logger.info("Iniciando limpeza de sessões corrompidas...");

    // Buscar todas as instâncias do WhatsApp
    const whatsapps = await Whatsapp.findAll();

    for (const whatsapp of whatsapps) {
      try {
        logger.info(`Processando WhatsApp: ${whatsapp.name} (ID: ${whatsapp.id})`);

        // Remover sessão ativa se existir
        await removeBaileysSession(whatsapp.id);

        // Limpar diretório da sessão
        const sessionDir = join(
          __dirname,
          "..",
          "..",
          "session",
          `session-${whatsapp.id}`
        );

        try {
          await rm(sessionDir, { recursive: true, force: true });
          logger.info(`Diretório da sessão limpo: ${sessionDir}`);
        } catch (dirErr) {
          logger.warn(`Não foi possível limpar diretório ${sessionDir}: ${dirErr}`);
        }

        // Resetar status no banco
        await whatsapp.update({
          status: "DISCONNECTED",
          qrcode: "",
          retries: 0
        });

        logger.info(`WhatsApp ${whatsapp.name} processado com sucesso`);
      } catch (whatsappErr) {
        logger.error(`Erro ao processar WhatsApp ${whatsapp.name}: ${whatsappErr}`);
      }
    }

    logger.info("Limpeza de sessões corrompidas concluída");
  } catch (err) {
    logger.error(`Erro durante limpeza de sessões: ${err}`);
    throw err;
  }
};

/**
 * Limpar sessão específica por ID
 */
export const clearSpecificSession = async (whatsappId: number): Promise<void> => {
  try {
    logger.info(`Limpando sessão específica: ${whatsappId}`);

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new Error(`WhatsApp com ID ${whatsappId} não encontrado`);
    }

    // Remover sessão ativa
    await removeBaileysSession(whatsappId);

    // Limpar diretório da sessão
    const sessionDir = join(
      __dirname,
      "..",
      "..",
      "session",
      `session-${whatsappId}`
    );

    try {
      await rm(sessionDir, { recursive: true, force: true });
      logger.info(`Diretório da sessão limpo: ${sessionDir}`);
    } catch (dirErr) {
      logger.warn(`Não foi possível limpar diretório ${sessionDir}: ${dirErr}`);
    }

    // Resetar status no banco
    await whatsapp.update({
      status: "DISCONNECTED",
      qrcode: "",
      retries: 0
    });

    logger.info(`Sessão ${whatsappId} limpa com sucesso`);
  } catch (err) {
    logger.error(`Erro ao limpar sessão ${whatsappId}: ${err}`);
    throw err;
  }
};

// Se executado diretamente
if (require.main === module) {
  clearCorruptedSessions()
    .then(() => {
      logger.info("Script de limpeza executado com sucesso");
      process.exit(0);
    })
    .catch((err) => {
      logger.error(`Erro no script de limpeza: ${err}`);
      process.exit(1);
    });
} 