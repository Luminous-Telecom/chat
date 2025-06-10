import { proto } from "@whiskeysockets/baileys";
import Message from "../models/Message";

const GetMessageBody = (message: Message): string => {
  if (!message) {
    return "";
  }

  if (message.body) {
    return message.body;
  }

  if (message.mediaType) {
    switch (message.mediaType) {
      case "image":
        return "📷 Image";
      case "video":
        return "🎥 Video";
      case "audio":
        return "🎵 Audio";
      case "document":
        return "📄 Document";
      default:
        return "Media";
    }
  }

  return "";
};

export default GetMessageBody; 