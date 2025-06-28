// import AppError from "../../errors/AppError";
import AutoReplyLogs from "../../models/AutoReplyLogs";
import StepsReply from "../../models/StepsReply";
import Ticket from "../../models/Ticket";

const CreateAutoReplyLogService = async (
  stepsReply: StepsReply,
  ticket: Ticket,
  msg: string
): Promise<AutoReplyLogs> => {
  const log = {
    autoReplyId: stepsReply.idAutoReply.toString(),
    autoReplyName: stepsReply.autoReply.name,
    stepsReplyId: stepsReply.id,
    stepsReplyMessage: stepsReply.reply,
    wordsReply: msg,
    ticketId: ticket.id,
    contactId: ticket.contactId,
  };
  const autoReplyLog = await AutoReplyLogs.create(log as any);

  return autoReplyLog;
};

export default CreateAutoReplyLogService;
