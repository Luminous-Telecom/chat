# Ignorar Mensagens de Grupos - Sempre Ativo

## Descrição
O sistema está configurado para SEMPRE ignorar totalmente mensagens de grupos do WhatsApp, incluindo:
- Não processar as mensagens
- Não gerar logs
- Não criar tickets
- Não armazenar no banco de dados
- Não processar ACKs (confirmações de leitura/entrega)

**Esta funcionalidade está HARDCODED e não pode ser desabilitada.**

## Implementação Técnica

### Pontos de Filtragem

1. **StartWhatsAppSession.ts** (Ponto mais inicial)
   - Handler `messages.upsert`: Filtra mensagens antes de qualquer processamento
   - Handler `messages.update`: Filtra updates/ACKs de mensagens de grupos

2. **baileys.ts** (Fila de processamento)
   - Filtra mensagens na fila de processamento antes de chamar handlers

3. **HandleBaileysMessage.ts** (Processamento principal)
   - Verificação adicional caso alguma mensagem passe pelos filtros anteriores

4. **HandleMessage.ts** (Processamento alternativo)
   - Suporte para diferentes tipos de cliente WhatsApp

### Benefícios da Implementação

- **Performance**: Mensagens de grupos são filtradas no ponto mais inicial, evitando processamento desnecessário
- **Logs Limpos**: Não gera logs para mensagens de grupos
- **Economia de Recursos**: Não consome recursos do banco de dados ou memória
- **Zero Impacto**: Mensagens são completamente ignoradas, como se nunca tivessem chegado
- **Sempre Ativo**: Não há possibilidade de habilitar mensagens de grupos acidentalmente

### Identificação de Grupos

Mensagens de grupos são identificadas pelo padrão:
```javascript
const isGroup = msg.key?.remoteJid?.endsWith("@g.us");
```

Status broadcasts (`@broadcast`) também são sempre ignorados.

### Fluxo de Execução

1. Mensagem chega via WebSocket
2. Verifica se é mensagem de grupo (`@g.us`) ou status (`@broadcast`)
3. Se for grupo ou status: **IGNORA COMPLETAMENTE**
4. Se não for grupo: processa normalmente

## Código Exemplo

```javascript
// Exemplo da filtragem em StartWhatsAppSession.ts
for (const msg of messages) {
  // Sempre ignorar mensagens de grupos
  const isGroup = msg.key?.remoteJid?.endsWith("@g.us");
  
  // Se é mensagem de grupo, pula completamente
  if (isGroup) {
    continue; // Não processa, não loga, ignora totalmente
  }

  await HandleBaileysMessage(msg, wbot);
}
```

## Observações Importantes

- **Não há configuração**: A funcionalidade está sempre ativa
- **Não há interface**: Não existe mais botão para habilitar/desabilitar
- **Mudanças futuras**: Para habilitar grupos, seria necessário modificar o código
- **Status também ignorados**: Mensagens de status (@broadcast) também são sempre ignoradas
- **Performance otimizada**: Filtragem acontece antes de qualquer processamento pesado 