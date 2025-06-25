import { proto, downloadMediaMessage } from "@whiskeysockets/baileys";
import {
  BaileysMessage,
  BaileysContact,
  BaileysChat,
  BaileysClient,
} from "../../types/baileys";

interface BaileysMessageWithDownload extends BaileysMessage {
  downloadMedia: () => Promise<Buffer | null>;
  dataPayload?: any;
}

export class BaileysMessageAdapter {
  static convertMessage(
    msg: proto.IWebMessageInfo,
    wbot?: BaileysClient
  ): BaileysMessageWithDownload {
    // VERIFICAÇÃO PRECOCE PARA REAÇÕES: Verificar logo no início se é uma reação
    if (msg.message) {
      const messageKeys = Object.keys(msg.message);
      const isReaction = messageKeys.includes('reactionMessage') || 
                         messageKeys.some(key => key.toLowerCase().includes('reaction'));
      
      if (isReaction) {
        console.log(`[BaileysMessageAdapter] DEBUG - Reaction message blocked at conversion:`, messageKeys);
        throw new Error('REACTION_MESSAGE_IGNORED');
      }
    }

    // Get message type from the message object - filtering out non-media context info
    const messageType = this.getCorrectMessageType(msg);

    // Extract message body correctly
    const body = this.getMessageBody(msg);

    const message: BaileysMessageWithDownload = {
      message: msg.message || undefined,
      key: msg.key,
      type: messageType,
      body,
      hasMedia: this.hasMedia(msg),
      fromMe: Boolean(msg.key.fromMe),
      from: this.getFromId(msg),
      to: this.getToId(msg),
      id: {
        id: msg.key.id || "",
        _serialized: msg.key.id || "",
      },
      timestamp: Number(msg.messageTimestamp) || 0,
      downloadMedia: async () => {
        if (!wbot || !msg.message) {
          // console.log('[BaileysMessageAdapter] No wbot or message available for download');
          return null;
        }

        const content =
          msg.message.imageMessage ||
          msg.message.videoMessage ||
          msg.message.audioMessage ||
          msg.message.documentMessage ||
          msg.message.stickerMessage;

        if (!content || typeof content !== "object" || !("url" in content)) {
          console.log(`[BaileysMessageAdapter] No valid media content found. Message type: ${messageType}`);
          console.log(`[BaileysMessageAdapter] Available message keys:`, Object.keys(msg.message || {}));
          console.log(`[BaileysMessageAdapter] Content object:`, content);
          return null;
        }

        // Tentar download com retry e timeout específico para tipo de mídia
        let retryCount = 0;
        const maxRetries = 2;
        const timeoutMs = messageType === 'stickerMessage' ? 10000 : 20000; // Timeout menor para stickers

        console.log(`[BaileysMessageAdapter] Starting download for ${messageType} with ${timeoutMs}ms timeout`);

        while (retryCount <= maxRetries) {
          try {
            console.log(`[BaileysMessageAdapter] Attempting to download media (attempt ${retryCount + 1}/${maxRetries + 1}) for message type: ${messageType}`);

            // Use timeout wrapper para evitar travamentos
            const buffer = await Promise.race([
              downloadMediaMessage(msg, "buffer", {}),
              new Promise<Buffer | null>((_, reject) =>
                setTimeout(() => reject(new Error(`Download timeout after ${timeoutMs}ms`)), timeoutMs)
              )
            ]);

            if (buffer && buffer.length > 0) {
              console.log(`[BaileysMessageAdapter] Successfully downloaded ${messageType}, buffer size: ${buffer.length}`);
              return buffer as Buffer;
            }
            
            console.log(`[BaileysMessageAdapter] Download returned null/empty buffer for ${messageType}`);
            if (retryCount === maxRetries) {
              return null;
            }
          } catch (error) {
            console.error(
              `[BaileysMessageAdapter] Error downloading ${messageType} (attempt ${
                retryCount + 1
              }):`,
              error.message || "Unknown error"
            );

            if (retryCount === maxRetries) {
              console.error(`[BaileysMessageAdapter] Final error details for ${messageType}:`, {
                messageType,
                hasUrl: !!content.url,
                contentKeys: Object.keys(content),
                errorMessage: error.message,
                stickerUrl: messageType === 'stickerMessage' ? content.url : 'N/A'
              });
              return null;
            }
          }

          retryCount++;
          if (retryCount <= maxRetries) {
            // Aguardar antes da próxima tentativa (tempo menor para stickers)
            const waitTime = messageType === 'stickerMessage' ? 500 : 1000 * retryCount;
            console.log(`[BaileysMessageAdapter] Waiting ${waitTime}ms before retry ${retryCount + 1} for ${messageType}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }

        return null;
      },
      getChat: async () => this.getChat(msg),
      getContact: async () => this.getContact(msg),
      toJSON: () => ({ ...msg }),
      dataPayload: this.getDataPayload(msg),
    };

    return message;
  }

  private static getMessageBody(msg: proto.IWebMessageInfo): string {
    return (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.buttonsResponseMessage?.selectedDisplayText ||
      msg.message?.listResponseMessage?.title ||
      msg.message?.buttonsMessage?.contentText ||
      msg.message?.templateButtonReplyMessage?.selectedDisplayText ||
      msg.message?.viewOnceMessage?.message?.conversation ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.listMessage?.description ||
      msg.message?.templateMessage?.hydratedTemplate?.hydratedContentText ||
      ""
    );
  }

  private static hasMedia(msg: proto.IWebMessageInfo): boolean {
    const messageType = Object.keys(msg.message || {})[0];
    return [
      "imageMessage",
      "videoMessage",
      "documentMessage",
      "audioMessage",
      "stickerMessage",
    ].includes(messageType);
  }

  // CORREÇÃO: Métodos para identificar corretamente from e to
  private static getFromId(msg: proto.IWebMessageInfo): string {
    if (msg.key.fromMe) {
      // Se a mensagem é minha, o "from" deve ser vazio ou meu próprio ID
      return "";
    }
    // Se a mensagem é recebida, o "from" é o remetente
    return msg.key.participant || msg.key.remoteJid || "";
  }

  private static getToId(msg: proto.IWebMessageInfo): string {
    if (msg.key.fromMe) {
      // Se a mensagem é minha, o "to" é o destinatário (remoteJid)
      return msg.key.remoteJid || "";
    }
    // Se a mensagem é recebida, o "to" deve ser vazio ou meu próprio ID
    return "";
  }

  private static async getChat(
    msg: proto.IWebMessageInfo
  ): Promise<BaileysChat> {
    const chatId = msg.key.remoteJid || "";
    const isGroup = chatId.endsWith("@g.us");

    return {
      id: {
        user: chatId.split("@")[0] || "",
        _serialized: chatId,
      },
      name: msg.pushName || "",
      isGroup,
      unreadCount: 0,
      timestamp: Number(msg.messageTimestamp) || Date.now(),
    };
  }

  private static async getContact(
    msg: proto.IWebMessageInfo
  ): Promise<BaileysContact> {
    // CORREÇÃO: Lógica melhorada para identificar o contato correto
    let contactJid: string;

    if (msg.key.fromMe) {
      // Mensagem enviada por mim - o contato é o destinatário
      contactJid = msg.key.remoteJid || "";

      // Se for grupo, o contato individual ainda é o remoteJid (o grupo)
      // Para mensagens em grupo enviadas por mim, o contato da conversa é o grupo
    } else if (msg.key.remoteJid?.endsWith("@g.us")) {
      // Em grupos, o remetente individual é o participant
      contactJid = msg.key.participant || msg.key.remoteJid || "";
    } else {
      // Em conversas individuais, o remetente é o remoteJid
      contactJid = msg.key.remoteJid || "";
    }

    const number = contactJid.split("@")[0] || "";
    const isGroup = contactJid.endsWith("@g.us");

    return {
      id: {
        user: number,
        _serialized: contactJid,
      },
      // CORREÇÃO: Para mensagens fromMe=true, não usar pushName pois representa o remetente (eu)
      name: msg.key.fromMe ? number : msg.pushName || "",
      pushname: msg.key.fromMe ? "" : msg.pushName || "",
      number,
      isGroup,
      isMe: Boolean(msg.key.fromMe),
      isWAContact: true,
      isMyContact: true,
      getProfilePicUrl: async () => "",
    };
  }

  private static getMediaMimetype(messageType: string, content: any): string {
    switch (messageType) {
      case "imageMessage":
        return content.mimetype || "image/jpeg";
      case "videoMessage":
        return content.mimetype || "video/mp4";
      case "documentMessage":
        return content.mimetype || "application/octet-stream";
      case "audioMessage":
        // Melhor detecção de áudio baseado no mimetype original ou fallback inteligente
        if (content.mimetype) {
          return content.mimetype;
        }
        // Verificar se é PTT (Push to Talk) ou áudio normal
        const isPtt = content.ptt || false;
        return isPtt ? "audio/ogg; codecs=opus" : "audio/mpeg";
      case "stickerMessage":
        return "image/webp";
      default:
        return "application/octet-stream";
    }
  }

  private static getMediaFilename(messageType: string, content: any): string {
    switch (messageType) {
      case "imageMessage":
        return content.fileName || `image-${Date.now()}.jpg`;
      case "videoMessage":
        return content.fileName || `video-${Date.now()}.mp4`;
      case "documentMessage":
        return content.fileName || `document-${Date.now()}`;
      case "audioMessage":
        if (content.fileName) {
          return content.fileName;
        }
        // Gerar nome baseado no tipo de áudio
        const isPtt = content.ptt || false;
        const timestamp = Date.now();
        if (isPtt) {
          return `ptt-${timestamp}.ogg`;
        }
        // Detectar extensão baseada no mimetype
        const mimetype = content.mimetype || "";
        if (mimetype.includes("mpeg") || mimetype.includes("mp3")) {
          return `audio-${timestamp}.mp3`;
        } else if (mimetype.includes("ogg")) {
          return `audio-${timestamp}.ogg`;
        } else if (mimetype.includes("wav")) {
          return `audio-${timestamp}.wav`;
        } else if (mimetype.includes("m4a")) {
          return `audio-${timestamp}.m4a`;
        }
        return `audio-${timestamp}.ogg`;
      case "stickerMessage":
        return `sticker-${Date.now()}.webp`;
      default:
        return `file-${Date.now()}`;
    }
  }

  private static getDataPayload(msg: proto.IWebMessageInfo): any {
    if (msg.message?.buttonsMessage) {
      return {
        buttons: msg.message.buttonsMessage.buttons?.map(btn => ({
          id: btn.buttonId,
          body: btn.buttonText?.displayText,
        })),
        footer: msg.message.buttonsMessage.footerText,
      };
    }
    if (msg.message?.listMessage) {
      return {
        buttons: msg.message.listMessage.sections,
        footer: msg.message.listMessage.footerText,
        title: msg.message.listMessage.title,
        buttonText: msg.message.listMessage.buttonText,
        description: msg.message.listMessage.description,
      };
    }
    return null;
  }

  private static getCorrectMessageType(msg: proto.IWebMessageInfo): string {
    if (!msg.message) return "chat";

    const messageKeys = Object.keys(msg.message);
    
    // Log para debug quando messageContextInfo é detectado
    if (messageKeys.includes("messageContextInfo")) {
      console.log(`[BaileysMessageAdapter] DEBUG - Message with messageContextInfo detected. All keys:`, messageKeys);
    }
    
    // Tipos que devem ser ignorados pois são contexto, não conteúdo real
    const ignoredTypes = [
      "messageContextInfo",
      "senderKeyDistributionMessage", 
      "reactionMessage",
      "pollCreationMessage",
      "pollUpdateMessage",
      "ephemeralMessage",
      "protocolMessage",
      "fastRatchetKeySenderKeyDistributionMessage"
    ];

    // VERIFICAÇÃO ESPECIAL PARA REAÇÕES: Se qualquer key contém "reaction", ignorar
    const hasReaction = messageKeys.some(key => 
      key.toLowerCase().includes('reaction') || 
      key === 'reactionMessage'
    );
    
    if (hasReaction) {
      console.log(`[BaileysMessageAdapter] DEBUG - Reaction message detected and ignored:`, messageKeys);
      return "reactionMessage"; // Retornar tipo que será ignorado
    }

    // Tipos de mídia válidos
    const mediaTypes = [
      "imageMessage",
      "videoMessage", 
      "audioMessage",
      "documentMessage",
      "stickerMessage",
      "contactMessage" // vCard
    ];

    // Tipos de texto/mensagem válidos
    const textTypes = [
      "conversation",
      "extendedTextMessage",
      "buttonsMessage",
      "listMessage",
      "templateMessage",
      "buttonsResponseMessage",
      "listResponseMessage",
      "templateButtonReplyMessage"
    ];

    // Procurar primeiro por tipos de mídia
    for (const key of messageKeys) {
      if (mediaTypes.includes(key)) {
        console.log(`[BaileysMessageAdapter] DEBUG - Detected media type: ${key}`);
        return key;
      }
    }

    // Depois procurar por tipos de texto
    for (const key of messageKeys) {
      if (textTypes.includes(key)) {
        console.log(`[BaileysMessageAdapter] DEBUG - Detected text type: ${key}`);
        return key;
      }
    }

    // Procurar por mensagens especiais como viewOnceMessage e ephemeralMessage
    if (msg.message.viewOnceMessage?.message) {
      console.log(`[BaileysMessageAdapter] DEBUG - Processing viewOnceMessage`);
      return this.getCorrectMessageType({ 
        message: msg.message.viewOnceMessage.message 
      } as proto.IWebMessageInfo);
    }

    if (msg.message.ephemeralMessage?.message) {
      console.log(`[BaileysMessageAdapter] DEBUG - Processing ephemeralMessage`);
      return this.getCorrectMessageType({ 
        message: msg.message.ephemeralMessage.message 
      } as proto.IWebMessageInfo);
    }

    // Filtrar tipos ignorados e pegar o primeiro tipo restante
    const validKeys = messageKeys.filter(key => !ignoredTypes.includes(key));
    
    if (validKeys.length > 0) {
      console.log(`[BaileysMessageAdapter] DEBUG - Using first valid key: ${validKeys[0]} from keys:`, messageKeys);
      return validKeys[0];
    }

    // Default para chat se nada for encontrado
    console.log(`[BaileysMessageAdapter] DEBUG - Defaulting to 'chat' for message keys:`, messageKeys);
    return "chat";
  }
}
