import { Request, Response } from "express";
import ImportContactsService from "../services/WbotServices/ImportContactsService";
import AppError from "../errors/AppError";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { ticketId } = req.body;
  
  if (!ticketId) {
    throw new AppError("Ticket ID is required for importing contacts", 400);
  }
  
  // Note: This requires a ticket object, but the original implementation
  // was calling without it. This needs to be reviewed for proper implementation.
  throw new AppError("Contact import functionality needs to be reviewed", 501);
  
  return res.status(200).json({ message: "contacts imported" });
};
