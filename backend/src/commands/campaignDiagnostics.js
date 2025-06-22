// Carregar variáveis de ambiente
require('dotenv').config();

const { QueryTypes } = require('sequelize');
const { Sequelize } = require('sequelize');

const campaignDiagnostics = async () => {
  console.log("=== DIAGNÓSTICO DE CAMPANHAS ===\n");

  try {
    // Conectar ao banco de dados usando as variáveis de ambiente
    const sequelize = new Sequelize({
      dialect: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.POSTGRES_DB || 'chat',
      username: process.env.POSTGRES_USER || 'chat',
      password: process.env.POSTGRES_PASSWORD || 'chat123',
      logging: false,
    });
    
    // 1. Verificar campanhas ativas
    console.log("1. Verificando campanhas...");
    const campaigns = await sequelize.query(`
      SELECT 
        c.id, 
        c.name, 
        c.status, 
        c.start, 
        c."businessHoursOnly",
        w.name as session_name,
        w.status as session_status
      FROM "Campaigns" c
      LEFT JOIN "Whatsapps" w ON c."sessionId" = w.id
      WHERE c.status IN ('scheduled', 'processing')
      ORDER BY c.id DESC
    `, { type: QueryTypes.SELECT });

    if (campaigns.length === 0) {
      console.log("   ❌ Nenhuma campanha ativa encontrada");
    } else {
      console.log(`   ✅ ${campaigns.length} campanha(s) ativa(s) encontrada(s):`);
      
      for (const campaign of campaigns) {
        console.log(`      - ID ${campaign.id}: ${campaign.name}`);
        console.log(`        Status: ${campaign.status}`);
        console.log(`        Início: ${campaign.start}`);
        console.log(`        Horário comercial: ${campaign.businessHoursOnly ? 'Sim' : 'Não'}`);
        console.log(`        Sessão: ${campaign.session_name || 'N/A'} (${campaign.session_status || 'N/A'})`);
        
        // Verificar contatos
        const contacts = await sequelize.query(`
          SELECT 
            COUNT(*) as total,
            COUNT("messageId") as sent,
            COUNT(*) - COUNT("messageId") as pending
          FROM "CampaignContacts" 
          WHERE "campaignId" = :campaignId
        `, { 
          replacements: { campaignId: campaign.id },
          type: QueryTypes.SELECT 
        });
        
        const stats = contacts[0];
        console.log(`        Contatos: ${stats.total}`);
        console.log(`        Pendentes: ${stats.pending}`);
        console.log(`        Enviadas: ${stats.sent}`);
        console.log("");
      }
    }

    // 2. Verificar últimas campanhas (incluindo finalizadas)
    console.log("2. Verificando últimas campanhas (todas)...");
    const allCampaigns = await sequelize.query(`
      SELECT 
        c.id, 
        c.name, 
        c.status, 
        c.start, 
        c."businessHoursOnly",
        c."createdAt"
      FROM "Campaigns" c
      ORDER BY c."createdAt" DESC
      LIMIT 5
    `, { type: QueryTypes.SELECT });

    if (allCampaigns.length === 0) {
      console.log("   ❌ Nenhuma campanha encontrada");
    } else {
      console.log(`   ✅ Últimas ${allCampaigns.length} campanhas:`);
      
      for (const campaign of allCampaigns) {
        console.log(`      - ID ${campaign.id}: ${campaign.name} (${campaign.status})`);
        console.log(`        Criada: ${campaign.createdAt}`);
        console.log(`        Início programado: ${campaign.start}`);
        console.log(`        Horário comercial: ${campaign.businessHoursOnly ? 'Sim' : 'Não'}`);
        console.log("");
      }
    }

    // 3. Verificar Redis (tentar conexão básica)
    console.log("3. Verificando configuração Redis...");
    console.log(`   Host: ${process.env.IO_REDIS_SERVER || 'localhost'}`);
    console.log(`   Port: ${process.env.IO_REDIS_PORT || '6379'}`);
    console.log(`   Password: ${process.env.IO_REDIS_PASSWORD ? 'Configurada' : 'Não configurada'}`);

         // 4. Verificar jobs relacionados à campanha recente
     console.log("4. Verificando jobs de campanha...");
     const recentCampaignContacts = await sequelize.query(`
       SELECT 
         cc.id,
         cc."campaignId",
         cc."jobId",
         cc."messageId",
         cc."timestamp",
         cc."createdAt",
         cc.body,
         cc."mediaName",
         cc."messageRandom",
         co.number,
         c.name as campaign_name
       FROM "CampaignContacts" cc
       JOIN "Campaigns" c ON cc."campaignId" = c.id
       JOIN "Contacts" co ON cc."contactId" = co.id
       WHERE c."createdAt" > NOW() - INTERVAL '1 hour'
       ORDER BY cc."createdAt" DESC
       LIMIT 10
     `, { type: QueryTypes.SELECT });

    if (recentCampaignContacts.length === 0) {
      console.log("   ❌ Nenhum contato de campanha recente encontrado");
    } else {
      console.log(`   ✅ ${recentCampaignContacts.length} contatos de campanha da última hora:`);
      
             for (const contact of recentCampaignContacts) {
         console.log(`      - Campanha: ${contact.campaign_name} (ID: ${contact.campaignId})`);
         console.log(`        Número: ${contact.number}`);
         console.log(`        Job ID: ${contact.jobId || 'N/A'}`);
         console.log(`        Message ID: ${contact.messageId || 'Não enviada'}`);
         console.log(`        Corpo da mensagem: ${contact.body || 'N/A'}`);
         console.log(`        Mídia: ${contact.mediaName || 'Nenhuma'}`);
         console.log(`        Timestamp: ${contact.timestamp || 'N/A'}`);
         console.log(`        Criado: ${contact.createdAt}`);
         console.log(`        Status: ${contact.messageId ? '✅ ENVIADA' : '❌ NÃO ENVIADA'}`);
         console.log("");
       }
    }

         // 5. Verificar se há problemas específicos
     console.log("5. Verificando possíveis problemas...");
     
     // Verificar contatos sem messageId (não enviados)
     const notSentContacts = await sequelize.query(`
       SELECT 
         cc.id,
         cc."campaignId", 
         c.name as campaign_name,
         co.number,
         cc."createdAt"
       FROM "CampaignContacts" cc
       JOIN "Campaigns" c ON cc."campaignId" = c.id
       JOIN "Contacts" co ON cc."contactId" = co.id
       WHERE cc."messageId" IS NULL 
       AND c."createdAt" > NOW() - INTERVAL '1 hour'
       ORDER BY cc."createdAt" DESC
     `, { type: QueryTypes.SELECT });

     if (notSentContacts.length > 0) {
       console.log(`   ⚠️  ${notSentContacts.length} mensagens NÃO foram enviadas:`);
       for (const contact of notSentContacts) {
         console.log(`      - Campanha: ${contact.campaign_name}`);
         console.log(`        Número: ${contact.number}`);
         console.log(`        Criado: ${contact.createdAt}`);
       }
     } else {
       console.log("   ✅ Todas as mensagens recentes foram enviadas com sucesso!");
     }

     // Verificar campanhas que ainda estão scheduled mas deveriam estar finished
     const stuckCampaigns = await sequelize.query(`
       SELECT 
         c.id,
         c.name,
         c.status,
         COUNT(cc.id) as total_contacts,
         COUNT(cc."messageId") as sent_contacts
       FROM "Campaigns" c
       LEFT JOIN "CampaignContacts" cc ON c.id = cc."campaignId"
       WHERE c.status = 'scheduled' 
       AND c."createdAt" > NOW() - INTERVAL '1 hour'
       GROUP BY c.id, c.name, c.status
       HAVING COUNT(cc.id) > 0 AND COUNT(cc.id) = COUNT(cc."messageId")
     `, { type: QueryTypes.SELECT });

     if (stuckCampaigns.length > 0) {
       console.log(`   ⚠️  ${stuckCampaigns.length} campanha(s) deveria(m) estar 'finished':`);
       for (const campaign of stuckCampaigns) {
         console.log(`      - ${campaign.name} (${campaign.sent_contacts}/${campaign.total_contacts} enviadas)`);
       }
     }

     console.log("\n=== RESUMO FINAL ===");
     console.log("📊 Se você vê Message IDs = mensagens foram enviadas pelo sistema");
     console.log("📱 Para confirmar chegada no WhatsApp, verifique o app diretamente");
     console.log("🔧 Se não chegou no WhatsApp: problema na sessão/conexão");
     console.log("=== FIM DO DIAGNÓSTICO ===");

     // Fechar conexão
     await sequelize.close();

  } catch (error) {
    console.error("Erro durante diagnóstico:", error.message);
  }
};

// Executar
campaignDiagnostics().then(() => {
  process.exit(0);
}).catch(error => {
  console.error("Erro:", error);
  process.exit(1);
}); 