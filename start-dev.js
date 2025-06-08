const { exec } = require('child_process');
const path = require('path');

const services = [
  {
    name: 'Backend',
    path: './backend',
    config: 'ecosystem.config.js'
  },
  {
    name: 'Frontend Vue',
    path: './frontend-vue',
    config: 'ecosystem.config.js'
  },
  {
    name: 'Frontend React',
    path: './frontend-react',
    config: 'ecosystem.config.js'
  }
];

function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`Executando: ${command} em ${cwd}`);
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erro: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
      }
      console.log(`Stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}

async function startServices() {
  console.log('🚀 Iniciando serviços de desenvolvimento com PM2...');
  
  try {
    // Para todos os processos PM2 existentes
    console.log('\n📋 Parando processos PM2 existentes...');
    await runCommand('pm2 delete all', process.cwd()).catch(() => {
      console.log('Nenhum processo PM2 encontrado para parar.');
    });
    
    // Inicia cada serviço
    for (const service of services) {
      console.log(`\n🔧 Iniciando ${service.name}...`);
      const servicePath = path.resolve(process.cwd(), service.path);
      await runCommand(`pm2 start ${service.config}`, servicePath);
    }
    
    console.log('\n✅ Todos os serviços foram iniciados!');
    console.log('\n📊 Status dos serviços:');
    await runCommand('pm2 status', process.cwd());
    
    console.log('\n📝 Para monitorar os logs:');
    console.log('   pm2 logs');
    console.log('\n🔄 Para reiniciar todos os serviços:');
    console.log('   pm2 restart all');
    console.log('\n🛑 Para parar todos os serviços:');
    console.log('   pm2 delete all');
    
  } catch (error) {
    console.error('❌ Erro ao iniciar serviços:', error.message);
    process.exit(1);
  }
}

startServices();