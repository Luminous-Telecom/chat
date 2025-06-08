import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as SessionDebugController from "../controllers/SessionDebugController";

const sessionDebugRoutes = Router();

sessionDebugRoutes.get("/sessions/debug", isAuth, SessionDebugController.getSessionsInfo);
sessionDebugRoutes.post("/sessions/sync", isAuth, SessionDebugController.forceSyncSessions);

export default sessionDebugRoutes;