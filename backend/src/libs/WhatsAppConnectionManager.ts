import { logger } from '../utils/logger';
import { getBaileys, removeBaileys, type Session } from './baileys';
import Whatsapp from '../models/Whatsapp';
import StartWhatsAppSession from '../services/WbotServices/StartWhatsAppSession';
import { getIO } from './socket';

// Constantes
const INTERVALO_VERIFICACAO_SAUDE = 15000; // 15 segundos
const INTERVALO_MONITORAMENTO = 60000; // 1 minuto
const INTERVALO_SINCRONIZACAO = 30000; // 30 segundos
const LIMITE_MEMORIA = 1024 * 1024 * 1024; // 1GB

// Verificação de saúde da sessão
const verificarSaudeSessao = async (whatsappId: number): Promise<boolean> => {
  try {
    const sessao = getBaileys(whatsappId);
    if (!sessao?.user?.id) {
      logger.warn(`Sessão ${whatsappId} não tem usuário definido`);
      return false;
    }
    await sessao.fetchStatus(sessao.user.id);
    return true;
  } catch (err) {
    logger.error(`Verificação de saúde falhou para sessão ${whatsappId}: ${err}`);
    return false;
  }
};

// Tratamento de erros de inicialização
const tratarErroInicializacao = async (whatsapp: Whatsapp, erro: Error): Promise<void> => {
  const erroRecuperavel = erro.message.includes('timeout') || 
                         erro.message.includes('connection') ||
                         erro.message.includes('network');
                       
  if (erroRecuperavel) {
    logger.warn(`Erro recuperável para WhatsApp ${whatsapp.id}: ${erro.message}`);
    await whatsapp.update({ 
      status: "DISCONNECTED",
      retries: (whatsapp.retries || 0) + 1
    });
    
    const delay = Math.min(30000 * Math.pow(2, whatsapp.retries || 0), 300000);
    setTimeout(async () => {
      try {
        await StartWhatsAppSession(whatsapp, true);
      } catch (erroRetry) {
        logger.error(`Retry falhou para WhatsApp ${whatsapp.id}: ${erroRetry}`);
      }
    }, delay);
  } else {
    logger.error(`Erro não recuperável para WhatsApp ${whatsapp.id}: ${erro.message}`);
    await whatsapp.update({ 
      status: "DISCONNECTED",
      qrcode: "",
      session: null
    });
  }
};

// Monitoramento de recursos
const monitorarRecursos = () => {
  setInterval(async () => {
    const usoMemoria = process.memoryUsage();
    const whatsapps = await Whatsapp.findAll({
      where: { type: "whatsapp", status: "CONNECTED" }
    });
    
    logger.info(`Uso de recursos: ${JSON.stringify({
      sessoes: whatsapps.length,
      memoria: {
        heapUsado: Math.round(usoMemoria.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(usoMemoria.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(usoMemoria.rss / 1024 / 1024) + 'MB'
      }
    })}`);
    
    if (usoMemoria.heapUsed > LIMITE_MEMORIA) {
      logger.warn('Alto uso de memória detectado, iniciando limpeza');
      limparRecursos();
    }
  }, INTERVALO_MONITORAMENTO);
};

// Limpeza de recursos
const limparRecursos = async () => {
  try {
    const whatsapps = await Whatsapp.findAll({
      where: { type: "whatsapp" }
    });

    // Limpar sessões inativas
    for (const whatsapp of whatsapps) {
      if (whatsapp.status !== "CONNECTED") {
        await removeBaileys(whatsapp.id, 'limpeza_recursos');
        logger.info(`Sessão ${whatsapp.id} removida durante limpeza de recursos`);
      }
    }
    
    // Forçar coleta de lixo
    if (global.gc) {
      global.gc();
      logger.info('Coleta de lixo forçada executada');
    }
  } catch (err) {
    logger.error(`Erro durante limpeza de recursos: ${err}`);
  }
};

// Sincronização de estado
const sincronizarEstadoSessao = async (whatsapp: Whatsapp): Promise<void> => {
  try {
    const estadoDB = await Whatsapp.findByPk(whatsapp.id);
    if (!estadoDB) return;
    
    try {
      const sessao = getBaileys(whatsapp.id);
      const estaSaudavel = await verificarSaudeSessao(whatsapp.id);
      
      // Se a sessão existe e está saudável, mas o DB mostra desconectada
      if (estaSaudavel && estadoDB.status !== "CONNECTED") {
        logger.warn(`Inconsistência de estado para WhatsApp ${whatsapp.id}: sessão existe e saudável mas DB mostra ${estadoDB.status}`);
        
        // Verificar se a sessão tem usuário válido
        if (sessao?.user?.id) {
          logger.info(`Corrigindo estado no DB para CONNECTED para WhatsApp ${whatsapp.id}`);
          await estadoDB.update({ 
            status: "CONNECTED",
            qrcode: "",
            retries: 0
          });
          
          const io = getIO();
          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: estadoDB
          });
        } else {
          // Se não tem usuário válido, forçar reconexão
          logger.warn(`Sessão ${whatsapp.id} existe mas sem usuário válido, forçando reconexão`);
          await removeBaileys(whatsapp.id, 'sessao_sem_usuario');
          await StartWhatsAppSession(whatsapp, true);
        }
      }
    } catch (err) {
      // Se não consegue obter a sessão mas o DB mostra conectada
      if (estadoDB.status === "CONNECTED") {
        logger.warn(`Inconsistência de estado para WhatsApp ${whatsapp.id}: sessão perdida mas DB mostra conectada`);
        
        // Tentar reconectar se estiver em estado inválido
        if (['CONNECTED', 'OPENING'].includes(estadoDB.status)) {
          logger.info(`Tentando reconectar WhatsApp ${whatsapp.id}`);
          await estadoDB.update({ status: "DISCONNECTED" });
          
          const io = getIO();
          io.emit(`${whatsapp.tenantId}:whatsappSession`, {
            action: "update",
            session: estadoDB
          });
          
          // Aguardar um pouco antes de tentar reconectar
          await new Promise(resolve => setTimeout(resolve, 2000));
          await StartWhatsAppSession(whatsapp, true);
        }
      }
    }
  } catch (err) {
    logger.error(`Erro ao sincronizar estado para WhatsApp ${whatsapp.id}: ${err}`);
  }
};

// Iniciar verificações periódicas
const iniciarVerificacoesPeriodicas = () => {
  // Verificação de saúde
  setInterval(async () => {
    const whatsapps = await Whatsapp.findAll({
      where: { type: "whatsapp", status: "CONNECTED" }
    });
    
    for (const whatsapp of whatsapps) {
      try {
        const estaSaudavel = await verificarSaudeSessao(whatsapp.id);
        if (!estaSaudavel) {
          logger.warn(`Sessão ${whatsapp.id} não está saudável, tentando reconectar`);
          await removeBaileys(whatsapp.id, 'sessao_nao_saudavel');
          await StartWhatsAppSession(whatsapp, true);
        }
      } catch (err) {
        logger.error(`Falha ao reconectar sessão ${whatsapp.id}: ${err}`);
      }
    }
  }, INTERVALO_VERIFICACAO_SAUDE);

  // Sincronização de estado
  setInterval(async () => {
    const whatsapps = await Whatsapp.findAll({
      where: { type: "whatsapp" }
    });
    
    for (const whatsapp of whatsapps) {
      try {
        await sincronizarEstadoSessao(whatsapp);
      } catch (err) {
        logger.error(`Falha ao sincronizar estado para WhatsApp ${whatsapp.id}: ${err}`);
      }
    }
  }, INTERVALO_SINCRONIZACAO);

  // Monitoramento de recursos
  monitorarRecursos();
};

// Exportar funções
export {
  verificarSaudeSessao,
  tratarErroInicializacao,
  monitorarRecursos,
  sincronizarEstadoSessao,
  iniciarVerificacoesPeriodicas
}; 