// import AppError from "../../errors/AppError";
import StepsReply from "../../../models/StepsReply";

interface Request {
  reply: string;
  idAutoReply: number;
  userId?: number;
  initialStep: boolean;
}

const CreateStepsReplyService = async ({
  reply,
  idAutoReply,
  userId,
  initialStep,
}: Request): Promise<StepsReply> => {
  const createData: any = {
    reply,
    idAutoReply,
    initialStep,
  };

  // Only include userId if it has a value
  if (userId !== undefined) {
    createData.userId = userId;
  }

  const stepsReply = await StepsReply.create(createData);

  return stepsReply;
};

export default CreateStepsReplyService;
