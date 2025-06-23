import path from "path";
import multer from "multer";
import { format } from "date-fns";
import fs from "fs";

// Criar pastas se não existirem
const sentMediaFolder = path.resolve(__dirname, "..", "..", "public", "sent");
const publicMediaFolder = path.resolve(__dirname, "..", "..", "public");

if (!fs.existsSync(sentMediaFolder)) {
  fs.mkdirSync(sentMediaFolder, { recursive: true });
}

if (!fs.existsSync(publicMediaFolder)) {
  fs.mkdirSync(publicMediaFolder, { recursive: true });
}

// Função para determinar a pasta baseada na rota/contexto
const getDestination = (req: any): string => {
  
  // Se for campanha, logo ou arquivo do sistema → pasta public
  if (req.url?.includes('/campaigns') || 
      req.url?.includes('/campaign') ||
      req.body?.type === 'campaign' ||
      req.body?.isCampaign === 'true' ||
      req.query?.type === 'campaign' ||
      req.headers?.['x-upload-type'] === 'campaign') {
    console.log('Upload - Destination: PUBLIC (campaign)');
    return publicMediaFolder;
  }
  
  // Caso contrário (mensagens) → pasta sent
  console.log('Upload - Destination: SENT (message)');
  return sentMediaFolder;
};

export default {
  directory: sentMediaFolder, // Padrão para compatibilidade

  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const destination = getDestination(req);
      cb(null, destination);
    },
    filename(req, file, cb) {
      let fileName;
      if (file.mimetype?.toLocaleLowerCase().endsWith("xml")) {
        fileName = file.originalname;
      } else {
        const { originalname } = file;
        
        // Para arquivos de áudio gravados, manter o nome original
        if (originalname.startsWith('audio_') && file.mimetype?.startsWith('audio/')) {
          fileName = originalname;
        } else {
          // Para outros arquivos, usar o formato com timestamp
          const ext = path.extname(originalname);
          const name = originalname.replace(ext, "");
          const date = format(new Date(), "ddMMyyyyHHmmssSSS");
          fileName = `${name}_${date}${ext}`;
        }
      }

      return cb(null, fileName);
    },
  }),
};
