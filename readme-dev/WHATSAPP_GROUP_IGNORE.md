# Ignorar Mensagens de Grupos Completamente

## Descrição
Esta funcionalidade permite ignorar totalmente mensagens de grupos do WhatsApp, incluindo:
- Não processar as mensagens
- Não gerar logs
- Não criar tickets
- Não armazenar no banco de dados
- Não processar ACKs (confirmações de leitura/entrega)

## Configuração

### Backend
A configuração é controlada pela setting `ignoreGroupMsg` no banco de dados:
- **Chave**: `ignoreGroupMsg`
- **Valor**: `enabled` (para ignorar) ou `disabled` (para processar normalmente)

### Frontend
A configuração pode ser alterada em:
- **Página**: Configurações
- **Seção**: "Ignorar Mensagens de Grupo"
- **Descrição**: "Habilitando esta opção o sistema não abrirá ticket para grupos"

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
- **Logs Limpos**: Não gera logs para mensagens de grupos quando a opção está habilitada
- **Economia de Recursos**: Não consome recursos do banco de dados ou memória
- **Zero Impacto**: Mensagens são completamente ignoradas, como se nunca tivessem chegado

### Identificação de Grupos

Mensagens de grupos são identificadas pelo padrão:
```javascript
const isGroup = msg.key?.remoteJid?.endsWith("@g.us");
```

### Fluxo de Execução

1. Mensagem chega via WebSocket
2. Verifica se `ignoreGroupMsg` está habilitado
3. Se habilitado e for mensagem de grupo: **IGNORA COMPLETAMENTE**
4. Se não for grupo ou configuração desabilitada: processa normalmente

## Uso

Para habilitar via SQL:
```sql
UPDATE "Settings" 
SET value = 'enabled' 
WHERE key = 'ignoreGroupMsg' AND "tenantId" = YOUR_TENANT_ID;
```

Para desabilitar via SQL:
```sql
UPDATE "Settings" 
SET value = 'disabled' 
WHERE key = 'ignoreGroupMsg' AND "tenantId" = YOUR_TENANT_ID;
```

## Observações

- A configuração é por tenant (empresa)
- Mudanças na configuração têm efeito imediato
- Não afeta mensagens já processadas
- Status de grupos (`@broadcast`) também são ignorados quando habilitado 