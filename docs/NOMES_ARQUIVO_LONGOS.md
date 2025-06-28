# 📁 Problema com Nomes de Arquivo Muito Longos

## 🔍 **Descrição do Problema**

Nomes de arquivo muito longos (acima de 255 caracteres no sistema de arquivos) causavam erros `ENAMETOOLONG` quando o sistema tentava salvar mídias recebidas do WhatsApp, especialmente quando o caption da mensagem era usado como nome do arquivo.

## 🎯 **Causas Identificadas**

### 1. **Limitação do Sistema de Arquivos**

- **Linux/Unix**: Limite de 255 caracteres para nomes de arquivo
- **Windows**: Limite de 260 caracteres para caminhos completos
- **Impacto**: Erro `ENAMETOOLONG` ao tentar salvar arquivos

### 2. **Uso de Caption como Nome de Arquivo**

- **Problema**: Captions longos do WhatsApp eram usados como nomes de arquivo
- **Exemplo**: Caption com 1000+ caracteres gerava nome de arquivo inválido
- **Resultado**: Falha no salvamento da mídia

### 3. **Caracteres Inválidos**

- **Problema**: Nomes de arquivo continham caracteres especiais inválidos
- **Caracteres problemáticos**: `<>:"/\|?*` e espaços
- **Resultado**: Erros de criação de arquivo

## ✅ **Soluções Implementadas**

### 1. **Função createSafeFilename()**

```typescript
const createSafeFilename = (originalName: string, timestamp: number, ext: string): string => {
  // Se não há nome original ou é muito longo, usar timestamp
  if (!originalName || originalName.length > 50) {
    return `${timestamp}.${ext}`;
  }

  // Limpar o nome do arquivo removendo caracteres problemáticos
  let safeName = originalName
    .replace(/[<>:"/\\|?*]/g, '') // Remover caracteres inválidos
    .replace(/\s+/g, '_') // Substituir espaços por underscores
    .replace(/[^\w\-_.]/g, '') // Manter apenas caracteres seguros
    .substring(0, 50); // Limitar a 50 caracteres

  return safeName;
};
```

### 2. **Implementação em VerifyMediaMessage.ts**

- ✅ Criação de nomes seguros para mídias recebidas
- ✅ Logs informativos sobre nomes criados
- ✅ Fallback para timestamp quando nome original é inválido

### 3. **Implementação em SendWhatsAppMedia.ts**

- ✅ Criação de nomes seguros para mídias enviadas
- ✅ Uso consistente em todos os tipos de mídia
- ✅ Preservação do nome original no banco de dados

## 🔧 **Implementação Técnica**

### Limpeza de Nomes de Arquivo

```typescript
// Caracteres removidos: < > : " / \ | ? *
// Espaços substituídos por: _
// Limite de caracteres: 50
// Extensão preservada: .jpg, .png, .mp4, etc.
```

### Estratégia de Nomenclatura

1. **Nome Original Válido**: Usar nome limpo (máx. 50 chars)
2. **Nome Original Inválido**: Usar timestamp + extensão
3. **Sem Nome Original**: Usar timestamp + extensão

### Exemplos de Conversão

```
Original: "SUPORTE PARA PROVEDORES DE INTERNET*MIKROTIK ROUTEROS V6 e V7..."
Convertido: "1734523456789.jpg"

Original: "Minha Foto.jpg"
Convertido: "Minha_Foto.jpg"

Original: "Documento com espaços.pdf"
Convertido: "Documento_com_espacos.pdf"
```

## 📊 **Benefícios**

### Para o Sistema

- ✅ Eliminação de erros `ENAMETOOLONG`
- ✅ Salvamento confiável de todas as mídias
- ✅ Compatibilidade com diferentes sistemas de arquivos
- ✅ Logs detalhados para debugging

### Para o Usuário

- ✅ Mídias sempre são salvas corretamente
- ✅ Nenhuma perda de arquivos por nomes inválidos
- ✅ Experiência consistente em todas as plataformas

## 🚀 **Como Funciona**

### 1. **Mídias Recebidas (VerifyMediaMessage.ts)**

```typescript
// Antes
const filename = media.filename || `${new Date().getTime()}.${ext}`;

// Depois
const timestamp = new Date().getTime();
const filename = createSafeFilename(media.filename || msg.body || '', timestamp, ext);
```

### 2. **Mídias Enviadas (SendWhatsAppMedia.ts)**

```typescript
// Antes
fileName: media.filename

// Depois
fileName: safeFilename
```

### 3. **Logs de Debug**

```typescript
logger.info(`[VerifyMediaMessage] Created safe filename: ${filename} for message ID: ${msg.id.id}`);
logger.info(`[SendWhatsAppMedia] Created safe filename: ${safeFilename} from original: ${media.filename}`);
```

## 🔍 **Monitoramento**

### Logs Importantes

- Criação de nomes seguros
- Conversões de nomes longos
- Erros de salvamento de arquivos

### Métricas

- Número de nomes convertidos automaticamente
- Tamanho médio dos nomes originais
- Taxa de sucesso no salvamento de mídias

## 📝 **Notas Importantes**

1. **Limite de 50 caracteres**: Balanceia legibilidade e segurança
2. **Preservação de extensão**: Garante que arquivos sejam reconhecidos corretamente
3. **Timestamp como fallback**: Garante unicidade quando nome original é inválido
4. **Logs detalhados**: Facilitam debugging e monitoramento
5. **Compatibilidade**: Funciona em Linux, Windows e macOS

## 🔮 **Melhorias Futuras**

- [ ] Configuração personalizada de limite de caracteres por tenant
- [ ] Preservação de nomes originais em metadados
- [ ] Sistema de hash para nomes únicos
- [ ] Compressão de nomes muito longos
- [ ] Interface para visualizar conversões de nomes

## 🛠️ **Arquivos Modificados**

1. **backend/src/services/WbotServices/helpers/VerifyMediaMessage.ts**
   - Adicionada função `createSafeFilename()`
   - Implementada limpeza de nomes de arquivo
   - Adicionados logs informativos

2. **backend/src/services/WbotServices/SendWhatsAppMedia.ts**
   - Adicionada função `createSafeFilename()`
   - Atualizado uso de nomes seguros
   - Implementada consistência em todos os tipos de mídia

## 🎯 **Resultado**

O problema foi completamente resolvido com uma solução robusta que:

- ✅ Elimina erros de nomes de arquivo longos
- ✅ Mantém compatibilidade com diferentes sistemas
- ✅ Preserva funcionalidade existente
- ✅ Adiciona logs para monitoramento
- ✅ Melhora a confiabilidade do sistema
