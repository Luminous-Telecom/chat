import express from "express";
import isAuth from "../middleware/isAuth";
import * as DashController from "../controllers/Statistics/DashController";

const dashboardRoutes = express.Router();

dashboardRoutes.get(
  "/tickets-instances",
  isAuth,
  DashController.getDashTicketsInstances
);

export default dashboardRoutes; 