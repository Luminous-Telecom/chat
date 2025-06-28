// import AppError from "../../errors/AppError";
import StepsReplyAction from "../../../models/StepsReplyAction";

interface Request {
  stepReplyId: number;
  words: string;
  action: number;
  userId: number;
  queueId?: number;
  userIdDestination?: number;
  nextStepId?: number;
  replyDefinition?: string;
}

const CreateStepsReplyActionService = async ({
  stepReplyId,
  words,
  action,
  userId,
  queueId,
  userIdDestination,
  nextStepId,
  replyDefinition,
}: Request): Promise<StepsReplyAction> => {
  const createData: any = {
    stepReplyId,
    words,
    action,
    userId,
  };

  // Only include optional fields if they have values
  if (queueId !== undefined) {
    createData.queueId = queueId;
  }
  if (userIdDestination !== undefined) {
    createData.userIdDestination = userIdDestination;
  }
  if (nextStepId !== undefined) {
    createData.nextStepId = nextStepId;
  }
  if (replyDefinition !== undefined) {
    createData.replyDefinition = replyDefinition;
  }

  const stepsReplyAction = await StepsReplyAction.create(createData);

  return stepsReplyAction;
};

export default CreateStepsReplyActionService;
