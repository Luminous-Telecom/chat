import express from "express";
import isAuth from "../middleware/isAuth";

import * as WhatsAppController from "../controllers/WhatsAppController";

const whatsappRoutes = express.Router();

whatsappRoutes.get("/whatsapp/", isAuth, WhatsAppController.index);

whatsappRoutes.get("/whatsapp/:whatsappId", isAuth, WhatsAppController.show);

whatsappRoutes.put("/whatsapp/:whatsappId", isAuth, WhatsAppController.update);
whatsappRoutes.post("/whatsapp", isAuth, WhatsAppController.store);

// Retirada opção para não gerar inconsistência nas rotinas.
// Futuramente avaliar a reimplantação da opção. Na rotina atual, ao remover,
// o campo isDeleted é marcado para true, e não é mais exibido na listagem de conexões.
// O problema é que existem diversas rotians que consultam o whatsapp para obter informações.
// Futuramente, deveremos identificar todas as funções para customizar o comportamento, evitando
// consultas no whatsapp caso a sessão/conexão esteja marcada como isDeleted
whatsappRoutes.delete(
  "/whatsapp/:whatsappId",
  isAuth,
  WhatsAppController.remove
);

// Novas rotas para gerenciamento de sessões
whatsappRoutes.post(
  "/whatsapp/:whatsappId/regenerate-session",
  isAuth,
  WhatsAppController.regenerateSession
);

whatsappRoutes.post(
  "/whatsapp/clear-all-sessions",
  isAuth,
  WhatsAppController.clearAllSessions
);

whatsappRoutes.get(
  "/whatsapp/sessions/status",
  isAuth,
  WhatsAppController.getSessionsStatus
);

export default whatsappRoutes;
