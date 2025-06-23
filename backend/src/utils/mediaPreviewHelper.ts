const getMediaTypePrefix = (mimetype: string | undefined, filename?: string): string => {
  if (!mimetype) return "";
  
  const [type, subtype] = mimetype.split("/");
  
  switch (type) {
    case "audio":
      return "🎵 Áudio";
    case "video":
      return "🎥 Vídeo";
    case "image":
      return "📷 Imagem";
    case "application":
      if (subtype?.includes("pdf")) return "📄 PDF";
      if (subtype?.includes("zip") || subtype?.includes("rar") || subtype?.includes("compressed")) return "📦 Arquivo";
      if (subtype?.includes("document") || subtype?.includes("text") || 
          subtype?.includes("word") || subtype?.includes("excel") || 
          subtype?.includes("powerpoint")) return "📄 Documento";
      return "📎 Arquivo";
    default:
      return "📎 Arquivo";
  }
};

const createMediaPreviewMessage = (body: string | undefined, filename: string, mimetype?: string): string => {
  const mediaPrefix = getMediaTypePrefix(mimetype, filename);
  
  if (body && body.trim()) {
    return `${mediaPrefix}: ${body}`;
  }
  
  return `${mediaPrefix}: ${filename}`;
};

export { getMediaTypePrefix, createMediaPreviewMessage }; 