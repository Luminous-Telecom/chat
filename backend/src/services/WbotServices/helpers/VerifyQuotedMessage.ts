// import { WbotMessage } from '../../../types/baileys';
import Message from "../../../models/Message";
import { logger } from "../../../utils/logger";
import Ticket from "../../../models/Ticket";
import { BaileysMessage } from "../../../types/baileys";

const VerifyQuotedMessage = async (
  msg: BaileysMessage,
  ticket: Ticket
): Promise<Message | null> => {
  try {
    if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {

      return null;
    }

    // Extrair informações da mensagem citada
    const { contextInfo } = msg.message.extendedTextMessage;
    const quotedId = contextInfo.stanzaId;
    const quotedParticipant = contextInfo.participant;



    // Tentar encontrar a mensagem pelo messageId
    let quotedMsg = await Message.findOne({
      where: {
        messageId: quotedId ?? null,
        tenantId: ticket.tenantId,
      },
      include: [
        {
          model: Ticket,
          as: "ticket",
          where: { tenantId: ticket.tenantId },
        },
      ],
    });

    // Se não encontrar pelo messageId, tentar pelo id
    if (!quotedMsg && quotedId) {

      quotedMsg = await Message.findOne({
        where: {
          id: quotedId,
          tenantId: ticket.tenantId,
        },
        include: [
          {
            model: Ticket,
            as: "ticket",
            where: { tenantId: ticket.tenantId },
          },
        ],
      });
    }

    // Verificar se encontrou a mensagem
    if (!quotedMsg) {

      return null;
    }


    return quotedMsg;
  } catch (error) {

    return null;
  }
};

export default VerifyQuotedMessage;
