import { Request, Response } from "express";
import { head } from "lodash";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import CreateContactService from "../services/ContactServices/CreateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";
import ListContactsService from "../services/ContactServices/ListContactsService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import UpdateContactTagsService from "../services/ContactServices/UpdateContactTagsService";
import UpdateContactWalletsService from "../services/ContactServices/UpdateContactWalletsService";
import { ImportFileContactsService } from "../services/WbotServices/ImportFileContactsService";
import Whatsapp from "../models/Whatsapp";
import { getWbot } from "../libs/wbot";
import * as ExcelJS from "exceljs";
import * as path from "path";
import * as fs from "fs";
import { v4 as uuidV4 } from "uuid";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

interface ExtraInfo {
  name: string;
  value: string;
}
interface ContactData {
  name: string;
  number: string;
  email?: string;
  extraInfo?: ExtraInfo[];
  wallets?: null | number[] | string[];
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId, id: userId, profile } = req.user;
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { contacts, count, hasMore } = await ListContactsService({
    searchParam,
    pageNumber,
    tenantId,
    profile,
    userId,
  });

  return res.json({ contacts, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  const newContact: ContactData = req.body;
  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed."),
  });

  try {
    await schema.validate(newContact);
  } catch (err) {
    throw new AppError(err.message);
  }

  const waNumber = await CheckIsValidContact(newContact.number, tenantId);

  const profilePicUrl = await GetProfilePicUrl(newContact.number, tenantId);

  const contact = await CreateContactService({
    ...newContact,
    number: waNumber.user,
    profilePicUrl,
    tenantId,
  });

  return res.status(200).json(contact);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { tenantId } = req.user;

  const contact = await ShowContactService({ id: contactId, tenantId });

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contactData: ContactData = req.body;
  const { tenantId } = req.user;

  const schema = Yup.object().shape({
    name: Yup.string(),
    number: Yup.string().matches(
      /^\d+$/,
      "Invalid number format. Only numbers is allowed."
    ),
  });

  try {
    await schema.validate(contactData);
  } catch (err) {
    throw new AppError(err.message);
  }

  const waNumber = await CheckIsValidContact(contactData.number, tenantId);

  contactData.number = waNumber.user;

  const { contactId } = req.params;

  const contact = await UpdateContactService({
    contactData,
    contactId,
    tenantId,
  });

  return res.status(200).json(contact);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { tenantId } = req.user;

  await DeleteContactService({ id: contactId, tenantId });

  return res.status(200).json({ message: "Contact deleted" });
};

export const updateContactTags = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tags } = req.body;
  const { contactId } = req.params;
  const { tenantId } = req.user;

  const contact = await UpdateContactTagsService({
    tags,
    contactId,
    tenantId,
  });

  return res.status(200).json(contact);
};

export const updateContactWallet = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { walletId } = req.body;
  const { tenantId } = req.user;

  const contact = await Contact.findOne({
    where: { id: contactId, tenantId }
  });

  if (!contact) {
    throw new AppError("ERR_CONTACT_NOT_FOUND", 404);
  }

  await contact.update({ walletId });

  return res.status(200).json({ contact });
};

export const upload = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const file: Express.Multer.File = head(files) as Express.Multer.File;
  const { tenantId } = req.user;
  let { tags, wallets } = req.body;

  if (tags) {
    tags = tags.split(",");
  }

  if (wallets) {
    wallets = wallets.split();
  }

  const response = await ImportFileContactsService(
    +tenantId,
    file,
    tags,
    wallets
  );

  // const io = getIO();

  // io.emit(`company-${companyId}-contact`, {
  //   action: "reload",
  //   records: response
  // });

  return res.status(200).json(response);
};

export const exportContacts = async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  const contacts = await Contact.findAll({
    where: { tenantId },
    attributes: ["id", "name", "number", "email"],
    order: [["name", "ASC"]],
    raw: true,
  });

  // Cria um novo workbook e worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Contatos");

  // Adiciona os cabeçalhos
  if (contacts.length > 0) {
    const headers = Object.keys(contacts[0]);
    worksheet.addRow(headers);
    
    // Adiciona os dados
    contacts.forEach(contact => {
      worksheet.addRow(Object.values(contact));
    });
  }

  // Define o nome do arquivo
  const fileName = `${uuidV4()}_contatos.xlsx`;
  const filePath = path.join(__dirname, "..", "..", "public", "downloads");
  const file = path.join(filePath, fileName);

  // Cria os diretórios de downloads se eles não existirem
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true });
  }

  // Salva o arquivo no diretório de downloads
  try {
    await workbook.xlsx.writeFile(file);
    const { BACKEND_URL } = process.env;
    const downloadLink = `${BACKEND_URL}:${process.env.PROXY_PORT}/public/downloads/${fileName}`;

    res.send({ downloadLink });
  } catch (err) {
    console.error("Erro ao salvar arquivo:", err);
    return res.status(500).send("Erro ao exportar contatos");
  }
};

export const importPersonalContacts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;
  const { method, data } = req.body;

  try {
    // Buscar uma sessão WhatsApp conectada para verificação
    const whatsapp = await Whatsapp.findOne({
      where: {
        tenantId,
        status: "CONNECTED",
        type: "whatsapp",
      },
    });

    const wbot = whatsapp ? getWbot(whatsapp.id) : null;
    const results = {
      imported: 0,
      verified: 0,
      errors: 0,
      details: [] as any[]
    };

    if (method === 'numbers') {
      // Importar via lista de números
      const { numbers } = data;
      
      if (!numbers || !Array.isArray(numbers)) {
        throw new AppError("Lista de números é obrigatória", 400);
      }

      // Processar números em lotes
      const batchSize = 5;
      for (let i = 0; i < numbers.length; i += batchSize) {
        const batch = numbers.slice(i, i + batchSize);
        
        for (const number of batch) {
          try {
            const cleanNumber = String(number).replace(/\D/g, "");
            
            if (cleanNumber.length < 8 || cleanNumber.length > 15) {
              results.errors++;
              results.details.push({
                number: cleanNumber,
                status: 'invalid_number',
                error: 'Número inválido'
              });
              continue;
            }

            // Verificar se contato já existe
            const existingContact = await Contact.findOne({
              where: { number: cleanNumber, tenantId }
            });

            if (existingContact) {
              results.details.push({
                number: cleanNumber,
                status: 'already_exists',
                name: existingContact.name
              });
              continue;
            }

            // Tentar verificar se está no WhatsApp
            let contactName = `Contato ${cleanNumber}`;
            let pushname = "";
            
            if (wbot) {
              try {
                const contactInfo = await (wbot as any).onWhatsApp(cleanNumber);
                if (contactInfo && contactInfo.length > 0 && contactInfo[0].exists) {
                  contactName = contactInfo[0].notify || contactName;
                  pushname = contactInfo[0].notify || "";
                  results.verified++;
                }
              } catch (verifyErr) {
                // Continuar sem verificação
              }
            }

            // Criar contato no banco
            await Contact.create({
              name: contactName,
              number: cleanNumber,
              pushname: pushname,
              tenantId,
              isWAContact: true
            });

            results.imported++;
            results.details.push({
              number: cleanNumber,
              status: 'imported',
              name: contactName
            });

          } catch (contactError) {
            results.errors++;
            results.details.push({
              number: String(number),
              status: 'error',
              error: contactError.message
            });
          }
        }

        // Delay entre lotes
        if (i + batchSize < numbers.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

    } else if (method === 'vcf') {
      // Importar via arquivo VCF (vCard)
      const { vcfContent } = data;
      
      if (!vcfContent) {
        throw new AppError("Conteúdo VCF é obrigatório", 400);
      }

      // Parsear VCF e extrair números
      const vcfLines = vcfContent.split('\n');
      const numbers = [];
      
      for (const line of vcfLines) {
        if (line.startsWith('TEL:')) {
          const number = line.replace('TEL:', '').trim();
          if (number) numbers.push(number);
        }
      }

      // Processar números encontrados
      for (const number of numbers) {
        try {
          const cleanNumber = String(number).replace(/\D/g, "");
          
          if (cleanNumber.length < 8 || cleanNumber.length > 15) {
            results.errors++;
            continue;
          }

          // Verificar se contato já existe
          const existingContact = await Contact.findOne({
            where: { number: cleanNumber, tenantId }
          });

          if (existingContact) {
            results.details.push({
              number: cleanNumber,
              status: 'already_exists',
              name: existingContact.name
            });
            continue;
          }

          // Criar contato
          await Contact.create({
            name: `Contato ${cleanNumber}`,
            number: cleanNumber,
            pushname: "",
            tenantId,
            isWAContact: true
          });

          results.imported++;
          results.details.push({
            number: cleanNumber,
            status: 'imported',
            name: `Contato ${cleanNumber}`
          });

        } catch (contactError) {
          results.errors++;
        }
      }

    } else {
      throw new AppError("Método de importação inválido. Use 'numbers' ou 'vcf'", 400);
    }

    const responseMessage = `Importação concluída. Importados: ${results.imported}, Verificados: ${results.verified}, Erros: ${results.errors}`;
    
    return res.status(200).json({
      message: responseMessage,
      summary: results,
      details: results.details
    });

  } catch (error: any) {
    return res.status(400).json({
      error: error.message
    });
  }
};
