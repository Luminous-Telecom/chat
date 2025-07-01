import Contact from "../../../models/Contact";
import CreateOrUpdateContactService from "../../ContactServices/CreateOrUpdateContactService";
import { getWbot } from "../../../libs/wbot";
import { logger } from "../../../utils/logger";

// Cache para evitar requisições desnecessárias
const nameSearchCache = new Map<string, { name: string; pushname: string; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutos

// Função para buscar nome do contato no WhatsApp (otimizada)
const getContactNameFromWhatsApp = async (
  contactJid: string,
  contactNumber: string,
  tenantId: string | number
): Promise<{ name: string; pushname: string }> => {
  // Verificar cache primeiro
  const cacheKey = `${tenantId}-${contactNumber}`;
  const cached = nameSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { name: cached.name, pushname: cached.pushname };
  }

  let contactName = contactNumber;
  let contactPushname = "";

  try {
    // Tentar encontrar uma sessão WhatsApp ativa para este tenant
    let wbot: any = null;
    try {
      const whatsapps = await require("../../../models/Whatsapp").default.findAll({
        where: { 
          tenantId, 
          status: "CONNECTED",
          type: "whatsapp"
        },
        limit: 1
      });
      
      if (whatsapps.length > 0) {
        wbot = getWbot(whatsapps[0].id);
      }
    } catch (wbotErr) {
      logger.debug(`[VerifyContact] No active WhatsApp session found for tenant ${tenantId}`);
    }

    if (!wbot) {
      return { name: contactName, pushname: contactPushname };
    }

    // Método 1: Verificar no store do WhatsApp primeiro (mais rápido)
    try {
      if ((wbot as any).store?.contacts) {
        const contactStore = (wbot as any).store.contacts;
        const storedContact = contactStore.get(contactJid);
        
        if (storedContact && storedContact.name && storedContact.name !== contactNumber) {
          contactName = storedContact.name;
          contactPushname = storedContact.pushname || storedContact.notify || "";
          logger.debug(`[VerifyContact] Found store name: ${contactName} for ${contactNumber}`);
          
          // Armazenar no cache
          nameSearchCache.set(cacheKey, { name: contactName, pushname: contactPushname, timestamp: Date.now() });
          return { name: contactName, pushname: contactPushname };
        }
      }
    } catch (storeErr) {
      // Store não disponível
    }

    // Método 2: Tentar getBusinessProfile para contas business (rápido)
    try {
      const businessProfile = await (wbot as any).getBusinessProfile(contactJid);
      
      if (businessProfile?.name || businessProfile?.description) {
        contactName = businessProfile.name || businessProfile.description || "";
        contactPushname = businessProfile.name || businessProfile.description || "";
        logger.debug(`[VerifyContact] Found business profile name: ${contactName} for ${contactNumber}`);
        
        // Armazenar no cache
        nameSearchCache.set(cacheKey, { name: contactName, pushname: contactPushname, timestamp: Date.now() });
        return { name: contactName, pushname: contactPushname };
      }
    } catch (businessErr) {
      // Continuar para próximo método
    }

    // Métodos mais lentos - usar apenas se realmente necessário
    // Método 3: onWhatsApp (pode ser lento)
    try {
      const contactInfo = await (wbot as any).onWhatsApp(contactNumber);
      if (contactInfo && contactInfo.length > 0) {
        const contact = contactInfo[0];
        
        if (contact.notify || contact.name) {
          contactName = contact.notify || contact.name || "";
          contactPushname = contact.notify || "";
          logger.debug(`[VerifyContact] Found onWhatsApp name: ${contactName} for ${contactNumber}`);
          
          // Armazenar no cache
          nameSearchCache.set(cacheKey, { name: contactName, pushname: contactPushname, timestamp: Date.now() });
          return { name: contactName, pushname: contactPushname };
        }
      }
    } catch (onWhatsAppErr) {
      logger.debug(`[VerifyContact] onWhatsApp failed for ${contactNumber}: ${onWhatsAppErr}`);
    }

  } catch (searchErr) {
    logger.debug(`[VerifyContact] Error searching WhatsApp name for ${contactNumber}: ${searchErr}`);
  }

  // Armazenar resultado vazio no cache para evitar repetir tentativas
  nameSearchCache.set(cacheKey, { name: contactName, pushname: contactPushname, timestamp: Date.now() });
  return { name: contactName, pushname: contactPushname };
};

// Limpar cache periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of nameSearchCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      nameSearchCache.delete(key);
    }
  }
}, CACHE_TTL);

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

  // Tentar obter o nome do pushName primeiro (dados da mensagem atual)
  let name = msgContact.name || msgContact.pushname || "";
  let pushname = msgContact.pushname || "";
  
  const contactNumber = msgContact.id.user.replace(/\D/g, "");
  const contactJid = msgContact.id._serialized;

  // Se não temos um nome real (só número), tentar buscar no WhatsApp
  // Mas apenas para números que parecem ser válidos
  const shouldSearchName = (!name || name === contactNumber || name.length === 0) &&
                          contactNumber.length >= 8 && 
                          contactNumber.length <= 15;

  if (shouldSearchName) {
    logger.debug(`[VerifyContact] No name found for ${contactNumber}, searching WhatsApp...`);
    
    const whatsappContactInfo = await getContactNameFromWhatsApp(
      contactJid, 
      contactNumber, 
      tenantId
    );
    
    if (whatsappContactInfo.name && whatsappContactInfo.name !== contactNumber) {
      name = whatsappContactInfo.name;
      pushname = whatsappContactInfo.pushname;
      logger.info(`[VerifyContact] Updated contact name from WhatsApp: ${contactNumber} -> ${name}`);
    }
  }

  const isUser = !msgContact.isGroup;

  const contactData = {
    name: name || contactNumber, // Fallback para número se não encontrar nome
    number: contactNumber,
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
