import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { removeWbot } from "../libs/wbot";
import AppError from "../errors/AppError";

import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;

  const whatsapps = await ListWhatsAppsService(tenantId);

  return res.status(200).json(whatsapps);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;

  const whatsapp = await ShowWhatsAppService({ id: whatsappId, tenantId });

  return res.status(200).json(whatsapp);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { tenantId } = req.user;
  const whatsapps = await ListWhatsAppsService(tenantId);
  if (whatsapps.length >= Number(process.env.CONNECTIONS_LIMIT)) {
    throw new AppError("ERR_NO_PERMISSION_CONNECTIONS_LIMIT", 400);
  }

  const { whatsapp } = await CreateWhatsAppService({
    ...whatsappData,
    whatsappId,
    tenantId,
  });

  return res.status(200).json(whatsapp);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { tenantId } = req.user;

  const { whatsapp } = await UpdateWhatsAppService({
    whatsappData,
    whatsappId,
    tenantId,
  });

  return res.status(200).json(whatsapp);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;
  await DeleteWhatsAppService(whatsappId, tenantId);
  removeWbot(+whatsappId);

  const io = getIO();
  io.emit(`${tenantId}:whatsapp`, {
    action: "delete",
    whatsappId: +whatsappId,
  });

  return res.status(200).json({ message: "Whatsapp deleted." });
};

// Endpoint para regenerar sessão quando há problemas de criptografia
export const regenerateSession = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { tenantId } = req.user;

  try {
    const whatsapp = await ShowWhatsAppService({ id: whatsappId, tenantId });

    if (!whatsapp) {
      return res.status(404).json({ error: "WhatsApp não encontrado" });
    }

    // Importar a função de regeneração
    const { regenerateSessionForCryptoIssues } = await import("../libs/baileys");
    
    const newSession = await regenerateSessionForCryptoIssues(whatsapp.id);
    
    if (newSession) {
      return res.status(200).json({
        message: "Sessão regenerada com sucesso",
        whatsappId: whatsapp.id,
        status: "regenerated"
      });
    } else {
      return res.status(500).json({
        error: "Falha ao regenerar sessão"
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Endpoint para limpar todas as sessões corrompidas
export const clearAllSessions = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;

  try {
    // Importar a função de limpeza
    const { clearCorruptedSessions } = await import("../utils/clearCorruptedSessions");
    
    await clearCorruptedSessions();
    
    return res.status(200).json({
      message: "Todas as sessões foram limpas com sucesso",
      status: "cleared"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Endpoint para verificar o status das sessões
export const getSessionsStatus = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;

  try {
    const whatsapps = await ListWhatsAppsService(tenantId);
    const { getAllSessions, getSessionCount } = await import("../libs/baileys");
    
    const activeSessions = getAllSessions();
    const sessionCount = getSessionCount();
    
    const sessionsStatus = whatsapps.map(whatsapp => {
      const session = activeSessions.find(s => (s as any).id === whatsapp.id);
      const connectionState = session ? (session as any)?.connection : "DISCONNECTED";
      const wsExists = session ? !!(session as any)?.ws : false;
      
      return {
        id: whatsapp.id,
        name: whatsapp.name,
        status: whatsapp.status,
        connectionState,
        wsExists,
        isActive: connectionState === "open" && wsExists,
        lastUpdate: whatsapp.updatedAt
      };
    });
    
    return res.status(200).json({
      sessions: sessionsStatus,
      totalSessions: sessionCount,
      activeSessions: activeSessions.length
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};
