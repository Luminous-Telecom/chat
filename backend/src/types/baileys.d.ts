import {
  proto,
  WASocket,
  AnyMessageContent,
  WAMessageKey,
  WASocketEvents,
} from "@whiskeysockets/baileys";

// Mapeamento de tipos do Baileys para whatsapp-web.js
export interface BaileysMessage extends proto.IWebMessageInfo {
  key: proto.IMessageKey;
  message: proto.IMessage | undefined;
  // Adicionar propriedades compatíveis com whatsapp-web.js
  type: string;
  body: string;
  hasMedia: boolean;
  fromMe: boolean;
  from: string;
  to: string;
  id: {
    id: string;
    _serialized: string;
  };
  timestamp: number;
  getChat: () => Promise<BaileysChat>;
  getContact: () => Promise<BaileysContact>;
  toJSON: () => { [k: string]: any };
}

export interface BaileysContact {
  id: {
    user: string;
    _serialized: string;
  };
  name?: string;
  pushname?: string;
  number: string;
  isGroup: boolean;
  isMe: boolean;
  isWAContact: boolean;
  isMyContact: boolean;
  getProfilePicUrl: () => Promise<string>;
}

export interface BaileysChat {
  id: {
    user: string;
    _serialized: string;
  };
  name: string;
  isGroup: boolean;
  unreadCount: number;
  timestamp: number;
}

export interface BaileysClient extends WASocket {
  id: number;
  getContactById: (id: string) => Promise<BaileysContact>;
  sendMessage: (
    to: string,
    content: any,
    options?: any
  ) => Promise<BaileysMessage>;
  getNumberId: (number: string) => Promise<{ _serialized: string }>;
  logout: () => Promise<void>;
  ev: WASocket["ev"];
}

// Tipos para eventos
export interface BaileysMessageAck {
  id: string;
  ack: number;
  fromMe: boolean;
}

export interface BaileysMessageStatus {
  id: string;
  status: string;
  fromMe: boolean;
}

// Exportar tipos globais
declare global {
  type WbotMessage = BaileysMessage;
  type WbotContact = BaileysContact;
  type Session = BaileysClient;
}
