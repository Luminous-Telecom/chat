import { Request, Response } from "express";
import { getSessionsDebugInfo, syncSessionStatus } from "../libs/wbot";
import Whatsapp from "../models/Whatsapp";

export const getSessionsInfo = async (req: Request, res: Response): Promise<Response> => {
  try {
    const debugInfo = getSessionsDebugInfo();
    
    // Buscar informações do banco de dados
    const whatsapps = await Whatsapp.findAll({
      attributes: ['id', 'name', 'status', 'qrcode', 'retries'],
      order: [['id', 'ASC']]
    });
    
    return res.json({
      memory: debugInfo,
      database: whatsapps,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const forceSyncSessions = async (req: Request, res: Response): Promise<Response> => {
  try {
    await syncSessionStatus();
    
    const debugInfo = getSessionsDebugInfo();
    
    return res.json({
      message: "Session sync completed",
      result: debugInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};