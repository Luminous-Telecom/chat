import Campaign from "../models/Campaign";
import CampaignContacts from "../models/CampaignContacts";
import Queue from "../libs/Queue";

const campaignDiagnostics = async () => {
  console.log("=== DIAGNÓSTICO DE CAMPANHAS ===\n");

  try {
    // 1. Verificar campanhas ativas
    console.log("1. Verificando campanhas...");
    const campaigns = await Campaign.findAll({
      where: {
        status: ["scheduled", "processing"]
      },
      include: ["session"]
    });

    if (campaigns.length === 0) {
      console.log("   ❌ Nenhuma campanha ativa encontrada");
    } else {
      console.log(`   ✅ ${campaigns.length} campanha(s) ativa(s) encontrada(s):`);
      
      for (const campaign of campaigns) {
        console.log(`      - ID ${campaign.id}: ${campaign.name}`);
        console.log(`        Status: ${campaign.status}`);
        console.log(`        Início: ${campaign.start}`);
        console.log(`        Horário comercial: ${campaign.businessHoursOnly ? 'Sim' : 'Não'}`);
        console.log(`        Sessão: ${campaign.session?.name || 'N/A'}`);
        
        // Verificar contatos
        const contacts = await CampaignContacts.findAll({
          where: { campaignId: campaign.id }
        });
        console.log(`        Contatos: ${contacts.length}`);
        
        const pendingContacts = contacts.filter(c => !c.messageId);
        const sentContacts = contacts.filter(c => c.messageId);
        
        console.log(`        Pendentes: ${pendingContacts.length}`);
        console.log(`        Enviadas: ${sentContacts.length}`);
        console.log("");
      }
    }

    // 2. Verificar fila de jobs
    console.log("2. Verificando fila de jobs...");
    const campaignQueue = Queue.queues.find(q => q.name === "SendMessageWhatsappCampaign");
    
    if (!campaignQueue) {
      console.log("   ❌ Fila de campanhas não encontrada");
    } else {
      console.log("   ✅ Fila de campanhas encontrada");
      
      // Verificar jobs pendentes
      try {
        const waiting = await campaignQueue.bull.getWaiting();
        const delayed = await campaignQueue.bull.getDelayed();
        const active = await campaignQueue.bull.getActive();
        const completed = await campaignQueue.bull.getCompleted();
        const failed = await campaignQueue.bull.getFailed();

        console.log(`      - Jobs aguardando: ${waiting.length}`);
        console.log(`      - Jobs agendados: ${delayed.length}`);
        console.log(`      - Jobs ativos: ${active.length}`);
        console.log(`      - Jobs completados: ${completed.length}`);
        console.log(`      - Jobs falharam: ${failed.length}`);

        if (delayed.length > 0) {
          console.log("\n      Jobs agendados (próximos 5):");
          for (let i = 0; i < Math.min(5, delayed.length); i++) {
            const job = delayed[i];
            const delay = job.opts.delay;
            if (delay !== undefined) {
              const executeAt = new Date(Date.now() + delay);
              console.log(`        - Job ${job.id}: executa em ${executeAt.toLocaleString()}`);
            } else {
              console.log(`        - Job ${job.id}: delay não definido`);
            }
          }
        }

        if (failed.length > 0) {
          console.log("\n      Jobs que falharam (últimos 3):");
          for (let i = 0; i < Math.min(3, failed.length); i++) {
            const job = failed[i];
            console.log(`        - Job ${job.id}: ${job.failedReason}`);
          }
        }

      } catch (error) {
        console.log(`   ⚠️  Erro ao verificar jobs: ${error.message}`);
      }
    }

    // 3. Verificar Redis
    console.log("\n3. Verificando conexão Redis...");
    try {
      if (campaignQueue) {
        await campaignQueue.bull.client.ping();
        console.log("   ✅ Redis conectado");
      }
    } catch (error) {
      console.log(`   ❌ Erro no Redis: ${error.message}`);
    }

    // 4. Verificar processamento da fila
    console.log("\n4. Verificando processamento da fila...");
    if (campaignQueue) {
      const processing = campaignQueue.bull.process.length;
      console.log(`   ${processing > 0 ? '✅' : '❌'} Fila está sendo processada (${processing} processadores ativos)`);
    }

    console.log("\n=== FIM DO DIAGNÓSTICO ===");

  } catch (error) {
    console.error("Erro durante diagnóstico:", error);
  }
};

// Executar se for chamado diretamente
if (require.main === module) {
  campaignDiagnostics().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error("Erro:", error);
    process.exit(1);
  });
}

export default campaignDiagnostics; 