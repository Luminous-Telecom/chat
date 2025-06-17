# Solução para Erro de Criptografia do Baileys

## Problema
O erro `"No SenderKeyRecord found for decryption"` ocorre quando o Baileys não consegue descriptografar mensagens de grupo do WhatsApp devido a problemas com as chaves de criptografia.

## Causas Comuns
1. **Sessão corrompida**: Os dados da sessão podem estar corrompidos
2. **Chaves desatualizadas**: As chaves de criptografia podem estar desatualizadas
3. **Problemas de sincronização**: Falha na sincronização entre dispositivos
4. **Versão do Baileys**: Problemas específicos da versão utilizada
5. **Estado inconsistente**: Sessão marcada como conectada mas sem WebSocket ativo

## Soluções Implementadas

### 1. Configurações Melhoradas do Baileys
- Adicionadas configurações específicas para melhorar o tratamento de grupos
- Implementado handler automático para detectar erros de criptografia
- Melhorada a estabilidade da sessão

### 2. Monitoramento Automático de Sessões
- Sistema monitora automaticamente o estado das sessões a cada 30 segundos
- Detecta sessões com estado inconsistente (conectada mas sem WebSocket)
- Regenera automaticamente sessões problemáticas
- Logs detalhados para acompanhamento

### 3. Regeneração Automática de Sessões
- Sistema detecta automaticamente problemas de criptografia
- Regenera sessões automaticamente quando necessário
- Limpa dados corrompidos e força nova autenticação

### 4. Utilitários de Limpeza
- Script para limpar todas as sessões corrompidas
- Função para regenerar sessão específica
- Endpoints da API para gerenciamento manual

## Como Usar

### Monitoramento Automático (Recomendado)
O sistema agora monitora automaticamente as sessões e corrige problemas:

```bash
# O sistema monitora e corrige automaticamente
# Verifique os logs para acompanhar o processo
```

### Verificar Status das Sessões
```bash
# Verificar status de todas as sessões
GET /api/whatsapp/sessions/status

# Resposta exemplo:
{
  "sessions": [
    {
      "id": 6,
      "name": "teste",
      "status": "CONNECTED",
      "connectionState": "open",
      "wsExists": true,
      "isActive": true,
      "lastUpdate": "2025-06-16T23:51:59.428Z"
    }
  ],
  "totalSessions": 1,
  "activeSessions": 1
}
```

### Limpeza Manual via Script
```bash
# Limpar todas as sessões corrompidas
npm run clear-sessions

# Ou executar diretamente
npx ts-node src/utils/clearCorruptedSessions.ts
```

### Limpeza Manual via API
```bash
# Regenerar sessão específica
POST /api/whatsapp/{whatsappId}/regenerate-session

# Limpar todas as sessões
POST /api/whatsapp/clear-all-sessions

# Verificar status das sessões
GET /api/whatsapp/sessions/status
```

### Limpeza Manual via Código
```typescript
import { clearCorruptedSessions, clearSpecificSession } from './src/utils/clearCorruptedSessions';

// Limpar todas as sessões
await clearCorruptedSessions();

// Limpar sessão específica
await clearSpecificSession(whatsappId);
```

## Passos para Resolver o Problema

### 1. Identificar o Problema
- Verifique os logs para confirmar o erro de criptografia
- Use o endpoint `/api/whatsapp/sessions/status` para verificar o estado das sessões
- Identifique qual WhatsApp está com problema

### 2. Aguardar Correção Automática
- O sistema tentará corrigir automaticamente
- Aguarde alguns minutos para ver se resolve
- Monitore os logs para acompanhar o processo

### 3. Limpeza Manual (se necessário)
```bash
# Parar o servidor
pm2 stop chat-backend

# Limpar sessões
npm run clear-sessions

# Reiniciar o servidor
pm2 start chat-backend
```

### 4. Reautenticação
- Após a limpeza, será necessário escanear o QR code novamente
- Ou usar o pairing code se configurado

## Logs Importantes

### Monitoramento Automático
```
[Session Monitor] Session teste has open connection but no WebSocket - attempting recovery
[Session Monitor] Session teste regenerated successfully
```

### Detectar Problema
```
[Baileys] Possível erro de criptografia detectado para grupo: 120363285865750234@g.us
```

### Regeneração Automática
```
[Baileys] Sessão regenerada automaticamente para resolver problema de criptografia
```

### Limpeza Manual
```
Iniciando limpeza de sessões corrompidas...
Diretório da sessão limpo: /path/to/session
Sessão regenerada com sucesso para WhatsApp Name
```

## Troubleshooting

### Se o problema persistir:
1. **Verificar versão do Baileys**: Atualize para a versão mais recente
2. **Limpar cache**: Remova arquivos temporários do sistema
3. **Verificar permissões**: Certifique-se que o diretório de sessões tem permissões corretas
4. **Reiniciar completamente**: Pare todos os serviços e reinicie

### Se houver problemas de rede:
1. **Verificar conectividade**: Teste conexão com servidores do WhatsApp
2. **Proxy/Firewall**: Verifique se não há bloqueios
3. **DNS**: Use DNS confiáveis (8.8.8.8, 1.1.1.1)

### Se o monitoramento não funcionar:
1. **Verificar logs**: Procure por erros no monitoramento
2. **Reiniciar serviço**: Pare e reinicie o servidor
3. **Verificar configuração**: Confirme se as configurações estão corretas

## Contato
Se o problema persistir após tentar todas as soluções, entre em contato com o suporte técnico fornecendo:
- Logs completos do erro
- Versão do Baileys utilizada
- Configuração do sistema
- Passos já tentados
- Status das sessões (via endpoint) 