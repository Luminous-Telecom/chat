import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as ChatFlowController from "../controllers/ChatFlowController";
import { getBaileys } from "../libs/baileys";
import AppError from "../errors/AppError";
import ChatFlow from "../models/ChatFlow";
import Whatsapp from "../models/Whatsapp";

const chatFlowRoutes = Router();

chatFlowRoutes.get("/", isAuth, ChatFlowController.index);

chatFlowRoutes.get("/:chatFlowId", isAuth, ChatFlowController.show);

chatFlowRoutes.post("/", isAuth, ChatFlowController.store);

chatFlowRoutes.put("/:chatFlowId", isAuth, ChatFlowController.update);

chatFlowRoutes.delete("/:chatFlowId", isAuth, ChatFlowController.remove);

chatFlowRoutes.post("/:chatFlowId/test", isAuth, async (req, res) => {
  try {
    const { chatFlowId } = req.params;
    const { whatsappId, testNumber } = req.body;

    const chatFlow = await ChatFlow.findByPk(chatFlowId);
    if (!chatFlow) {
      throw new AppError("ERR_NO_CHATFLOW_FOUND");
    }

    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WHATSAPP_FOUND");
    }

    const wbot = getBaileys(whatsappId);
    if (!wbot) {
      throw new AppError("ERR_NO_WHATSAPP_SESSION");
    }

    // Enviar mensagem inicial do fluxo
    const startNode = chatFlow.flow.nodeList.find(n => n.type === "start");
    if (!startNode) {
      throw new AppError("ERR_NO_START_NODE");
    }

    const message = startNode.message;
    const mediaUrl = startNode.mediaUrl;
    const mediaType = startNode.mediaType;

    let messageContent: any = { conversation: message };

    if (mediaUrl) {
      switch (mediaType) {
        case 'image':
          messageContent = { imageMessage: { url: mediaUrl } };
          break;
        case 'video':
          messageContent = { videoMessage: { url: mediaUrl } };
          break;
        case 'audio':
          messageContent = { audioMessage: { url: mediaUrl } };
          break;
        case 'document':
          messageContent = { 
            documentMessage: { 
              url: mediaUrl,
              fileName: startNode.mediaName || 'document'
            }
          };
          break;
      }
    }

    // Enviar mensagem de teste
    await wbot.sendMessage(
      testNumber + '@s.whatsapp.net',
      messageContent
    );

    return res.json({ message: "Chat flow test started successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

chatFlowRoutes.post("/:chatFlowId/activate", isAuth, async (req, res) => {
  try {
    const { chatFlowId } = req.params;

    const chatFlow = await ChatFlow.findByPk(chatFlowId);
    if (!chatFlow) {
      throw new AppError("ERR_NO_CHATFLOW_FOUND");
    }

    // Ativar fluxo
    await chatFlow.update({ 
      status: "ACTIVE",
      activatedAt: Date.now()
    });

    return res.json({ message: "Chat flow activated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

chatFlowRoutes.post("/:chatFlowId/deactivate", isAuth, async (req, res) => {
  try {
    const { chatFlowId } = req.params;

    const chatFlow = await ChatFlow.findByPk(chatFlowId);
    if (!chatFlow) {
      throw new AppError("ERR_NO_CHATFLOW_FOUND");
    }

    // Desativar fluxo
    await chatFlow.update({ 
      status: "INACTIVE",
      deactivatedAt: Date.now()
    });

    return res.json({ message: "Chat flow deactivated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default chatFlowRoutes;
