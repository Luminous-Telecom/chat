import AppError from "../../errors/AppError";
import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";

interface Request {
  name: string;
  status?: string;
  isDefault?: boolean;
  tenantId: number;
  tokenTelegram?: string;
  instagramUser?: string;
  instagramKey?: string;
  wabaBSP?: string;
  tokenAPI?: string;
  fbPageId?: string;
  farewellMessage?: string;
  type: "waba" | "instagram" | "telegram" | "whatsapp" | "messenger";
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const CreateWhatsAppService = async ({
  name,
  status = "DISCONNECTED",
  tenantId,
  tokenTelegram,
  instagramUser,
  instagramKey,
  type,
  wabaBSP,
  tokenAPI,
  fbPageId,
  farewellMessage,
  isDefault = false,
}: Request): Promise<Response> => {
  if (type === "waba" && (!tokenAPI || !wabaBSP)) {
    throw new AppError("WABA: favor informar o Token e a BSP");
  }

  if (type === "instagram" && !instagramUser) {
    throw new AppError(
      "Instagram: favor informar o Usuário e senha corretamente."
    );
  }

  if (type === "telegram" && !tokenTelegram) {
    throw new AppError("Telegram: favor informar o Token.");
  }

  const whatsappFound = await Whatsapp.findOne({
    where: { tenantId, isDefault: true },
  });

  if (!whatsappFound) {
    isDefault = !whatsappFound;
  }

  if (isDefault) {
    if (whatsappFound) {
      await whatsappFound.update({ isDefault: false });
    }
  }

  try {
    const whatsappData: any = {
    name,
    status,
    isDefault,
    tenantId,
    type,
  };

  if (tokenTelegram !== undefined) whatsappData.tokenTelegram = tokenTelegram;
  if (instagramUser !== undefined) whatsappData.instagramUser = instagramUser;
  if (instagramKey !== undefined) whatsappData.instagramKey = instagramKey;
  if (wabaBSP !== undefined) whatsappData.wabaBSP = wabaBSP;
  if (tokenAPI !== undefined) whatsappData.tokenAPI = tokenAPI;
  if (fbPageId !== undefined) whatsappData.fbPageId = fbPageId;
  if (farewellMessage !== undefined) whatsappData.farewellMessage = farewellMessage;

  const whatsapp = await Whatsapp.create(whatsappData);
    const io = getIO();
    io.emit(`${tenantId}:whatsapp`, {
      action: "update",
      whatsapp,
    });

    return { whatsapp, oldDefaultWhatsapp: whatsappFound };
  } catch (error) {
    logger.error(error);
    throw new AppError("ERR_CREATE_WAPP", 404);
  }
};

export default CreateWhatsAppService;
