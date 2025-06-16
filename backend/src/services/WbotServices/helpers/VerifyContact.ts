import Contact from "../../../models/Contact";
import CreateOrUpdateContactService from "../../ContactServices/CreateOrUpdateContactService";

const VerifyContact = async (
  msgContact: WbotContact,
  tenantId: string | number
): Promise<Contact> => {
  let profilePicUrl;
  try {
    profilePicUrl = await msgContact.getProfilePicUrl();
  } catch (error) {
    profilePicUrl = undefined;
  }

  const name = msgContact.name || msgContact.pushname || "";
  const isUser = !msgContact.isGroup;
  const pushname = msgContact.pushname || "";

  const contactData = {
    name,
    number: msgContact.id.user.replace(/\D/g, ""),
    profilePicUrl,
    tenantId,
    pushname,
    isUser,
    isWAContact: msgContact.isWAContact,
    isGroup: msgContact.isGroup,
  };

  const contact = await CreateOrUpdateContactService(contactData);

  return contact;
};

export default VerifyContact;
