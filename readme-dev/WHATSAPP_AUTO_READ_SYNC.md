# Sincronização Automática de Leitura WhatsApp Business

## Descrição

Esta funcionalidade sincroniza automaticamente o status de leitura das mensagens entre o WhatsApp Business e o sistema interno. Quando uma mensagem é **lida no WhatsApp Business** (recebe ACK 3), ela é **automaticamente marcada como visualizada** no sistema, atualizando contadores e status em tempo real.

## 🎯 Objetivo

Resolver a inconsistência onde mensagens lidas no WhatsApp Business permaneciam como "não lidas" no sistema interno, causando:
- Contadores incorretos de mensagens não lidas
- Tickets que não eram marcados como respondidos
- Falta de sincronização entre WhatsApp e sistema

## 🚀 Como Funciona

### Fluxo Automatizado

1. **Mensagem é lida no WhatsApp Business** → ACK 3 é recebido
2. **Sistema detecta mudança**: `ack < 3` → `ack = 3` 
3. **Automaticamente executa**:
   - ✅ Marca mensagem como `read: true` no banco
   - 📊 Reduz contador `unreadMessages` do ticket
   - 🎫 Marca ticket como `answered: true` se não há mais mensagens não lidas
   - 🔄 Notifica frontend via WebSocket em tempo real

### Condições para Ativação

A sincronização automática ocorre apenas quando:
- ✅ A mensagem **NÃO estava lida** antes (`ack < 3`)
- ✅ A mensagem **AGORA está lida** (`ack >= 3`)
- ✅ A mensagem **NÃO é enviada por mim** (`fromMe: false`)
- ✅ É uma mensagem **recebida** de contatos

## 🛠️ Implementação Técnica

### 1. Serviço Centralizado
```typescript
// backend/src/services/MessageServices/MarkMessageAsReadService.ts
export const MarkMessageAsReadService = async ({
  message,
  ticket,
  ack,
  transaction,
  source = "system"
}: MarkMessageAsReadParams): Promise<void>
```

### 2. Integração com ACKs
```typescript
// backend/src/services/WbotServices/helpers/HandleMsgAck.ts
if (wasNotRead && isNowRead && !messageToUpdate.fromMe) {
  await MarkMessageAsReadService({
    message: messageToUpdate,
    ticket,
    ack,
    transaction: messageTransaction,
    source: "whatsapp_ack"
  });
}
```

### 3. Eventos WebSocket
```typescript
// Payload atualizado para o frontend
{
  type: "chat:ack",
  payload: {
    id: messageId,
    ack: 3,
    read: true,
    wasMarkedAsRead: true, // 🔥 NOVO: indica marcação automática
    source: "whatsapp_ack", // 🔥 NOVO: origem da marcação
    ticket: {
      unreadMessages: 0, // Atualizado em tempo real
      answered: true     // Atualizado automaticamente
    }
  }
}
```

## 📊 Monitoramento e Logs

### Logs de Sucesso
```
[HandleMsgAck] 👁️ MENSAGEM VISUALIZADA: Marcando mensagem 123 como lida automaticamente (ACK 3)
[MarkMessageAsReadService] 📖 MARKED AS READ: Message 123 from whatsapp_ack, ticket 456 unreadMessages: 0, answered: true
```

### Logs de Debug
```
[MarkMessageAsReadService] Message 123 already marked as read
[MarkMessageAsReadService] Skipping read mark for outgoing message 123
```

## 🎨 Benefícios

### Para Operadores
- ✅ **Sincronização em tempo real** entre WhatsApp e sistema
- ✅ **Contadores precisos** de mensagens não lidas
- ✅ **Status correto** de tickets (respondido/não respondido)
- ✅ **Experiência consistente** entre plataformas

### Para o Sistema
- 🚀 **Performance otimizada** - apenas mensagens que mudaram de status
- 🔒 **Transações seguras** - rollback em caso de erro
- 📡 **Eventos em tempo real** para frontend
- 📝 **Logs detalhados** para debugging

### Para Gestores
- 📈 **Métricas precisas** de atendimento
- 🎯 **Indicadores confiáveis** de produtividade
- 📊 **Relatórios consistentes** com realidade do WhatsApp

## 🔄 Cenários de Uso

### Cenário 1: Leitura Normal
```
1. Cliente envia mensagem → Sistema recebe (ack: 1, read: false)
2. Operador lê no WhatsApp → ACK 3 recebido
3. Sistema automaticamente: read: true, unreadMessages--
```

### Cenário 2: Múltiplas Mensagens
```
1. Cliente envia 3 mensagens → unreadMessages: 3
2. Operador lê 2 no WhatsApp → unreadMessages: 1, answered: false
3. Operador lê a última → unreadMessages: 0, answered: true
```

### Cenário 3: Mensagem de Áudio
```
1. Cliente envia áudio → ACK 2 (entregue)
2. Operador reproduz → ACK 5 (reproduzido) + read: true
3. Sistema marca automaticamente como visualizada
```

## ⚙️ Configurações

### Fonte da Marcação
- `"whatsapp_ack"` - Automática via ACK do WhatsApp
- `"manual"` - Manual pelo operador no sistema
- `"system"` - Automática por regras do sistema

### Transações
- **Com transação**: Não emite eventos WebSocket (aguarda commit)
- **Sem transação**: Emite eventos imediatamente

## 🔍 Troubleshooting

### Mensagem não marcada como lida
**Verificar:**
- ✅ Mensagem é `fromMe: false`?
- ✅ ACK mudou de `< 3` para `>= 3`?
- ✅ Mensagem não estava já marcada como `read: true`?

### Contador incorreto
**Possíveis causas:**
- Mensagens antigas sem ACK processado
- Falhas em transações anteriores
- Marcações manuais inconsistentes

### Eventos não chegando no frontend
**Verificar:**
- WebSocket conectado no tenantId correto
- Evento emitido no canal certo: `${tenantId}:ticketList`
- Payload com estrutura correta

## 🚀 Próximas Melhorias

1. **Sincronização bidirecional** - marcar como lida no WhatsApp quando lida no sistema
2. **Bulk operations** - marcar múltiplas mensagens como lidas
3. **Histórico de sincronização** - log de todas as sincronizações
4. **Configuração por tenant** - habilitar/desabilitar por empresa
5. **Retry mechanism** - tentar novamente em caso de falha

## 🎯 Métricas de Sucesso

- **Taxa de sincronização**: > 99% das mensagens lidas sincronizadas
- **Latência**: < 500ms entre ACK e atualização no sistema
- **Precisão**: 100% de consistência entre contadores
- **Confiabilidade**: Zero perda de sincronização por falhas 