#!/usr/bin/env ts-node

import SessionDiagnostics from "../utils/sessionDiagnostics";
import { logger } from "../utils/logger";
import { restartBaileysSession } from "../libs/baileys";
import Whatsapp from "../models/Whatsapp";

const sessionDiagnosticsCommand = async () => {
  const command = process.argv[2];
  const sessionId = process.argv[3];

  try {
    switch (command) {
      case "health":
        console.log("🔍 Gerando relatório de saúde das sessões...\n");
        const report = await SessionDiagnostics.generateHealthReport();
        console.log(report);
        break;

      case "diagnose":
        if (!sessionId) {
          console.log("❌ Por favor, forneça o ID da sessão: npm run diagnose <sessionId>");
          process.exit(1);
        }
        console.log(`🔍 Diagnosticando sessão ${sessionId}...\n`);
        const diagnostic = await SessionDiagnostics.diagnoseSession(parseInt(sessionId));
        console.log("📊 RESULTADO DO DIAGNÓSTICO:");
        console.log(`- ID da Sessão: ${diagnostic.sessionId}`);
        console.log(`- Estado da Conexão: ${diagnostic.connectionState}`);
        console.log(`- WebSocket Existe: ${diagnostic.wsExists ? 'Sim' : 'Não'}`);
        console.log(`- Estado do WebSocket: ${diagnostic.wsState ?? 'Indefinido'}`);
        console.log(`- Sessão Saudável: ${diagnostic.isReady ? '✅ Sim' : '❌ Não'}`);
        console.log(`- Contagem de Erros: ${diagnostic.errorCount}`);
        break;

      case "restart":
        if (!sessionId) {
          console.log("❌ Por favor, forneça o ID da sessão: npm run restart-session <sessionId>");
          process.exit(1);
        }
        console.log(`🔄 Reiniciando sessão ${sessionId}...\n`);
        
        // Verificar se a sessão existe no banco
        const whatsapp = await Whatsapp.findByPk(parseInt(sessionId));
        if (!whatsapp) {
          console.log(`❌ Sessão ${sessionId} não encontrada no banco de dados`);
          process.exit(1);
        }

        const restartedSession = await restartBaileysSession(parseInt(sessionId));
        if (restartedSession) {
          console.log(`✅ Sessão ${sessionId} reiniciada com sucesso`);
        } else {
          console.log(`❌ Falha ao reiniciar sessão ${sessionId}`);
        }
        break;

      case "monitor":
        console.log("🔍 Iniciando monitoramento contínuo das sessões...");
        console.log("📝 Relatórios serão gerados a cada 5 minutos");
        console.log("⏹️  Pressione Ctrl+C para parar\n");
        
        SessionDiagnostics.startPeriodicHealthCheck(300000); // 5 minutos
        
        // Manter o processo rodando
        process.on('SIGINT', () => {
          console.log('\n🛑 Monitoramento interrompido pelo usuário');
          process.exit(0);
        });
        
        // Executar relatório inicial
        setTimeout(async () => {
          const initialReport = await SessionDiagnostics.generateHealthReport();
          console.log(initialReport);
        }, 1000);
        
        break;

      case "fix-all":
        console.log("🔧 Identificando e corrigindo sessões problemáticas...\n");
        
        const allDiagnostics = await SessionDiagnostics.diagnoseAllSessions();
        const problematicSessions = allDiagnostics.filter(d => !d.isReady);
        
        if (problematicSessions.length === 0) {
          console.log("✅ Todas as sessões estão saudáveis!");
          break;
        }

        console.log(`🔧 Encontradas ${problematicSessions.length} sessões problemáticas. Iniciando correção...\n`);
        
        for (const session of problematicSessions) {
          console.log(`🔄 Corrigindo sessão ${session.sessionId}...`);
          
          try {
            const restarted = await restartBaileysSession(session.sessionId);
            if (restarted) {
              console.log(`✅ Sessão ${session.sessionId} corrigida`);
              SessionDiagnostics.resetErrorCount(session.sessionId);
            } else {
              console.log(`❌ Falha ao corrigir sessão ${session.sessionId}`);
            }
          } catch (err) {
            console.log(`❌ Erro ao corrigir sessão ${session.sessionId}: ${err}`);
          }
          
          // Aguardar um pouco entre as correções
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log("\n🎉 Processo de correção concluído!");
        break;

      default:
        console.log(`
🔧 DIAGNÓSTICO DE SESSÕES BAILEYS

Comandos disponíveis:
  health          - Gerar relatório de saúde de todas as sessões
  diagnose <id>   - Diagnosticar uma sessão específica
  restart <id>    - Reiniciar uma sessão específica
  monitor         - Monitoramento contínuo (Ctrl+C para parar)
  fix-all         - Corrigir automaticamente todas as sessões problemáticas

Exemplos:
  npm run session-diagnostics health
  npm run session-diagnostics diagnose 6
  npm run session-diagnostics restart 6
  npm run session-diagnostics monitor
  npm run session-diagnostics fix-all
        `);
    }
  } catch (err) {
    logger.error(`[SessionDiagnostics] Erro no comando: ${err}`);
    console.log(`❌ Erro: ${err.message}`);
    process.exit(1);
  }
};

// Executar apenas se chamado diretamente
if (require.main === module) {
  sessionDiagnosticsCommand();
}

export default sessionDiagnosticsCommand; 