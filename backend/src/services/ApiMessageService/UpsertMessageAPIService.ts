import ApiMessage from "../../models/ApiMessage";
import { logger } from "../../utils/logger";
import socketEmit from "../../helpers/socketEmit";
import AppError from "../../errors/AppError";
import { MessageErrors } from "../../utils/errorHandler";

interface MessageData {
  sessionId: number;
  messageId: string;
  body: string;
  ack: number;
  number: number;
  mediaName?: string;
  mediaUrl?: string;
  timestamp: number;
  externalKey: string;
  // eslint-disable-next-line @typescript-eslint/ban-types
  messageWA: object;
  // eslint-disable-next-line @typescript-eslint/ban-types
  apiConfig: object;
  tenantId: number;
}

const UpsertMessageAPIService = async ({
  sessionId,
  messageId,
  body,
  ack,
  number,
  mediaName,
  mediaUrl,
  timestamp,
  externalKey,
  messageWA,
  apiConfig,
  tenantId
}: MessageData): Promise<ApiMessage> => {
  let message;

  const messageExists = await ApiMessage.findOne({
    where: { messageId, tenantId }
  });

  if (messageExists) {
    await messageExists.update({
      sessionId,
      messageId,
      body,
      ack,
      number,
      mediaName,
      mediaUrl,
      timestamp,
      externalKey,
      messageWA,
      apiConfig,
      tenantId
    });
    message = await messageExists.reload();
  } else {
    message = await ApiMessage.create({
      sessionId,
      messageId,
      body,
      ack,
      number,
      mediaName,
      mediaUrl,
      timestamp,
      externalKey,
      messageWA,
      apiConfig,
      tenantId
    });
  }

  if (!message) {
    throw MessageErrors.creationFailed(`API message creation failed for session ${sessionId}`);
  }

  return message;
};

export default UpsertMessageAPIService;
