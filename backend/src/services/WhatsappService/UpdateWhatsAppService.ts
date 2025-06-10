import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";

interface WhatsappData {
  name?: string;
  status?: string;
  session?: string;
  isDefault?: boolean;
  tokenTelegram?: string;
  instagramUser?: string;
  instagramKey?: string;
  isActive?: boolean;
  type?: "waba" | "instagram" | "telegram" | "whatsapp" | "messenger";
  wabaBSP?: string;
  tokenAPI?: string;
  fbPageId?: string;
  farewellMessage?: string;
  chatFlowId?: number | null;
}

interface Request {
  whatsappData: WhatsappData;
  whatsappId: number;
  tenantId: number;
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

interface ValidatedData {
  name?: string;
  status?: string;
  isDefault?: boolean;
  type?: "waba" | "instagram" | "telegram" | "whatsapp" | "messenger";
  chatFlowId: number | null;
}

const UpdateWhatsAppService = async ({
  whatsappData,
  whatsappId,
  tenantId
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    isDefault: Yup.boolean(),
    type: Yup.string().oneOf(["waba", "instagram", "telegram", "whatsapp", "messenger"]),
    chatFlowId: Yup.mixed().transform((value) => {
      if (value === null || value === undefined || value === "") return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    }).nullable()
  });

  const {
    name,
    status,
    isDefault,
    session,
    tokenTelegram,
    instagramUser,
    instagramKey,
    isActive,
    type,
    wabaBSP,
    tokenAPI,
    fbPageId,
    farewellMessage,
    chatFlowId
  } = whatsappData;

  try {
    const validatedData = await schema.validate({ 
      name, 
      status, 
      isDefault, 
      type, 
      chatFlowId 
    }) as ValidatedData;

    let oldDefaultWhatsapp: Whatsapp | null = null;

    if (isDefault) {
      oldDefaultWhatsapp = await Whatsapp.findOne({
        where: { isDefault: true, tenantId, id: { [Op.not]: whatsappId } }
      });
      if (oldDefaultWhatsapp) {
        await oldDefaultWhatsapp.update({ isDefault: false });
      }
    }

    const whatsapp = await Whatsapp.findOne({
      where: { id: whatsappId, tenantId }
    });

    if (!whatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }

    const data: WhatsappData = {
      name: validatedData.name,
      status,
      session,
      isDefault: validatedData.isDefault,
      tokenTelegram,
      instagramUser,
      isActive,
      type: validatedData.type,
      wabaBSP,
      tokenAPI,
      fbPageId,
      farewellMessage,
      chatFlowId: validatedData.chatFlowId
    };

    if (instagramKey) {
      data.instagramKey = instagramKey;
    }

    await whatsapp.update(data);

    return { whatsapp, oldDefaultWhatsapp };
  } catch (err: any) {
    if (err instanceof Yup.ValidationError) {
      throw new AppError(err.message, 400);
    }
    throw new AppError(err.message);
  }
};

export default UpdateWhatsAppService;
