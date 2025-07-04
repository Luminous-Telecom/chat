// import { Op } from "sequelize";
import { Op } from "sequelize";
import AutoReply from "../../models/AutoReply";
import StepsReply from "../../models/StepsReply";
// import StepsReply from "../../models/StepsReply";
import StepsReplyAction from "../../models/StepsReplyAction";
// import AppError from "../../errors/AppError";

const VerifyActionStepAutoReplyService = async (
  stepAutoReplyId: number,
  msg: string,
  tenantId: number | string
): Promise<StepsReplyAction | null> => {
  if (!msg) {
    return null;
  }
  const actions = await StepsReplyAction.findOne({
    where: {
      stepReplyId: stepAutoReplyId,
      words: {
        [Op.iLike]: `%${msg}%`
      }
    },
    include: [
      {
        model: StepsReply,
        as: "stepsReply",
        include: [{ model: AutoReply, as: "autoReply", where: { tenantId } }],
      },
    ],
    // include: [
    //   {
    //     model: StepsReply,
    //     where: { id: stepAutoReplyId }, // action 0 - AutoReply Criacao ticket ou 1 - Resolução do ticket
    //     attributes: ["id", "reply", "stepOrder"]
    //   }
    // ]
  });
  // if (!actions) {
  //   return null;
  // }
  return actions;
};

export default VerifyActionStepAutoReplyService;
