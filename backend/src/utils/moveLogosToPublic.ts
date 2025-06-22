import { join } from "path";
import { readdir, copyFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { logger } from "./logger";

/**
 * Move arquivos de logo da pasta sent/ para public/
 * Útil para migração após mudança na estrutura de pastas
 */
export const moveLogosToPublic = async (): Promise<void> => {
  try {
    const sentDir = join(__dirname, "..", "..", "public", "sent");
    const publicDir = join(__dirname, "..", "..", "public");
    
    if (!existsSync(sentDir)) {
      logger.info("Pasta sent/ não existe, nada para migrar");
      return;
    }
    
    const files = await readdir(sentDir);
    let movedCount = 0;
    
    for (const file of files) {
      // Identificar arquivos que parecem ser logos ou campanhas
      if (file.toLowerCase().includes('logo') || 
          file.toLowerCase().includes('banner') ||
          file.toLowerCase().includes('campaign')) {
        
        const sourcePath = join(sentDir, file);
        const destPath = join(publicDir, file);
        
        try {
          // Copiar arquivo
          await copyFile(sourcePath, destPath);
          
          // Remover arquivo original
          await unlink(sourcePath);
          
          movedCount++;
          logger.info(`Moved logo/campaign file: ${file} from sent/ to public/`);
        } catch (err) {
          logger.error(`Error moving file ${file}: ${err}`);
        }
      }
    }
    
    logger.info(`Migration completed: ${movedCount} files moved to public/`);
  } catch (error) {
    logger.error(`Error during logo migration: ${error}`);
  }
};

// Auto-executar na primeira vez que o módulo é carregado
if (process.env.AUTO_MIGRATE_LOGOS === 'true') {
  moveLogosToPublic();
} 