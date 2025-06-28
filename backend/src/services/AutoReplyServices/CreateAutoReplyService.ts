// import AppError from "../../errors/AppError";
import AutoReply from "../../models/AutoReply";

interface Request {
  name: string;
  action: number;
  userId: number;
  tenantId: number | string;
}

const CreateAutoReplyService = async ({
  name,
  action,
  userId,
  tenantId,
}: Request): Promise<AutoReply> => {
  const autoReply = await AutoReply.create({
    name,
    action,
    userId,
    tenantId: typeof tenantId === 'string' ? parseInt(tenantId, 10) : tenantId,
  } as any);

  return autoReply;
};

export default CreateAutoReplyService;
