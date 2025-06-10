import multer from "multer";
import AppError from "../errors/AppError";
import * as path from "path";
import * as fs from "fs";

// Criar diretório temporário se não existir
const tempDir = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configuração de armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro de arquivos
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Verificar tipo de arquivo baseado no campo
  switch (file.fieldname) {
    case "audio":
      if (!file.mimetype.startsWith("audio/")) {
        cb(new AppError("ERR_MEDIA_TYPE_NOT_SUPPORTED"));
        return;
      }
      // Verificar extensões de áudio permitidas
      const audioExts = [".mp3", ".ogg", ".m4a", ".opus"];
      if (!audioExts.includes(path.extname(file.originalname).toLowerCase())) {
        cb(new AppError("ERR_MEDIA_FORMAT"));
        return;
      }
      break;

    case "document":
      // Verificar extensões de documento permitidas
      const docExts = [
        ".pdf", ".doc", ".docx", ".xls", ".xlsx",
        ".ppt", ".pptx", ".txt", ".csv", ".zip",
        ".rar", ".7z", ".tar", ".gz"
      ];
      if (!docExts.includes(path.extname(file.originalname).toLowerCase())) {
        cb(new AppError("ERR_MEDIA_FORMAT"));
        return;
      }
      break;

    case "media":
      // Verificar tipos de mídia permitidos
      if (!file.mimetype.startsWith("image/") && 
          !file.mimetype.startsWith("video/")) {
        cb(new AppError("ERR_MEDIA_TYPE_NOT_SUPPORTED"));
        return;
      }
      break;

    default:
      cb(new AppError("ERR_MEDIA_TYPE_NOT_SUPPORTED"));
      return;
  }

  cb(null, true);
};

// Limites de tamanho
const limits = {
  fileSize: 100 * 1024 * 1024, // 100MB para documentos
  files: 1
};

// Configuração específica para áudio
export const audioUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    file.fieldname = "audio"; // Forçar campo para áudio
    fileFilter(req, file, cb);
  },
  limits: {
    ...limits,
    fileSize: 16 * 1024 * 1024 // 16MB para áudio
  }
});

// Configuração específica para documentos
export const documentUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    file.fieldname = "document"; // Forçar campo para documento
    fileFilter(req, file, cb);
  },
  limits
});

// Configuração específica para mídia (imagens/vídeos)
export const mediaUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    file.fieldname = "media"; // Forçar campo para mídia
    fileFilter(req, file, cb);
  },
  limits: {
    ...limits,
    fileSize: 50 * 1024 * 1024 // 50MB para mídia
  }
});

// Configuração padrão
export const upload = multer({
  storage,
  fileFilter,
  limits
});

// Função para limpar arquivos temporários antigos
export const cleanupTempFiles = async () => {
  try {
    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.promises.stat(filePath);

      // Deletar arquivos mais antigos que 24 horas
      if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
        await fs.promises.unlink(filePath);
      }
    }
  } catch (err) {
    console.error("Error cleaning up temp files:", err);
  }
};

// Executar limpeza a cada 6 horas
setInterval(cleanupTempFiles, 6 * 60 * 60 * 1000); 