// import AppError from "../../errors/AppError";
import FastReply from "../../models/FastReply";

interface Request {
  key: string;
  message: string;
  userId: number;
  tenantId: number | string;
}

const CreateFastReplyService = async ({
  key,
  message,
  userId,
  tenantId,
}: Request): Promise<FastReply> => {
  const fastReplyData = await FastReply.create({
    key,
    message,
    userId,
    tenantId: typeof tenantId === 'string' ? parseInt(tenantId) : tenantId,
  } as any);

  return fastReplyData;
};

export default CreateFastReplyService;
