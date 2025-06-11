import { proto } from '@whiskeysockets/baileys';
import { BaileysMessage, BaileysContact, BaileysChat } from '../../types/baileys';
import { BaileysClient } from '../../types/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

interface BaileysMessageWithDownload extends BaileysMessage {
  downloadMedia: () => Promise<Buffer | null>;
}

export class BaileysMessageAdapter {
  static convertMessage(msg: proto.IWebMessageInfo, wbot?: BaileysClient): BaileysMessageWithDownload {
    // Get message type from the message object
    const messageType = msg.message ? Object.keys(msg.message)[0] : 'chat';
    
    // Extract message body correctly
    const body = this.getMessageBody(msg);
    
    const message: BaileysMessageWithDownload = {
      message: msg.message || undefined,
      key: msg.key,
      type: messageType,
      body: body,
      hasMedia: this.hasMedia(msg),
      fromMe: Boolean(msg.key.fromMe),
      from: this.getFromId(msg),
      to: this.getToId(msg),
      id: {
        id: msg.key.id || '',
        _serialized: msg.key.id || ''
      },
      timestamp: Number(msg.messageTimestamp) || 0,
      downloadMedia: async () => {
        if (!wbot || !msg.message) {
          console.log('[BaileysMessageAdapter] No wbot or message available for download');
          return null;
        }

        const content = msg.message.imageMessage || 
                       msg.message.videoMessage || 
                       msg.message.audioMessage || 
                       msg.message.documentMessage;

        if (!content || typeof content !== 'object' || !('url' in content)) {
          console.log('[BaileysMessageAdapter] No valid media content found. Message type:', messageType);
          console.log('[BaileysMessageAdapter] Available message keys:', Object.keys(msg.message || {}));
          return null;
        }

        // Tentar download com retry
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
          try {
            console.log(`[BaileysMessageAdapter] Attempting to download media (attempt ${retryCount + 1}/${maxRetries + 1}) for message type:`, messageType);
            
            // Use the imported downloadMediaMessage function
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            
            if (buffer && buffer.length > 0) {
              console.log('[BaileysMessageAdapter] Successfully downloaded media, buffer size:', buffer.length);
              return buffer as Buffer;
            } else {
              console.log('[BaileysMessageAdapter] Download returned null/empty buffer');
              if (retryCount === maxRetries) {
                return null;
              }
            }
          } catch (error) {
            console.error(`[BaileysMessageAdapter] Error downloading media (attempt ${retryCount + 1}):`, error.message || 'Unknown error');
            
            if (retryCount === maxRetries) {
              console.error('[BaileysMessageAdapter] Final error details:', {
                messageType,
                hasUrl: !!content.url,
                contentKeys: Object.keys(content),
                errorMessage: error.message
              });
              return null;
            }
          }
          
          retryCount++;
          if (retryCount <= maxRetries) {
            // Aguardar antes da próxima tentativa
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
        
        return null;
      },
      getChat: async () => this.getChat(msg),
      getContact: async () => this.getContact(msg),
      toJSON: () => ({ ...msg })
    };

    return message;
  }

  private static getMessageBody(msg: proto.IWebMessageInfo): string {
    const messageType = Object.keys(msg.message || {})[0];
    const content = msg.message?.[messageType as keyof proto.IMessage];

    if (messageType === 'conversation') {
      return (content as string) || '';
    }
    
    if (messageType === 'extendedTextMessage') {
      return (content as proto.Message.IExtendedTextMessage)?.text || '';
    }

    if (messageType === 'imageMessage') {
      return (content as proto.Message.IImageMessage)?.caption || '';
    }

    if (messageType === 'videoMessage') {
      return (content as proto.Message.IVideoMessage)?.caption || '';
    }

    if (messageType === 'documentMessage') {
      return (content as proto.Message.IDocumentMessage)?.fileName || '';
    }

    if (messageType === 'audioMessage') {
      return 'Áudio';
    }

    if (messageType === 'stickerMessage') {
      return 'Figurinha';
    }

    return '';
  }

  private static hasMedia(msg: proto.IWebMessageInfo): boolean {
    const messageType = Object.keys(msg.message || {})[0];
    return ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'stickerMessage'].includes(messageType);
  }

  // CORREÇÃO: Métodos para identificar corretamente from e to
  private static getFromId(msg: proto.IWebMessageInfo): string {
    if (msg.key.fromMe) {
      // Se a mensagem é minha, o "from" deve ser vazio ou meu próprio ID
      return '';
    } else {
      // Se a mensagem é recebida, o "from" é o remetente
      return msg.key.participant || msg.key.remoteJid || '';
    }
  }

  private static getToId(msg: proto.IWebMessageInfo): string {
    if (msg.key.fromMe) {
      // Se a mensagem é minha, o "to" é o destinatário (remoteJid)
      return msg.key.remoteJid || '';
    } else {
      // Se a mensagem é recebida, o "to" deve ser vazio ou meu próprio ID
      return '';
    }
  }

  private static async getChat(msg: proto.IWebMessageInfo): Promise<BaileysChat> {
    const chatId = msg.key.remoteJid || '';
    const isGroup = chatId.endsWith('@g.us');
    
    return {
      id: {
        user: chatId.split('@')[0] || '',
        _serialized: chatId
      },
      name: msg.pushName || '',
      isGroup: isGroup,
      unreadCount: 0,
      timestamp: Number(msg.messageTimestamp) || Date.now(),
    };
  }

  private static async getContact(msg: proto.IWebMessageInfo): Promise<BaileysContact> {
    // CORREÇÃO: Lógica melhorada para identificar o contato correto
    let contactJid: string;
    
    if (msg.key.fromMe) {
      // Mensagem enviada por mim - o contato é o destinatário
      contactJid = msg.key.remoteJid || '';
      
      // Se for grupo, o contato individual ainda é o remoteJid (o grupo)
      // Para mensagens em grupo enviadas por mim, o contato da conversa é o grupo
    } else {
      // Mensagem recebida - o contato é o remetente
      if (msg.key.remoteJid?.endsWith('@g.us')) {
        // Em grupos, o remetente individual é o participant
        contactJid = msg.key.participant || msg.key.remoteJid || '';
      } else {
        // Em conversas individuais, o remetente é o remoteJid
        contactJid = msg.key.remoteJid || '';
      }
    }
    
    const number = contactJid.split('@')[0] || '';
    const isGroup = contactJid.endsWith('@g.us');
    
    return {
      id: {
        user: number,
        _serialized: contactJid
      },
      // CORREÇÃO: Para mensagens fromMe=true, não usar pushName pois representa o remetente (eu)
      name: msg.key.fromMe ? number : (msg.pushName || ''),
      pushname: msg.key.fromMe ? '' : (msg.pushName || ''),
      number,
      isGroup,
      isMe: Boolean(msg.key.fromMe),
      isWAContact: true,
      isMyContact: true,
      getProfilePicUrl: async () => ''
    };
  }

  private static getMediaMimetype(messageType: string, content: any): string {
    switch (messageType) {
      case 'imageMessage':
        return content.mimetype || 'image/jpeg';
      case 'videoMessage':
        return content.mimetype || 'video/mp4';
      case 'documentMessage':
        return content.mimetype || 'application/octet-stream';
      case 'audioMessage':
        return content.mimetype || 'audio/ogg; codecs=opus';
      case 'stickerMessage':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }

  private static getMediaFilename(messageType: string, content: any): string {
    switch (messageType) {
      case 'imageMessage':
        return content.fileName || `image-${Date.now()}.jpg`;
      case 'videoMessage':
        return content.fileName || `video-${Date.now()}.mp4`;
      case 'documentMessage':
        return content.fileName || `document-${Date.now()}`;
      case 'audioMessage':
        return content.fileName || `audio-${Date.now()}.ogg`;
      case 'stickerMessage':
        return `sticker-${Date.now()}.webp`;
      default:
        return `file-${Date.now()}`;
    }
  }
}