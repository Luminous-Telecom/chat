import express from "express";
import isAuth from "../middleware/isAuth";

import * as TicketController from "../controllers/TicketController";

const ticketRoutes = express.Router();

ticketRoutes.get("/tickets", isAuth, TicketController.index);

ticketRoutes.get("/tickets/:ticketId", isAuth, TicketController.show);

ticketRoutes.post("/tickets", isAuth, TicketController.store);

ticketRoutes.put("/tickets/:ticketId", isAuth, TicketController.update);

ticketRoutes.delete("/tickets/:ticketId", isAuth, TicketController.remove);

ticketRoutes.get(
  "/tickets/:ticketId/logs",
  isAuth,
  TicketController.showLogsTicket
);

ticketRoutes.post(
  "/tickets/:ticketId/read",
  isAuth,
  TicketController.markAllAsRead
);

ticketRoutes.put(
  "/ticket-tags/:ticketId",
  isAuth,
  TicketController.updateTicketTags
);

// Rotas para participantes da conversa
ticketRoutes.post(
  "/tickets/:ticketId/join",
  isAuth,
  TicketController.joinConversation
);

ticketRoutes.post(
  "/tickets/:ticketId/leave",
  isAuth,
  TicketController.leaveConversation
);

ticketRoutes.get(
  "/tickets/:ticketId/participants",
  isAuth,
  TicketController.getParticipants
);

ticketRoutes.put(
  "/tickets/:ticketId/toggle-pinned",
  isAuth,
  TicketController.togglePinned
);

export default ticketRoutes;
