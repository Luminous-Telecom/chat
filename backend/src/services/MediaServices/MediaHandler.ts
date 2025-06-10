import { proto, downloadMediaMessage, WASocket } from '@whiskeysockets/baileys';
import { getBaileys } from '../BaileysServices/BaileysService';
import AppError from '../../errors/AppError';
import { logger } from '../../utils/logger';
import { isValidMediaType } from '../../utils/validators';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream';
import { createHash } from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as mime from 'mime-types';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { exec } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import Ticket from '../../models/Ticket';

const execAsync = promisify(exec);
const pipelineAsync = promisify(pipeline);

interface MediaInfo {
  type: string;
  mimetype: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  filename: string;
  hash: string;
}

interface MediaOptions {
  compress?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
  quality?: number;
}

interface MediaMessageOptions {
  type: 'image' | 'video' | 'audio' | 'document';
  path: string;
  caption?: string;
  mimetype: string;
  fileName?: string;
  ptt?: boolean;
}

const DEFAULT_OPTIONS: MediaOptions = {
  compress: true,
  maxSize: 16 * 1024 * 1024, // 16MB
  allowedTypes: ['image', 'video', 'audio', 'document'],
  quality: 0.8
};

class MediaHandler {
  private static instance: MediaHandler;
  private mediaCache: Map<string, MediaInfo>;
  private uploadQueue: Map<string, Promise<MediaInfo>>;
  private downloadQueue: Map<string, Promise<string>>;
  private readonly mediaDir: string;

  private constructor() {
    this.mediaCache = new Map();
    this.uploadQueue = new Map();
    this.downloadQueue = new Map();
    this.mediaDir = path.join(process.cwd(), 'public', 'media');
    this.initializeMediaDir();
  }

  public static getInstance(): MediaHandler {
    if (!MediaHandler.instance) {
      MediaHandler.instance = new MediaHandler();
    }
    return MediaHandler.instance;
  }

  private async initializeMediaDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.mediaDir, { recursive: true });
      await fs.promises.mkdir(path.join(this.mediaDir, 'temp'), { recursive: true });
      await fs.promises.mkdir(path.join(this.mediaDir, 'cache'), { recursive: true });
    } catch (err) {
      logger.error('Error initializing media directory:', err);
      throw AppError.getError("ERR_MEDIA_DIR_INIT");
    }
  }

  private async getMediaInfo(filePath: string): Promise<MediaInfo> {
    try {
      const stats = await fs.promises.stat(filePath);
      const mimetype = mime.lookup(filePath) || 'application/octet-stream';
      const type = mimetype.split('/')[0];
      const hash = await this.calculateFileHash(filePath);
      const filename = `${hash}.${mime.extension(mimetype)}`;

      const info: MediaInfo = {
        type,
        mimetype,
        size: stats.size,
        filename,
        hash
      };

      if (type === 'audio' || type === 'video') {
        const metadata = await this.getMediaMetadata(filePath);
        info.duration = metadata.duration;
        if (type === 'video') {
          info.width = metadata.width;
          info.height = metadata.height;
        }
      }

      return info;
    } catch (err) {
      logger.error('Error getting media info:', err);
      throw AppError.getError("ERR_MEDIA_INFO");
    }
  }

  private async getMediaMetadata(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        const stream = metadata.streams[0];
        resolve({
          duration: metadata.format.duration,
          width: stream.width,
          height: stream.height
        });
      });
    });
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.promises.readFile(filePath);
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  private async compressMedia(
    inputPath: string,
    outputPath: string,
    type: string,
    options: MediaOptions
  ): Promise<void> {
    try {
      if (type === 'image') {
        await this.compressImage(inputPath, outputPath);
      } else if (type === 'video') {
        await this.compressVideo(inputPath, outputPath);
      } else if (type === 'audio') {
        await this.compressAudio(inputPath, outputPath, options.quality);
      }
    } catch (err) {
      logger.error('Error compressing media:', err);
      throw AppError.getError("ERR_MEDIA_COMPRESSION");
    }
  }

  private async compressImage(inputPath: string, outputPath: string): Promise<void> {
    try {
      return new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .outputOptions("-q:v", "2") // Qualidade da imagem (2-31, menor = melhor)
          .output(outputPath);

        command
          .on("end", () => resolve())
          .on("error", (err) => reject(new AppError("ERR_IMAGE_COMPRESSION")))
          .run();
      });
    } catch (err) {
      logger.error("Error compressing image:", err);
      throw new AppError("ERR_IMAGE_COMPRESSION");
    }
  }

  private async compressVideo(inputPath: string, outputPath: string): Promise<void> {
    try {
      return new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .videoCodec("libx264")
          .videoBitrate("1000k")
          .audioCodec("aac")
          .audioBitrate("128k")
          .output(outputPath);

        command
          .on("end", () => resolve())
          .on("error", (err) => reject(new AppError("ERR_VIDEO_COMPRESSION")))
          .run();
      });
    } catch (err) {
      logger.error("Error compressing video:", err);
      throw new AppError("ERR_VIDEO_COMPRESSION");
    }
  }

  private async compressAudio(
    inputPath: string,
    outputPath: string,
    quality: number = 0.8
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:a libmp3lame',
          '-q:a 4',
          '-ar 44100',
          '-ac 2'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(new AppError("ERR_AUDIO_COMPRESSION")))
        .run();
    });
  }

  public async uploadMedia(
    file: Express.Multer.File,
    options: MediaOptions = {}
  ): Promise<MediaInfo> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const cacheKey = `${file.originalname}-${file.size}`;

    // Check cache
    if (this.mediaCache.has(cacheKey)) {
      return this.mediaCache.get(cacheKey)!;
    }

    // Check queue
    if (this.uploadQueue.has(cacheKey)) {
      return this.uploadQueue.get(cacheKey)!;
    }

    const uploadPromise = (async () => {
      try {
        // Validate file
        if (!isValidMediaType(file.mimetype)) {
          throw AppError.getError("ERR_MEDIA_MIME");
        }

        if (file.size > mergedOptions.maxSize!) {
          throw AppError.getError("ERR_MEDIA_TOO_LARGE");
        }

        // Process file
        const tempPath = path.join(this.mediaDir, 'temp', `${uuidv4()}-${file.originalname}`);
        const finalPath = path.join(this.mediaDir, 'cache', `${uuidv4()}-${file.originalname}`);

        await fs.promises.writeFile(tempPath, file.buffer);

        const mediaInfo = await this.getMediaInfo(tempPath);
        const type = mediaInfo.type;

        if (mergedOptions.compress && ['image', 'video', 'audio'].includes(type)) {
          await this.compressMedia(tempPath, finalPath, type, mergedOptions);
          await fs.promises.unlink(tempPath);
        } else {
          await fs.promises.rename(tempPath, finalPath);
        }

        // Update cache
        this.mediaCache.set(cacheKey, mediaInfo);

        // Cleanup old files
        await this.cleanupOldFiles();

        return mediaInfo;
      } catch (err) {
        logger.error('Error uploading media:', err);
        throw err;
      } finally {
        this.uploadQueue.delete(cacheKey);
      }
    })();

    this.uploadQueue.set(cacheKey, uploadPromise);
    return uploadPromise;
  }

  public async downloadMedia(
    message: proto.IWebMessageInfo,
    options: MediaOptions = {}
  ): Promise<MediaInfo> {
    try {
      const messageKey = message.key;
      if (!messageKey?.remoteJid) {
        throw AppError.getError("ERR_NO_MEDIA_MESSAGE");
      }

      const wbot = getBaileys(Number(messageKey.remoteJid.split("@")[0]));
      if (!wbot) {
        throw AppError.getError("ERR_NO_WHATSAPP_SESSION");
      }

      // Get media message
      const mediaMessage = message.message?.imageMessage || 
                          message.message?.videoMessage || 
                          message.message?.audioMessage || 
                          message.message?.documentMessage;

      if (!mediaMessage) {
        throw AppError.getError("ERR_NO_MEDIA_MESSAGE");
      }

      // Download media
      const buffer = await downloadMediaMessage(message, 'buffer', wbot as any);
      if (!buffer || typeof buffer === "string") {
        throw AppError.getError("ERR_MEDIA_DOWNLOAD");
      }

      const tempPath = path.join(this.mediaDir, 'temp', `${uuidv4()}`);
      const finalPath = path.join(this.mediaDir, 'cache', `${uuidv4()}`);

      await fs.promises.writeFile(tempPath, buffer);

      const mediaInfo = await this.getMediaInfo(tempPath);
      const type = mediaInfo.type;

      if (options.compress && ['image', 'video', 'audio'].includes(type)) {
        await this.compressMedia(tempPath, finalPath, type, options);
        await fs.promises.unlink(tempPath);
      } else {
        await fs.promises.rename(tempPath, finalPath);
      }

      // Update cache
      const cacheKey = messageKey.id || uuidv4();
      this.mediaCache.set(cacheKey, mediaInfo);

      // Cleanup old files
      await this.cleanupOldFiles();

      return mediaInfo;
    } catch (err) {
      logger.error('Error downloading media:', err);
      throw AppError.getError("ERR_MEDIA_DOWNLOAD");
    }
  }

  private async cleanupOldFiles(): Promise<void> {
    try {
      const cacheDir = path.join(this.mediaDir, 'cache');
      const files = await fs.promises.readdir(cacheDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        const stats = await fs.promises.stat(filePath);
        const fileAge = now - stats.mtimeMs;

        // Remove files older than 24 hours
        if (fileAge > 24 * 60 * 60 * 1000) {
          await fs.promises.unlink(filePath);
          const cacheKey = Array.from(this.mediaCache.entries())
            .find(([_, info]) => info.filename === file)?.[0];
          if (cacheKey) {
            this.mediaCache.delete(cacheKey);
          }
        }
      }
    } catch (err) {
      logger.error('Error cleaning up old files:', err);
    }
  }

  public async getMediaUrl(mediaInfo: MediaInfo): Promise<string> {
    const filePath = path.join(this.mediaDir, 'cache', mediaInfo.filename);
    try {
      await fs.promises.access(filePath);
      return `/media/cache/${mediaInfo.filename}`;
    } catch {
      throw AppError.getError("ERR_MEDIA_NOT_FOUND");
    }
  }

  public async deleteMedia(mediaInfo: MediaInfo): Promise<void> {
    try {
      const filePath = path.join(this.mediaDir, 'cache', mediaInfo.filename);
      await fs.promises.unlink(filePath);
      const cacheKey = Array.from(this.mediaCache.entries())
        .find(([_, info]) => info.hash === mediaInfo.hash)?.[0];
      if (cacheKey) {
        this.mediaCache.delete(cacheKey);
      }
    } catch (err) {
      logger.error('Error deleting media:', err);
      throw AppError.getError("ERR_MEDIA_DELETE");
    }
  }

  public async sendMediaMessage(ticket: Ticket, options: MediaMessageOptions): Promise<void> {
    try {
      const wbot = getBaileys(ticket.whatsappId);
      if (!wbot) {
        throw AppError.getError("ERR_NO_WHATSAPP_SESSION");
      }

      const fileBuffer = await fs.promises.readFile(options.path);
      const messageContent: any = {};

      switch (options.type) {
        case 'image':
          messageContent.image = { 
            url: options.path,
            mimetype: options.mimetype,
            caption: options.caption
          };
          break;
        case 'video':
          messageContent.video = { 
            url: options.path,
            mimetype: options.mimetype,
            caption: options.caption
          };
          break;
        case 'audio':
          messageContent.audio = { 
            url: options.path,
            mimetype: options.mimetype,
            ptt: options.ptt
          };
          break;
        case 'document':
          messageContent.document = { 
            url: options.path,
            fileName: options.fileName,
            mimetype: options.mimetype
          };
          break;
        default:
          throw AppError.getError("ERR_MEDIA_TYPE_NOT_SUPPORTED");
      }

      await wbot.sendMessage(
        `${ticket.contact.number}@s.whatsapp.net`,
        messageContent
      );
    } catch (err) {
      logger.error('Error sending media message:', err);
      throw AppError.getError("ERR_SENDING_WAPP_MSG");
    }
  }
}

export default MediaHandler; 