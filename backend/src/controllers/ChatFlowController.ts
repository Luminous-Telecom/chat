// import * as Yup from "yup";
import { Request, Response } from "express";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";

import CreateChatFlowService from "../services/ChatFlowServices/CreateChatFlowService";
import ListChatFlowService from "../services/ChatFlowServices/ListChatFlowService";
import ShowChatFlowService from "../services/ChatFlowServices/ShowChatFlowService";
import UpdateChatFlowService from "../services/ChatFlowServices/UpdateChatFlowService";
import DeleteChatFlowService from "../services/ChatFlowServices/DeleteChatFlowService";
// import UpdateAutoReplyService from "../services/AutoReplyServices/UpdateAutoReplyService";
// import DeleteAutoReplyService from "../services/AutoReplyServices/DeleteAutoReplyService";

interface Line {
  connector: string;
  from: string;
  paintStyle: string | any;
  to: string;
}

interface Configuration {
  id: string;
  name: string;
  type: string;
  value: string;
}

interface NodeList {
  ico?: string;
  id: string;
  left: string;
  name: string;
  status: string;
  style?: string | any;
  top: string;
  type?: string;
  viewOnly?: boolean;
  configurations?: Configuration;
  actions?: [];
  conditions?: [];
  interactions?: [];
}

interface Flow {
  name: string;
  lineList: Line[];
  nodeList: NodeList[];
}

interface ChatFlowData {
  flow: Flow;
  name: string;
  userId: number;
  isActive: boolean;
  celularTeste?: string;
  tenantId: number | string;
  defaultQueueId?: number;
}

export const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { tenantId } = req.user;
    if (!tenantId) {
      logger.error("No tenantId provided in request");
      throw new AppError("Tenant ID is required", 400);
    }

    if (req.user.profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    const newFlow: ChatFlowData = {
      flow: { ...req.body },
      name: req.body.name,
      isActive: true,
      userId: +req.user.id,
      tenantId,
      defaultQueueId: req.body.defaultQueueId
    };

    logger.info(`Creating new ChatFlow for tenant ${tenantId}`);
    const chatFlow = await CreateChatFlowService(newFlow);
    return res.status(200).json(chatFlow);
  } catch (err) {
    logger.error(`Error in ChatFlowController.store: ${err.message}`);
    throw err;
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { tenantId } = req.user;
    if (!tenantId) {
      logger.error("No tenantId provided in request");
      throw new AppError("Tenant ID is required", 400);
    }

    logger.info(`Listing ChatFlows for tenant ${tenantId}`);
    const chatFlow = await ListChatFlowService({ tenantId });
    return res.status(200).json(chatFlow);
  } catch (err) {
    logger.error(`Error in ChatFlowController.index: ${err.message}`);
    throw err;
  }
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (req.user.profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    const { tenantId } = req.user;
    if (!tenantId) {
      logger.error("No tenantId provided in request");
      throw new AppError("Tenant ID is required", 400);
    }

    const { chatFlowId } = req.params;
    if (!chatFlowId) {
      logger.error("No chatFlowId provided in request");
      throw new AppError("ChatFlow ID is required", 400);
    }

    const newFlow: ChatFlowData = {
      flow: { ...req.body },
      name: req.body.name,
      isActive: req.body.isReactive,
      userId: +req.user.id,
      tenantId,
      defaultQueueId: req.body.defaultQueueId
    };

    logger.info(`Updating ChatFlow ${chatFlowId} for tenant ${tenantId}`);
    const chatFlow = await UpdateChatFlowService({
      chatFlowData: newFlow,
      chatFlowId,
      tenantId
    });

    return res.status(200).json(chatFlow);
  } catch (err) {
    logger.error(`Error in ChatFlowController.update: ${err.message}`);
    throw err;
  }
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { chatFlowId } = req.params;
    const { tenantId } = req.user;

    if (!tenantId) {
      logger.error("No tenantId provided in request");
      throw new AppError("Tenant ID is required", 400);
    }

    if (!chatFlowId) {
      logger.error("No chatFlowId provided in request");
      throw new AppError("ChatFlow ID is required", 400);
    }

    logger.info(`Removing ChatFlow ${chatFlowId} for tenant ${tenantId}`);
    await DeleteChatFlowService({ id: chatFlowId, tenantId });
    return res.status(200).json({ message: "Flow deleted" });
  } catch (err) {
    logger.error(`Error in ChatFlowController.remove: ${err.message}`);
    throw err;
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { chatFlowId } = req.params;
    const { tenantId } = req.user;

    if (!tenantId) {
      logger.error("No tenantId provided in request");
      throw new AppError("Tenant ID is required", 400);
    }

    if (!chatFlowId) {
      logger.error("No chatFlowId provided in request");
      throw new AppError("ChatFlow ID is required", 400);
    }

    logger.info(`Fetching ChatFlow ${chatFlowId} for tenant ${tenantId}`);
    const chatFlow = await ShowChatFlowService({
      chatFlowId,
      tenantId
    });

    return res.status(200).json(chatFlow);
  } catch (err) {
    logger.error(`Error in ChatFlowController.show: ${err.message}`);
    throw err;
  }
};

// export const remove = async (
//   req: Request,
//   res: Response
// ): Promise<Response> => {
//   if (req.user.profile !== "admin") {
//     throw new AppError("ERR_NO_PERMISSION", 403);
//   }
//   const { tenantId } = req.user;
//   const { autoReplyId } = req.params;

//   await DeleteAutoReplyService({ id: autoReplyId, tenantId });
//   return res.status(200).json({ message: "Auto reply deleted" });
// };
