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
    
    const message: BaileysMessageWithDownload = {
      message: msg.message || undefined,
      key: msg.key,
      type: messageType,
      body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
      hasMedia: !!(
        msg.message?.imageMessage || 
        msg.message?.videoMessage || 
        msg.message?.audioMessage || 
        msg.message?.documentMessage
      ),
      fromMe: Boolean(msg.key.fromMe),
      from: msg.key.remoteJid || '',
      to: msg.key.remoteJid || '',
      id: {
        id: msg.key.id || '',
        _serialized: msg.key.id || ''
      },
      timestamp: Number(msg.messageTimestamp) || 0,
      downloadMedia: async () => {
        if (!wbot || !msg.message) return null;

        const content = msg.message.imageMessage || 
                       msg.message.videoMessage || 
                       msg.message.audioMessage || 
                       msg.message.documentMessage;

        if (!content || typeof content !== 'object' || !('url' in content)) return null;

        try {
          // Use the imported downloadMediaMessage function
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          return buffer as Buffer;
        } catch (error) {
          console.error('Error downloading media:', error);
          return null;
        }
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

    return '';
  }

  private static hasMedia(msg: proto.IWebMessageInfo): boolean {
    const messageType = Object.keys(msg.message || {})[0];
    return ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'stickerMessage'].includes(messageType);
  }

  private static async getChat(msg: proto.IWebMessageInfo): Promise<BaileysChat> {
    return {
      id: {
        user: msg.key.remoteJid?.split('@')[0] || '',
        _serialized: msg.key.remoteJid || ''
      },
      name: msg.pushName || '',
      isGroup: Boolean(msg.key.remoteJid?.endsWith('@g.us')),
      unreadCount: 0,
      timestamp: Number(msg.messageTimestamp) || Date.now(),
    };
  }

  private static async getContact(msg: proto.IWebMessageInfo): Promise<BaileysContact> {
    const number = msg.key.remoteJid?.split('@')[0] || '';
    return {
      id: {
        user: number,
        _serialized: msg.key.remoteJid || ''
      },
      name: msg.pushName || '',
      pushname: msg.pushName || '',
      number,
      isGroup: Boolean(msg.key.remoteJid?.endsWith('@g.us')),
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

  // Note: convertContact method removed as proto.Contact is not available in current Baileys version
}