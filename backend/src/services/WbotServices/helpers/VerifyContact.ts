import Contact from "../../../models/Contact";
import CreateOrUpdateContactService from "../../ContactServices/CreateOrUpdateContactService";

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: { name: string; value: string; }[];
  tenantId: string | number;
  pushname: string;
  isUser: boolean;
  isWAContact: boolean;
  telegramId?: string | number;
  instagramPK?: string | number;
  messengerId?: string | number;
  origem?: string;
}

const VerifyContact = async (contactData: Request): Promise<Contact> => {
  const contact = await CreateOrUpdateContactService({
    name: contactData.name,
    number: contactData.number,
    profilePicUrl: contactData.profilePicUrl,
    isGroup: contactData.isGroup,
    tenantId: contactData.tenantId,
    pushname: contactData.pushname,
    isUser: contactData.isUser,
    isWAContact: contactData.isWAContact,
    email: contactData.email,
    telegramId: contactData.telegramId,
    instagramPK: contactData.instagramPK,
    messengerId: contactData.messengerId,
    extraInfo: contactData.extraInfo,
    origem: contactData.origem
  });

  return contact;
};

export default VerifyContact;
