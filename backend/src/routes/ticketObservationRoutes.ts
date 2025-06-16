import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import * as TicketObservationController from "../controllers/TicketObservationController";

const ticketObservationRoutes = Router();
const upload = multer(uploadConfig);

ticketObservationRoutes.get(
  "/ticket/:ticketId/observations",
  isAuth,
  TicketObservationController.index
);

ticketObservationRoutes.post(
  "/ticket/:ticketId/observations",
  isAuth,
  upload.single("anexo"),
  TicketObservationController.store
);

export default ticketObservationRoutes;
