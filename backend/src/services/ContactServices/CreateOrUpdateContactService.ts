import socketEmit from "../../helpers/socketEmit";
import Contact from "../../models/Contact";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  tenantId: string | number;
  pushname: string;
  isUser: boolean;
  isWAContact: boolean;
  telegramId?: string | number;
  instagramPK?: string | number;
  messengerId?: string | number;
  origem?: string;
}

// Função para determinar se um nome é melhor que outro
const isNameBetter = (newName: string, currentName: string, contactNumber: string): boolean => {
  // Se não tem nome novo, não é melhor
  if (!newName || newName.trim() === '') {
    return false;
  }
  
  // Se não tem nome atual, qualquer nome novo é melhor
  if (!currentName || currentName.trim() === '') {
    return true;
  }
  
  // Se o nome atual é apenas o número, qualquer nome real é melhor
  if (currentName === contactNumber || currentName.replace(/\D/g, '') === contactNumber) {
    return newName !== contactNumber && newName.replace(/\D/g, '') !== contactNumber;
  }
  
  // Se o novo nome é apenas o número, não é melhor que um nome real
  if (newName === contactNumber || newName.replace(/\D/g, '') === contactNumber) {
    return false;
  }
  
  // Se ambos são nomes reais, usar o mais longo (mais informativo)
  if (newName.length > currentName.length) {
    return true;
  }
  
  // Se o novo nome tem mais palavras (nome + sobrenome), é melhor
  const newWordCount = newName.split(' ').filter(word => word.length > 0).length;
  const currentWordCount = currentName.split(' ').filter(word => word.length > 0).length;
  
  return newWordCount > currentWordCount;
};

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  tenantId,
  pushname,
  isUser,
  isWAContact,
  email = "",
  telegramId,
  instagramPK,
  messengerId,
  extraInfo = [],
  origem = "whatsapp",
}: Request): Promise<Contact> => {
  const number = isGroup
    ? String(rawNumber)
    : String(rawNumber).replace(/[^0-9]/g, "");

  let contact: Contact | null = null;

  if (origem === "whatsapp") {
    contact = await Contact.findOne({ where: { number, tenantId } });
  }

  if (origem === "telegram" && telegramId) {
    contact = await Contact.findOne({ where: { telegramId, tenantId } });
  }

  if (origem === "instagram" && instagramPK) {
    contact = await Contact.findOne({ where: { instagramPK, tenantId } });
  }

  if (origem === "messenger" && messengerId) {
    contact = await Contact.findOne({ where: { messengerId, tenantId } });
  }

  if (contact) {
    // Preparar dados para atualização
    const updateData: any = {
      profilePicUrl: profilePicUrl || contact.profilePicUrl || '',
      pushname,
      isUser,
      isWAContact,
      telegramId: telegramId ? String(telegramId) : contact.telegramId,
      instagramPK: instagramPK ? (typeof instagramPK === 'string' ? parseInt(instagramPK) : instagramPK) : contact.instagramPK,
      messengerId: messengerId ? String(messengerId) : contact.messengerId,
    };

    // Decidir se deve atualizar o nome
    if (isNameBetter(name, contact.name, number)) {
      updateData.name = name;
      console.log(`[CreateOrUpdateContactService] Updating contact name: ${contact.name} -> ${name} (${number})`);
    } else {
      console.log(`[CreateOrUpdateContactService] Keeping existing name: ${contact.name} for ${number} (new: ${name})`);
    }

    await contact.update(updateData);
  } else {
    contact = await Contact.create({
      name: name || number, // Para novos contatos, usar nome ou número como fallback
      number,
      profilePicUrl: profilePicUrl || '',
      email,
      isGroup,
      pushname,
      isUser,
      isWAContact,
      tenantId: typeof tenantId === 'string' ? parseInt(tenantId) : tenantId,
      extraInfo: extraInfo as any,
      telegramId: telegramId ? String(telegramId) : null,
      instagramPK: instagramPK ? (typeof instagramPK === 'string' ? parseInt(instagramPK) : instagramPK) : null,
      messengerId: messengerId ? String(messengerId) : null,
    } as any);
    
    console.log(`[CreateOrUpdateContactService] Created new contact: ${contact.name} (${number})`);
  }

  socketEmit({
    tenantId,
    type: "contact:update",
    payload: contact,
  });

  return contact;
};

export default CreateOrUpdateContactService;
