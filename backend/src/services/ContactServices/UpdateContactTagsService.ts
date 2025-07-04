import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";

interface Request {
  tags: number[] | string[];
  contactId: string;
  tenantId: string | number;
}

interface TagType {
  tagId: number | string;
  contactId: number | string;
  tenantId: number | string;
}

const UpdateContactService = async ({
  tags,
  contactId,
  tenantId,
}: Request): Promise<Contact> => {
  await ContactTag.destroy({
    where: {
      tenantId,
      contactId,
    },
  });

  const contactTags: TagType[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tags.forEach((tag: any) => {
    contactTags.push({
      tagId: !tag.id ? tag : tag.id,
      contactId,
      tenantId,
    });
  });

  await ContactTag.bulkCreate(contactTags as any);

  const contact = await Contact.findOne({
    where: { id: contactId, tenantId },
    attributes: ["id", "name", "number", "email", "profilePicUrl"],
    include: [
      "extraInfo",
      {
        model: Tag,
        as: "tags",
        through: { attributes: [] }
      },
      {
        association: "wallets",
        attributes: ["id", "name"],
      },
    ],
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return contact;
};

export default UpdateContactService;
