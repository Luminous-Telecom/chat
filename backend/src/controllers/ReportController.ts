import { Request, Response } from "express";
import ReportService from "../services/ReportServices/ReportService";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";

const validateDateRange = (startDate: string, endDate: string): { start: Date; end: Date } => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError("Invalid date range", 400);
  }

  if (start > end) {
    throw new AppError("Start date must be before end date", 400);
  }

  // Limitar período máximo a 30 dias
  const maxPeriod = 30 * 24 * 60 * 60 * 1000; // 30 dias em milissegundos
  if (end.getTime() - start.getTime() > maxPeriod) {
    throw new AppError("Date range cannot exceed 30 days", 400);
  }

  return { start, end };
};

export const generateSystemReport = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { startDate, endDate, whatsappId, userId, status, format = "json" } = req.query;

  try {
    if (!startDate || !endDate) {
      throw new AppError("Start date and end date are required", 400);
    }

    const { start, end } = validateDateRange(startDate as string, endDate as string);

    const report = await ReportService.generateSystemReport({
      tenantId: Number(tenantId),
      startDate: start,
      endDate: end,
      whatsappId: whatsappId ? Number(whatsappId) : undefined,
      userId: userId ? Number(userId) : undefined,
      status: status as string
    });

    if (format === "json") {
      return res.json(report);
    }

    const exportedReport = await ReportService.exportReport(report, format as any);
    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=system-report-${start.toISOString()}-${end.toISOString()}.${format}`);
    return res.send(exportedReport);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const generateTicketReport = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { startDate, endDate, whatsappId, userId, status, format = "json" } = req.query;

  try {
    if (!startDate || !endDate) {
      throw new AppError("Start date and end date are required", 400);
    }

    const { start, end } = validateDateRange(startDate as string, endDate as string);

    const report = await ReportService.generateSystemReport({
      tenantId: Number(tenantId),
      startDate: start,
      endDate: end,
      whatsappId: whatsappId ? Number(whatsappId) : undefined,
      userId: userId ? Number(userId) : undefined,
      status: status as string
    });

    if (format === "json") {
      return res.json(report.tickets);
    }

    const exportedReport = await ReportService.exportReport({ ...report, tickets: report.tickets }, format as any);
    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=ticket-report-${start.toISOString()}-${end.toISOString()}.${format}`);
    return res.send(exportedReport);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const generateMessageReport = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { startDate, endDate, whatsappId, format = "json" } = req.query;

  try {
    if (!startDate || !endDate) {
      throw new AppError("Start date and end date are required", 400);
    }

    const { start, end } = validateDateRange(startDate as string, endDate as string);

    const report = await ReportService.generateSystemReport({
      tenantId: Number(tenantId),
      startDate: start,
      endDate: end,
      whatsappId: whatsappId ? Number(whatsappId) : undefined
    });

    if (format === "json") {
      return res.json(report.messages);
    }

    const exportedReport = await ReportService.exportReport({ ...report, messages: report.messages }, format as any);
    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=message-report-${start.toISOString()}-${end.toISOString()}.${format}`);
    return res.send(exportedReport);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const generateCallReport = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { startDate, endDate, whatsappId, format = "json" } = req.query;

  try {
    if (!startDate || !endDate) {
      throw new AppError("Start date and end date are required", 400);
    }

    const { start, end } = validateDateRange(startDate as string, endDate as string);

    const report = await ReportService.generateSystemReport({
      tenantId: Number(tenantId),
      startDate: start,
      endDate: end,
      whatsappId: whatsappId ? Number(whatsappId) : undefined
    });

    if (format === "json") {
      return res.json(report.calls);
    }

    const exportedReport = await ReportService.exportReport({ ...report, calls: report.calls }, format as any);
    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=call-report-${start.toISOString()}-${end.toISOString()}.${format}`);
    return res.send(exportedReport);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const generateQueueReport = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { startDate, endDate, format = "json" } = req.query;

  try {
    if (!startDate || !endDate) {
      throw new AppError("Start date and end date are required", 400);
    }

    const { start, end } = validateDateRange(startDate as string, endDate as string);

    const report = await ReportService.generateSystemReport({
      tenantId: Number(tenantId),
      startDate: start,
      endDate: end
    });

    if (format === "json") {
      return res.json(report.queue);
    }

    const exportedReport = await ReportService.exportReport({ ...report, queue: report.queue }, format as any);
    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=queue-report-${start.toISOString()}-${end.toISOString()}.${format}`);
    return res.send(exportedReport);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
};

export const generateSessionReport = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const { startDate, endDate, whatsappId, format = "json" } = req.query;

  try {
    if (!startDate || !endDate) {
      throw new AppError("Start date and end date are required", 400);
    }

    const { start, end } = validateDateRange(startDate as string, endDate as string);

    const report = await ReportService.generateSystemReport({
      tenantId: Number(tenantId),
      startDate: start,
      endDate: end,
      whatsappId: whatsappId ? Number(whatsappId) : undefined
    });

    if (format === "json") {
      return res.json(report.sessions);
    }

    const exportedReport = await ReportService.exportReport({ ...report, sessions: report.sessions }, format as any);
    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=session-report-${start.toISOString()}-${end.toISOString()}.${format}`);
    return res.send(exportedReport);
  } catch (err) {
    logger.error(err);
    throw new AppError(err.message);
  }
}; 