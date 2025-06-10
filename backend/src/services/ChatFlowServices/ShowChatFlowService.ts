import ChatFlow from "../../models/ChatFlow";
import AppError from "../../errors/AppError";

interface Request {
  chatFlowId: string;
  tenantId: string | number;
}

const ShowChatFlowService = async ({
  chatFlowId,
  tenantId
}: Request): Promise<ChatFlow> => {
  const chatFlow = await ChatFlow.findOne({
    where: { id: chatFlowId, tenantId, isDeleted: false }
  });

  if (!chatFlow) {
    throw new AppError("ERR_NO_CHATFLOW_FOUND", 404);
  }

  return chatFlow;
};

export default ShowChatFlowService; 