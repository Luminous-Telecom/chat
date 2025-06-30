import { QueryTypes } from "sequelize";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";

const SyncContactsWhatsappInstanceService = async (
  whatsappId: number,
  tenantId: number
): Promise<void> => {
  const wbot = getWbot(whatsappId);

  let contacts;

  try {
    logger.info(`[SyncContacts] Iniciando sincronização para WhatsApp ${whatsappId}`);
    
    // Primeira tentativa: usar o store se disponível (apenas contatos individuais válidos)
    try {
      if ((wbot as any).store?.contacts) {
        const contactsMap = (wbot as any).store.contacts;
        const allContacts = Array.from(contactsMap.values());
        
        // Filtrar apenas contatos individuais com números válidos
        contacts = allContacts.filter((contact: any) => {
          if (contact.isGroup) return false;
          
          const number = contact.number || contact.id?.split('@')[0] || '';
          const cleanNumber = String(number).replace(/\D/g, "");
          
          // Aceitar apenas números de telefone válidos (10-13 dígitos)
          return cleanNumber.length >= 10 && cleanNumber.length <= 13;
        });
        
        logger.info(`[SyncContacts] ${contacts.length} contatos individuais válidos encontrados no store (de ${allContacts.length} total)`);
      }
    } catch (storeErr) {
      logger.debug(`[SyncContacts] Store não disponível: ${storeErr}`);
    }

    // Segunda tentativa: usar função de sincronização personalizada
    if (!contacts || contacts.length === 0) {
      try {
        if ((wbot as any).syncContacts) {
          contacts = await (wbot as any).syncContacts();
          logger.info(`[SyncContacts] ${contacts.length} contatos sincronizados via syncContacts()`);
        }
      } catch (syncErr) {
        logger.debug(`[SyncContacts] syncContacts falhou: ${syncErr}`);
      }
    }

    // Terceira tentativa: buscar contatos de grupos participando (MUITO RESTRITIVO)
    if (!contacts || contacts.length === 0) {
      try {
        const groupChats = await (wbot as any).groupFetchAllParticipating();
        contacts = [];
        
        for (const [chatId, chatInfo] of Object.entries(groupChats)) {
          if (chatId.endsWith('@g.us') && (chatInfo as any).participants) {
            for (const participant of (chatInfo as any).participants) {
              const contactId = participant.id;
              const number = contactId.split('@')[0];
              const cleanNumber = number.replace(/\D/g, "");
              
              // VALIDAÇÃO MUITO RESTRITIVA: apenas números que parecem telefones brasileiros reais
              const isBrazilianPhone = cleanNumber.length === 11 && 
                                      (cleanNumber.startsWith('11') || cleanNumber.startsWith('21') || 
                                       cleanNumber.startsWith('31') || cleanNumber.startsWith('41') || 
                                       cleanNumber.startsWith('51') || cleanNumber.startsWith('61') || 
                                       cleanNumber.startsWith('71') || cleanNumber.startsWith('81') || 
                                       cleanNumber.startsWith('85') || cleanNumber.startsWith('27'));
              
              const isInternationalPhone = cleanNumber.length >= 10 && cleanNumber.length <= 12 && 
                                          !cleanNumber.startsWith('55'); // Evitar duplicatas do +55
              
              if (number && 
                  !number.includes('g.us') && 
                  !cleanNumber.includes('25025927') && // Filtrar IDs específicos conhecidos de grupos
                  (isBrazilianPhone || isInternationalPhone) &&
                  cleanNumber.length <= 12) { // Máximo 12 dígitos para evitar IDs longos
                contacts.push({
                  id: contactId,
                  name: participant.notify || cleanNumber,
                  pushname: participant.notify || "",
                  number: cleanNumber,
                  isGroup: false
                });
              }
            }
          }
        }
        
        logger.info(`[SyncContacts] ${contacts.length} contatos válidos encontrados via grupos (FILTRO RESTRITIVO)`);
      } catch (groupErr) {
        logger.debug(`[SyncContacts] Busca em grupos falhou: ${groupErr}`);
      }
    }

    // Quarta tentativa: buscar contatos de chats recentes
    if (!contacts || contacts.length < 10) { // Se temos poucos contatos, tenta buscar mais
      try {
        logger.info(`[SyncContacts] Buscando contatos de chats recentes...`);
        
        // Tentar obter chats recentes se disponível
        if ((wbot as any).store && typeof (wbot as any).loadChats === 'function') {
          const chats = await (wbot as any).loadChats(50); // Últimos 50 chats
          const chatContacts = chats
            .filter((chat: any) => !chat.id.endsWith('@g.us')) // Só chats individuais
            .map((chat: any) => ({
              id: chat.id,
              name: chat.name || chat.id.split('@')[0],
              pushname: chat.name || "",
              number: chat.id.split('@')[0],
              isGroup: false
            }));
          
          if (chatContacts.length > 0) {
            contacts = [...(contacts || []), ...chatContacts];
            logger.info(`[SyncContacts] ${chatContacts.length} contatos adicionados de chats recentes`);
          }
        }
      } catch (chatErr) {
        logger.debug(`[SyncContacts] Busca em chats falhou: ${chatErr}`);
      }
    }

    // Quinta tentativa: método conservador para coletar contatos (DESABILITADO TEMPORARIAMENTE)
    logger.info(`[SyncContacts] Métodos agressivos desabilitados temporariamente para evitar IDs de grupos. Contatos atuais: ${contacts ? contacts.length : 0}`);
    
    // MÉTODOS AGRESSIVOS DESABILITADOS - podem estar coletando IDs de grupos
    /*
    try {
      // Verificar contatos existentes no banco apenas
      const existingContacts = await Contact.findAll({
        where: { tenantId },
        attributes: ['number'],
        limit: 10
      });

      const numbersToCheck = existingContacts.map(c => c.number);
      
      if (numbersToCheck.length > 0) {
        logger.info(`[SyncContacts] Verificando ${numbersToCheck.length} números existentes no banco...`);
        
        // Verificar apenas alguns números para teste
        const batchSize = 3;
        const batch = numbersToCheck.slice(0, batchSize);
        
        try {
          const results = await (wbot as any).onWhatsApp(...batch);
          const validResults = results
            .filter((result: any) => result.exists)
            .map((result: any) => ({
              id: result.jid,
              name: result.name || result.jid.split('@')[0],
              pushname: result.name || "",
              number: result.jid.split('@')[0].replace(/\D/g, ""),
              isGroup: false
            }));
          
          contacts = [...(contacts || []), ...validResults];
          logger.info(`[SyncContacts] ${validResults.length} contatos verificados no WhatsApp`);
        } catch (batchErr) {
          logger.debug(`[SyncContacts] Verificação falhou: ${batchErr}`);
        }
      }

    } catch (conservativeErr) {
      logger.debug(`[SyncContacts] Método conservador falhou: ${conservativeErr}`);
    }
    */

    // Remover duplicatas
    if (contacts && contacts.length > 0) {
      const uniqueContacts = contacts.filter((contact, index, self) => 
        index === self.findIndex((c) => c.number === contact.number)
      );
      contacts = uniqueContacts;
      logger.info(`[SyncContacts] Total após remoção de duplicatas: ${contacts.length} contatos únicos`);
    }

  } catch (err) {
    logger.error(
      `Could not get whatsapp contacts from phone. Check connection page. | Error: ${err}`
    );
  }

  if (!contacts || contacts.length === 0) {
    logger.warn(`[SyncContacts] Nenhum contato encontrado para WhatsApp ${whatsappId}`);
    throw new AppError("ERR_CONTACTS_NOT_EXISTS_WHATSAPP", 404);
  }

  try {
    logger.info(`[SyncContacts] Processando ${contacts.length} contatos`);
    
    // eslint-disable-next-line @typescript-eslint/ban-types
    const dataArray: object[] = [];
    await Promise.all(
      contacts.map(async (contact: any) => {
        const { name, pushname, number, id, isGroup } = contact;
        
        // Debug log para cada contato
        logger.debug(`[SyncContacts] Processando contato: ${JSON.stringify({ name, pushname, number, isGroup })}`);
        
        if (!isGroup && number) {
          // Limpar o número
          const rawNumber = String(number);
          const cleanNumber = rawNumber.replace(/\D/g, "");
          
          // VALIDAÇÃO MUITO RESTRITIVA: apenas números que parecem telefones reais
          const isBrazilianPhone = cleanNumber.length === 11 && 
                                  (cleanNumber.startsWith('11') || cleanNumber.startsWith('21') || 
                                   cleanNumber.startsWith('31') || cleanNumber.startsWith('41') || 
                                   cleanNumber.startsWith('51') || cleanNumber.startsWith('61') || 
                                   cleanNumber.startsWith('71') || cleanNumber.startsWith('81') || 
                                   cleanNumber.startsWith('85') || cleanNumber.startsWith('27'));
          
          const isInternationalPhone = cleanNumber.length >= 10 && cleanNumber.length <= 12 && 
                                      !cleanNumber.startsWith('55') && 
                                      !cleanNumber.includes('25025927'); // Filtrar IDs conhecidos de grupos
          
          // Rejeitar números muito longos que são claramente IDs de grupos
          const isDefinitelyGroupId = cleanNumber.length >= 14 || 
                                     cleanNumber.includes('25025927') ||
                                     cleanNumber.includes('120363');
          
          if (!isDefinitelyGroupId && (isBrazilianPhone || isInternationalPhone)) {
            const contactName = name || pushname || `Contato ${cleanNumber}`;
            const contactObj = { 
              name: contactName, 
              number: cleanNumber, 
              tenantId 
            };
            dataArray.push(contactObj);
            logger.debug(`[SyncContacts] Contato válido adicionado: ${contactName} (${cleanNumber})`);
          } else {
            const rejectReason = isDefinitelyGroupId ? 'ID de grupo detectado' : 'não atende critérios de telefone válido';
            logger.debug(`[SyncContacts] Contato rejeitado - ${rejectReason}: ${cleanNumber} (${cleanNumber.length} dígitos)`);
          }
        } else {
          const rejectReason = isGroup ? 'é grupo' : 'sem número';
          logger.debug(`[SyncContacts] Contato rejeitado - ${rejectReason}: ${name || pushname || 'sem nome'}`);
        }
      })
    );
    
    if (dataArray.length) {
      logger.info(`[SyncContacts] Salvando ${dataArray.length} contatos válidos no banco`);
      
      const d = new Date().toJSON();
      const query = `INSERT INTO "Contacts" (number, name, "tenantId", "createdAt", "updatedAt") VALUES
        ${dataArray
          .map((e: any) => {
            const escapedName = e.name.replace(/'/g, "''"); // Escapar aspas simples
            return `('${e.number}',
            '${escapedName}',
            '${e.tenantId}',
            '${d}'::timestamp,
            '${d}'::timestamp)`;
          })
          .join(",")}
        ON CONFLICT (number, "tenantId") DO NOTHING`;

      await Contact.sequelize?.query(query, {
        type: QueryTypes.INSERT,
      });
      
      logger.info(`[SyncContacts] Sincronização concluída com sucesso. ${dataArray.length} contatos processados`);
    } else {
      logger.warn(`[SyncContacts] Nenhum contato válido encontrado para salvar`);
    }
  } catch (error) {
    logger.error(`[SyncContacts] Erro ao processar contatos: ${error}`);
    throw new Error(`Erro ao sincronizar contatos: ${error}`);
  }
};

export default SyncContactsWhatsappInstanceService;
