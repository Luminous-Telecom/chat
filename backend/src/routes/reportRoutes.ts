import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as ReportController from "../controllers/ReportController";

const reportRoutes = Router();

// Relatórios do sistema
reportRoutes.get("/reports/system", isAuth, ReportController.generateSystemReport);
reportRoutes.get("/reports/tickets", isAuth, ReportController.generateTicketReport);
reportRoutes.get("/reports/messages", isAuth, ReportController.generateMessageReport);
reportRoutes.get("/reports/calls", isAuth, ReportController.generateCallReport);
reportRoutes.get("/reports/queue", isAuth, ReportController.generateQueueReport);
reportRoutes.get("/reports/sessions", isAuth, ReportController.generateSessionReport);

export default reportRoutes; 