import path from "path";
import multer from "multer";
import { format } from "date-fns";
import fs from "fs";

// Criar pasta para arquivos enviados se não existir
const sentMediaFolder = path.resolve(__dirname, "..", "..", "public", "sent");
if (!fs.existsSync(sentMediaFolder)) {
  fs.mkdirSync(sentMediaFolder, { recursive: true });
}

export default {
  directory: sentMediaFolder,

  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, sentMediaFolder);
    },
    filename(req, file, cb) {
      let fileName;
      if (file.mimetype?.toLocaleLowerCase().endsWith("xml")) {
        fileName = file.originalname;
      } else {
        const { originalname } = file;
        const ext = path.extname(originalname);
        const name = originalname.replace(ext, "");
        const date = format(new Date(), "ddMMyyyyHHmmssSSS");
        fileName = `${name}_${date}${ext}`;
      }

      return cb(null, fileName);
    }
  })
};
