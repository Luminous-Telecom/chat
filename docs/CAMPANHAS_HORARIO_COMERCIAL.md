# Campanhas em Horário Comercial

Esta funcionalidade permite configurar campanhas para serem enviadas apenas durante os horários comerciais e dias úteis configurados no sistema.

## Como funciona

### Configuração da Campanha

1. **Criar/Editar Campanha**: No modal de campanha, você encontrará uma nova opção:
   - ☑️ **"Enviar apenas em horário comercial e dias úteis"**

2. **Comportamentos**:
   - **Ativado**: As mensagens respeitam rigorosamente os horários comerciais configurados
   - **Desativado**: As mensagens seguem o horário padrão (08:00-20:00)

### Configuração de Horários Comerciais

Os horários comerciais são configurados em **Configurações > Horário de Atendimento**, onde você define:

- **Dias da semana**: Cada dia pode ser configurado como:
  - **Aberto**: Funcionamento 24h
  - **Fechado**: Não há atendimento
  - **Horário**: Períodos específicos (ex: 08:00-12:00 e 14:00-18:00)

### Comportamento do Sistema

#### Quando a opção está ATIVADA

- ✅ Mensagens são enviadas apenas nos horários configurados
- ⏰ Mensagens fora do horário são automaticamente reagendadas
- 📅 Dias fechados são ignorados, mensagens vão para o próximo dia útil
- 🔄 O sistema ajusta automaticamente os horários de envio

#### Quando a opção está DESATIVADA

- 🕐 **Sem restrições**: Mensagens são enviadas exatamente no horário agendado
- 📤 **24/7**: Funciona 24 horas por dia, 7 dias por semana
- ⚡ **Máxima flexibilidade**: Você pode agendar para qualquer horário

### Exemplos Práticos

**Exemplo 1**: Campanha agendada para 23:35 de uma segunda-feira

- **Com horário comercial**: Reagendada para 08:00 da terça-feira (próximo horário válido)
- **Sem horário comercial**: Enviada exatamente às 23:35 da segunda-feira

**Exemplo 2**: Campanha agendada para 14:00 de um sábado (configurado como fechado)

- **Com horário comercial**: Reagendada para 08:00 da segunda-feira
- **Sem horário comercial**: Enviada às 14:00 do sábado normalmente

**Exemplo 3**: Campanha agendada para 13:00 (horário de almoço: 12:00-14:00 fechado)

- **Com horário comercial**: Reagendada para 14:00 (próximo período válido)
- **Sem horário comercial**: Enviada às 13:00 normalmente (ignora configuração de horário comercial)

### Interface Visual

#### Lista de Campanhas

- Nova coluna **"Horário Comercial"** mostra:
  - 🕐 **Sim**: Campanha configurada para horário comercial
  - 🕐 **Não**: Campanha usa horário padrão

#### Modal de Campanha

- Checkbox com tooltip explicativo
- Mostra o comportamento esperado quando ativado/desativado

### Configuração Técnica

#### Backend

- Novo campo `businessHoursOnly` na tabela `Campaigns`
- Função `validateBusinessHours()` para validação de horários
- Ajuste automático de datas no `StartCampaignService`

#### Frontend

- Interface atualizada no modal de campanha
- Indicador visual na listagem
- Tooltips informativos

### Casos de Uso

1. **Empresas com horário restrito de atendimento**
   - Evita envio de mensagens fora do expediente
   - Melhora a experiência do cliente

2. **Campanhas promocionais**
   - Garante que promoções sejam enviadas em horários de maior engajamento
   - Respeita a política de comunicação da empresa

3. **Comunicações corporativas**
   - Mantém profissionalismo nos horários de envio
   - Evita incomodar clientes em horários inadequados

### Observações Importantes

- ⚠️ Campanhas já iniciadas não são afetadas por mudanças na configuração
- 🔄 O reagendamento é automático e transparente
- 📊 Os relatórios mostram os horários reais de envio (após ajustes)
- ⏱️ O delay entre mensagens é mantido, mas dentro dos horários válidos

### Troubleshooting

**Problema**: Mensagens não estão sendo enviadas

- Verifique se os horários comerciais estão configurados corretamente
- Confirme se há pelo menos um dia/horário válido configurado

**Problema**: Mensagens sendo enviadas fora do horário esperado

- Verifique se a opção "Enviar apenas em horário comercial" está ativada
- Confirme a configuração dos horários comerciais

**Problema**: Campanha não inicia

- Verifique se a data/hora de início não está no passado
- Confirme se há contatos vinculados à campanha

**Problema**: Campanhas não enviam no horário programado

- Execute o diagnóstico: `npm run campaign-diagnostics`
- Verifique se o Redis está funcionando
- Confirme se o processamento da fila está ativo
- Verifique logs do servidor para erros

### 🔧 Comando de Diagnóstico

Para diagnosticar problemas nas campanhas, execute:

```bash
cd backend
npm run campaign-diagnostics
```

Este comando irá verificar:

- ✅ Campanhas ativas no banco de dados
- ✅ Status da fila de jobs
- ✅ Conexão com Redis
- ✅ Jobs pendentes, agendados e falhados
- ✅ Processamento da fila

## Correções Implementadas

### ✅ Problema Resolvido: Horário Forçado para 8h

**Situação anterior**: Mesmo com a opção "Horário comercial" desmarcada, as campanhas eram forçadas para começar às 8:00.

**Solução implementada**:

- Corrigida a lógica no `UpdateCampaignService` que estava forçando todas as campanhas para 8h
- Agora, quando a opção está desmarcada, o sistema respeita **exatamente** o horário agendado
- A validação de horário comercial só é aplicada quando a opção está **ativada**

**Resultado**:

- ✅ Campanha às 23:35 → Enviada às 23:35 (opção desmarcada)
- ✅ Campanha às 15:30 → Enviada às 15:30 (opção desmarcada)
- ✅ Qualquer horário funciona quando a opção está desmarcada
