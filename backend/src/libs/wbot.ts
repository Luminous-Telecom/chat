// Este arquivo foi migrado para Baileys. Redirecionando para a nova implementação.
import {
  initBaileys,
  getBaileysSession,
  removeBaileysSession,
} from "./baileys";
import Whatsapp from "../models/Whatsapp";
import { BaileysClient } from "../types/baileys";
import AppError from "../errors/AppError";

// Usando a interface Session global definida em types/baileys.d.ts

// Redirecionamento para as funções do Baileys
export const removeWbot = async (whatsappId: number): Promise<void> => {
  return removeBaileysSession(whatsappId);
};

export const initWbot = async (whatsapp: Whatsapp): Promise<Session> => {
  const baileysClient = await initBaileys(whatsapp);
  return baileysClient as Session;
};

export const getWbot = (whatsappId: number): Session => {
  const baileysClient = getBaileysSession(whatsappId);
  if (!baileysClient) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return baileysClient as Session;
};

// Função de compatibilidade que não existe mais no Baileys
export const apagarPastaSessao = async (id: number | string): Promise<void> => {
  // Esta função foi removida pois o Baileys gerencia as sessões de forma diferente
  console.warn(
    "apagarPastaSessao is deprecated and no longer needed with Baileys"
  );
};
