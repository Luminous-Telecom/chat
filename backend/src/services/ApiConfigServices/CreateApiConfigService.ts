// import AppError from "../../errors/AppError";
import { sign } from "jsonwebtoken";
import ApiConfig from "../../models/ApiConfig";
import authConfig from "../../config/auth";

interface Request {
  name: string;
  sessionId: string | number;
  urlServiceStatus?: string;
  urlMessageStatus?: string;
  authToken?: string;
  userId: string | number;
  tenantId: string | number;
}

const CreateApiConfigService = async ({
  name,
  sessionId,
  urlServiceStatus,
  urlMessageStatus,
  userId,
  authToken,
  tenantId,
}: Request): Promise<ApiConfig> => {
  const { secret } = authConfig;

  const token = sign(
    {
      tenantId,
      profile: "admin",
      sessionId,
    },
    secret,
    {
      expiresIn: "730d",
    }
  );

  const api = await ApiConfig.create({
    name,
    sessionId: Number(sessionId),
    token,
    authToken: authToken || "",
    urlServiceStatus: urlServiceStatus || "",
    urlMessageStatus: urlMessageStatus || "",
    userId: Number(userId),
    tenantId: Number(tenantId),
  } as any);

  return api;
};

export default CreateApiConfigService;
