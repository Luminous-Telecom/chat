import { proto } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import MediaHandler from "./MediaHandler";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";
import { Op } from "sequelize";
import { promisify } from "util";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as mime from "mime-types";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execAsync = promisify(exec);

// Configurar ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface AudioInfo {
  duration: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  format: string;
  codec: string;
  size: number;
  mimeType: string;
  hash: string;
}

interface DocumentInfo {
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageCount?: number;
  isEncrypted?: boolean;
  isCompressed?: boolean;
  extension: string;
  hash: string;
}

export default class AudioDocumentHandler {
  private static instance: AudioDocumentHandler;
  private mediaHandler: MediaHandler;
  private readonly MAX_AUDIO_DURATION = 300; // 5 minutes in seconds
  private readonly MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB
  private readonly MAX_DOCUMENT_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly SUPPORTED_AUDIO_FORMATS = ["mp3", "ogg", "m4a", "opus"];
  private readonly SUPPORTED_DOCUMENT_FORMATS = [
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
    "csv",
    "zip",
    "rar",
    "7z",
    "tar",
    "gz"
  ];

  private constructor() {
    this.mediaHandler = MediaHandler.getInstance();
  }

  public static getInstance(): AudioDocumentHandler {
    if (!AudioDocumentHandler.instance) {
      AudioDocumentHandler.instance = new AudioDocumentHandler();
    }
    return AudioDocumentHandler.instance;
  }

  private async getAudioInfo(filePath: string): Promise<AudioInfo> {
    try {
      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) {
            reject(new AppError("ERR_MEDIA_METADATA"));
          }

          const audioStream = metadata.streams.find(s => s.codec_type === "audio");
          if (!audioStream) {
            reject(new AppError("ERR_MEDIA_FORMAT"));
          }

          // Calcular hash do arquivo
          const crypto = require("crypto");
          const fileBuffer = fs.readFileSync(filePath);
          const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

          resolve({
            duration: metadata.format.duration || 0,
            bitrate: metadata.format.bit_rate ? Number(metadata.format.bit_rate) : 0,
            sampleRate: audioStream?.sample_rate ? Number(audioStream.sample_rate) : 0,
            channels: audioStream?.channels || 0,
            format: metadata.format.format_name || "",
            codec: audioStream?.codec_name || "",
            size: metadata.format.size ? Number(metadata.format.size) : 0,
            mimeType: mime.lookup(filePath) || "audio/mpeg",
            hash
          });
        });
      });
    } catch (err) {
      logger.error("Error getting audio info:", err);
      throw new AppError("ERR_MEDIA_METADATA");
    }
  }

  private async getDocumentInfo(filePath: string): Promise<DocumentInfo> {
    try {
      const stats = await fs.promises.stat(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";
      const extension = path.extname(filePath).toLowerCase().slice(1);
      const fileName = path.basename(filePath);

      // Calcular hash do arquivo
      const fileBuffer = await fs.promises.readFile(filePath);
      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      // Verificar se é um PDF para obter número de páginas
      let pageCount;
      if (extension === "pdf") {
        try {
          const { stdout } = await execAsync(`pdfinfo "${filePath}" | grep Pages`);
          const match = stdout.match(/Pages:\s+(\d+)/);
          if (match) {
            pageCount = parseInt(match[1]);
          }
        } catch (err) {
          logger.error("Error getting PDF page count:", err);
        }
      }

      return {
        fileName,
        fileSize: stats.size,
        mimeType,
        pageCount,
        isEncrypted: false, // Implementar verificação de criptografia se necessário
        isCompressed: ["zip", "rar", "7z", "tar", "gz"].includes(extension),
        extension,
        hash
      };
    } catch (err) {
      logger.error("Error getting document info:", err);
      throw new AppError("ERR_MEDIA_METADATA");
    }
  }

  private async validateAudio(audioInfo: AudioInfo): Promise<void> {
    if (audioInfo.duration > this.MAX_AUDIO_DURATION) {
      throw new AppError("ERR_MEDIA_DURATION");
    }

    if (audioInfo.size > this.MAX_AUDIO_SIZE) {
      throw new AppError("ERR_MEDIA_SIZE");
    }

    if (!this.SUPPORTED_AUDIO_FORMATS.includes(audioInfo.format)) {
      throw new AppError("ERR_MEDIA_FORMAT");
    }

    if (audioInfo.bitrate > 320000) { // 320kbps
      throw new AppError("ERR_MEDIA_BITRATE");
    }

    if (audioInfo.sampleRate > 48000) { // 48kHz
      throw new AppError("ERR_MEDIA_SAMPLE_RATE");
    }

    if (audioInfo.channels > 2) { // Stereo
      throw new AppError("ERR_MEDIA_CHANNELS");
    }
  }

  private async validateDocument(docInfo: DocumentInfo): Promise<void> {
    if (docInfo.fileSize > this.MAX_DOCUMENT_SIZE) {
      throw new AppError("ERR_MEDIA_SIZE");
    }

    if (!this.SUPPORTED_DOCUMENT_FORMATS.includes(docInfo.extension)) {
      throw new AppError("ERR_MEDIA_FORMAT");
    }

    // Verificar se o arquivo está corrompido
    if (docInfo.extension === "pdf") {
      try {
        await execAsync(`pdfinfo "${docInfo.fileName}"`);
      } catch (err) {
        throw new AppError("ERR_MEDIA_CORRUPTION");
      }
    }

    // Verificar se o arquivo está infectado
    try {
      await execAsync(`clamscan "${docInfo.fileName}"`);
    } catch (err) {
      throw new AppError("ERR_MEDIA_VIRUS");
    }
  }

  private async compressAudio(inputPath: string, outputPath: string): Promise<void> {
    try {
      return new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .audioBitrate(128) // 128kbps
          .audioChannels(2) // Stereo
          .audioFrequency(44100) // 44.1kHz
          .output(outputPath);

        command
          .on("end", () => resolve())
          .on("error", (err) => reject(new AppError("ERR_AUDIO_COMPRESSION")))
          .run();
      });
    } catch (err) {
      logger.error("Error compressing audio:", err);
      throw new AppError("ERR_AUDIO_COMPRESSION");
    }
  }

  public async handleAudioMessage(
    message: proto.IWebMessageInfo,
    ticket: Ticket,
    contact: Contact,
    whatsapp: Whatsapp
  ): Promise<void> {
    try {
      const audioMessage = message.message?.audioMessage;
      if (!audioMessage) {
        throw new AppError("ERR_NO_MEDIA_MESSAGE");
      }

      // Download do áudio
      const mediaInfo = await this.mediaHandler.downloadMedia(message);
      if (!mediaInfo) {
        throw new AppError("ERR_MEDIA_DOWNLOAD");
      }

      // Salvar arquivo temporário
      const tempPath = path.join(process.cwd(), "temp", `${Date.now()}.ogg`);
      const fileBuffer = await fs.promises.readFile(mediaInfo.filename);
      await fs.promises.writeFile(tempPath, fileBuffer);

      // Obter informações do áudio
      const audioInfo = await this.getAudioInfo(tempPath);
      await this.validateAudio(audioInfo);

      // Comprimir se necessário
      let finalPath = tempPath;
      if (audioInfo.size > 5 * 1024 * 1024) { // 5MB
        const compressedPath = path.join(process.cwd(), "temp", `compressed_${Date.now()}.ogg`);
        await this.compressAudio(tempPath, compressedPath);
        finalPath = compressedPath;
      }

      // Criar mensagem no banco
      const messageRecord = await Message.create({
        ticketId: ticket.id,
        body: "🎵 Audio Message",
        fromMe: false,
        read: true,
        mediaType: "audio",
        mediaUrl: finalPath,
        mediaName: `audio_${Date.now()}.ogg`,
        mediaSize: audioInfo.size,
        mediaMimeType: audioInfo.mimeType,
        mediaDuration: audioInfo.duration,
        mediaHash: audioInfo.hash,
        mediaMetadata: JSON.stringify(audioInfo)
      });

      // Emitir evento
      const io = getIO();
      io.to(ticket.id.toString()).emit("appMessage", {
        action: "create",
        message: messageRecord,
        ticket,
        contact
      });

      // Limpar arquivos temporários
      await fs.promises.unlink(tempPath);
      if (finalPath !== tempPath) {
        await fs.promises.unlink(finalPath);
      }
    } catch (err) {
      logger.error("Error handling audio message:", err);
      throw err;
    }
  }

  public async handleDocumentMessage(
    message: proto.IWebMessageInfo,
    ticket: Ticket,
    contact: Contact,
    whatsapp: Whatsapp
  ): Promise<void> {
    try {
      const documentMessage = message.message?.documentMessage;
      if (!documentMessage) {
        throw new AppError("ERR_NO_MEDIA_MESSAGE");
      }

      // Download do documento
      const mediaInfo = await this.mediaHandler.downloadMedia(message);
      if (!mediaInfo) {
        throw new AppError("ERR_MEDIA_DOWNLOAD");
      }

      // Salvar arquivo temporário
      const fileName = documentMessage.fileName || `document_${Date.now()}`;
      const tempPath = path.join(process.cwd(), "temp", fileName);
      const fileBuffer = await fs.promises.readFile(mediaInfo.filename);
      await fs.promises.writeFile(tempPath, fileBuffer);

      // Obter informações do documento
      const docInfo = await this.getDocumentInfo(tempPath);
      await this.validateDocument(docInfo);

      // Criar mensagem no banco
      const messageRecord = await Message.create({
        ticketId: ticket.id,
        body: `📄 ${docInfo.fileName}`,
        fromMe: false,
        read: true,
        mediaType: "document",
        mediaUrl: tempPath,
        mediaName: docInfo.fileName,
        mediaSize: docInfo.fileSize,
        mediaMimeType: docInfo.mimeType,
        mediaHash: docInfo.hash,
        mediaMetadata: JSON.stringify(docInfo)
      });

      // Emitir evento
      const io = getIO();
      io.to(ticket.id.toString()).emit("appMessage", {
        action: "create",
        message: messageRecord,
        ticket,
        contact
      });

      // Limpar arquivo temporário após 24 horas
      setTimeout(async () => {
        try {
          await fs.promises.unlink(tempPath);
        } catch (err) {
          logger.error("Error deleting temporary document:", err);
        }
      }, 24 * 60 * 60 * 1000);
    } catch (err) {
      logger.error("Error handling document message:", err);
      throw err;
    }
  }

  public static async sendAudioMessage(
    ticket: Ticket,
    filePath: string,
    caption?: string
  ): Promise<Message> {
    const handler = AudioDocumentHandler.getInstance();
    return handler.sendAudio(ticket, filePath, caption);
  }

  public static async sendDocumentMessage(
    ticket: Ticket,
    filePath: string,
    filename?: string,
    caption?: string
  ): Promise<Message> {
    const handler = AudioDocumentHandler.getInstance();
    return handler.sendDocument(ticket, filePath, filename, caption);
  }

  private async sendAudio(ticket: Ticket, filePath: string, caption?: string): Promise<Message> {
    try {
      // Validar e processar áudio
      const audioInfo = await this.getAudioInfo(filePath);
      await this.validateAudio(audioInfo);

      // Comprimir se necessário
      let finalPath = filePath;
      if (audioInfo.size > 5 * 1024 * 1024) { // 5MB
        const compressedPath = path.join(process.cwd(), "temp", `compressed_${Date.now()}.ogg`);
        await this.compressAudio(filePath, compressedPath);
        finalPath = compressedPath;
      }

      // Enviar mensagem
      const message = await this.mediaHandler.sendMediaMessage(ticket, {
        type: "audio",
        path: finalPath,
        caption,
        mimetype: audioInfo.mimeType,
        ptt: true // Push to talk
      });

      // Criar registro no banco
      const messageRecord = await Message.create({
        ticketId: ticket.id,
        body: caption || "🎵 Audio Message",
        fromMe: true,
        read: true,
        mediaType: "audio",
        mediaUrl: finalPath,
        mediaName: path.basename(filePath),
        mediaSize: audioInfo.size,
        mediaMimeType: audioInfo.mimeType,
        mediaDuration: audioInfo.duration,
        mediaHash: audioInfo.hash,
        mediaMetadata: JSON.stringify(audioInfo)
      });

      // Limpar arquivo temporário se foi comprimido
      if (finalPath !== filePath) {
        await fs.promises.unlink(finalPath);
      }

      return messageRecord;
    } catch (err) {
      logger.error("Error sending audio message:", err);
      throw err;
    }
  }

  private async sendDocument(ticket: Ticket, filePath: string, filename?: string, caption?: string): Promise<Message> {
    try {
      // Validar documento
      const docInfo = await this.getDocumentInfo(filePath);
      await this.validateDocument(docInfo);

      // Enviar mensagem
      const message = await this.mediaHandler.sendMediaMessage(ticket, {
        type: "document",
        path: filePath,
        caption,
        mimetype: docInfo.mimeType,
        fileName: filename || docInfo.fileName
      });

      // Criar registro no banco
      const messageRecord = await Message.create({
        ticketId: ticket.id,
        body: caption || `📄 ${docInfo.fileName}`,
        fromMe: true,
        read: true,
        mediaType: "document",
        mediaUrl: filePath,
        mediaName: filename || docInfo.fileName,
        mediaSize: docInfo.fileSize,
        mediaMimeType: docInfo.mimeType,
        mediaHash: docInfo.hash,
        mediaMetadata: JSON.stringify(docInfo)
      });

      return messageRecord;
    } catch (err) {
      logger.error("Error sending document message:", err);
      throw err;
    }
  }

  public static async getAudioMessages(ticketId: number): Promise<Message[]> {
    const handler = AudioDocumentHandler.getInstance();
    return handler.getAudioMessages(ticketId);
  }

  public static async getDocumentMessages(ticketId: number): Promise<Message[]> {
    const handler = AudioDocumentHandler.getInstance();
    return handler.getDocumentMessages(ticketId);
  }

  private async getAudioMessages(ticketId: number): Promise<Message[]> {
    try {
      return await Message.findAll({
        where: {
          ticketId,
          mediaType: "audio"
        },
        order: [["createdAt", "DESC"]]
      });
    } catch (err) {
      logger.error("Error getting audio messages:", err);
      throw new AppError("ERR_GETTING_AUDIO_MESSAGES");
    }
  }

  private async getDocumentMessages(ticketId: number): Promise<Message[]> {
    try {
      return await Message.findAll({
        where: {
          ticketId,
          mediaType: "document"
        },
        order: [["createdAt", "DESC"]]
      });
    } catch (err) {
      logger.error("Error getting document messages:", err);
      throw new AppError("ERR_GETTING_DOCUMENT_MESSAGES");
    }
  }

  public async deleteAudioMessage(messageId: number): Promise<void> {
    const message = await Message.findByPk(messageId);
    if (!message || message.mediaType !== "audio") {
      throw new AppError("ERR_MEDIA_NOT_FOUND");
    }

    try {
      if (message.mediaUrl) {
        await fs.promises.unlink(message.mediaUrl);
      }
      await message.destroy();
    } catch (err) {
      logger.error("Error deleting audio message:", err);
      throw new AppError("ERR_MEDIA_DELETE");
    }
  }

  public async deleteDocumentMessage(messageId: number): Promise<void> {
    const message = await Message.findByPk(messageId);
    if (!message || message.mediaType !== "document") {
      throw new AppError("ERR_MEDIA_NOT_FOUND");
    }

    try {
      if (message.mediaUrl) {
        await fs.promises.unlink(message.mediaUrl);
      }
      await message.destroy();
    } catch (err) {
      logger.error("Error deleting document message:", err);
      throw new AppError("ERR_MEDIA_DELETE");
    }
  }
} 