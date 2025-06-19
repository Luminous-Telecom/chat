# 🎨 Emoji Picker com Tema Escuro

## 📋 Visão Geral

Este documento descreve a implementação do tema escuro para os emoji pickers em todo o sistema. O projeto utiliza **dois tipos diferentes** de emoji pickers, ambos configurados para suportar tema escuro automaticamente.

## 🔧 Tipos de Emoji Picker

### 1. emoji-picker-element
- **Componente**: `<emoji-picker>`
- **Wrapper**: `EmojiPickerWrapper.vue`
- **Uso**: Modais, formulários, chat flow builder

### 2. emoji-mart-vue
- **Componente**: `<Picker>`
- **Configuração**: Via prop `:theme`
- **Uso**: Input de mensagem principal, ações de etapa

## 🚀 Implementação

### Componente Wrapper (emoji-picker-element)

Foi criado um componente wrapper (`EmojiPickerWrapper.vue`) que:

- ✅ Detecta automaticamente o tema atual (`$q.dark.isActive`)
- ✅ Aplica as configurações de tema escuro/claro automaticamente
- ✅ Mantém a API consistente com o componente original
- ✅ Inclui estilos otimizados para ambos os temas
- ✅ **Usa MutationObserver para detectar mudanças no DOM**
- ✅ **Aplica estilos via JavaScript para garantir compatibilidade**
- ✅ **Inclui debug logs para troubleshooting**

### Configuração Direta (emoji-mart-vue)

O emoji-mart-vue é configurado diretamente via prop:

```vue
<Picker
  :theme="$q.dark.isActive ? 'dark' : 'light'"
  :key="pickerTheme"
  :locale="'pt'"
  :previewPosition="'none'"
  :perLine="9"
  :showPreview="false"
  :showSkinTones="true"
  :showCategoryButtons="false"
  :showSearch="true"
  style="width: 420px"
  @emoji-select="onEmojiSelectMart"
/>
```

**Nota**: `:showCategoryButtons="false"` oculta os filtros de categoria no topo, deixando apenas os emojis organizados em categorias.

## 🎨 Configurações CSS

### Remoção dos Filtros de Categoria

Para uma interface mais limpa, os filtros de categoria no topo dos emoji pickers foram removidos:

#### emoji-picker-element
```scss
// Ocultar filtros de categoria
emoji-picker .category-tabs,
emoji-picker .tabs,
emoji-picker [role="tablist"],
emoji-picker .category-nav
  display: none !important

// Ocultar títulos das categorias
emoji-picker .category-label,
emoji-picker .category-label span,
emoji-picker [data-v-376cda0e]
  display: none !important
```

#### emoji-mart-vue
```scss
// Ocultar filtros de categoria
.emoji-mart .emoji-mart-category-tabs,
.emoji-mart .emoji-mart-tabs
  display: none !important

// Ocultar títulos das categorias
.emoji-mart .emoji-mart-category-label,
.emoji-mart .emoji-mart-category-label span
  display: none !important

// Via prop
:showCategoryButtons="false"
```

**Resultado**: Interface completamente limpa com apenas os emojis organizados em categorias, sem filtros no topo e sem títulos de categoria.

### Remoção dos Títulos de Categoria

Além dos filtros, os títulos das categorias (como "Smileys & People", "Animals & Nature", etc.) também foram removidos:

#### Implementação JavaScript
```javascript
// Ocultar títulos das categorias
const categoryLabels = picker.querySelectorAll('.category-label, .emoji-mart-category-label, [data-v-376cda0e]')
categoryLabels.forEach(label => {
  label.style.display = 'none'
})

// Ocultar spans dentro dos títulos
const categoryLabelSpans = picker.querySelectorAll('.category-label span, .emoji-mart-category-label span')
categoryLabelSpans.forEach(span => {
  span.style.display = 'none'
})
```

#### Implementação CSS
```scss
// Ocultar títulos das categorias
.emoji-mart .emoji-mart-category-label,
.emoji-mart .emoji-mart-category-label span,
emoji-picker .category-label,
emoji-picker .category-label span,
emoji-picker [data-v-376cda0e]
  display: none !important
```

**Resultado Final**: Interface ultra-limpa com apenas emojis, sem qualquer texto ou botão de navegação.

### emoji-picker-element

#### Tema Claro (Padrão)
```scss
--background: #ffffff
--border-color: #e2e8f0
--text-color: #2d3748
--search-background: #f7fafc
--indicator-color: #1976d2
```

#### Tema Escuro
```scss
--background: #2d3748
--border-color: #4a5568
--text-color: #e2e8f0
--search-background: #1a202c
--indicator-color: #90caf9
```

### emoji-mart-vue

#### Tema Claro (Padrão)
```scss
.emoji-mart {
  background: #ffffff;
  color: #2d3748;
  border-color: #e2e8f0;
}
```

#### Tema Escuro
```scss
.body--dark .emoji-mart {
  background: #2d3748;
  color: #e2e8f0;
  border-color: #4a5568;
}
```

## 📁 Componentes Atualizados

### Usando emoji-picker-element (EmojiPickerWrapper)
- ✅ `ModalMensagemRapida.vue`
- ✅ `ModalEtapaAutoResposta.vue`
- ✅ `ModalCampanha.vue`
- ✅ `messageField.vue`
- ✅ `messageOptionsField.vue`
- ✅ `node_form.vue`
- ✅ `Index.vue` (Horário de Atendimento)

### Usando emoji-mart-vue (configuração direta)
- ✅ `InputMensagem.vue` - Usa `:theme="$q.dark.isActive ? 'dark' : 'light'"`
- ✅ `ModalAcaoEtapa.vue` - Usa `:theme="$q.dark.isActive ? 'dark' : 'light'"`

## 🚀 Como Usar

### emoji-picker-element (Recomendado para novos componentes)

```vue
<template>
  <q-menu anchor="top right" self="bottom middle" :offset="[5, 40]">
    <EmojiPickerWrapper @emoji-click="onEmojiSelect" />
  </q-menu>
</template>

<script>
import EmojiPickerWrapper from 'src/components/EmojiPickerWrapper.vue'

export default {
  components: {
    EmojiPickerWrapper
  },
  methods: {
    onEmojiSelect(event) {
      const emoji = event.detail?.unicode || event.detail?.emoji
      // Processar o emoji...
    }
  }
}
</script>
```

### emoji-mart-vue (Para componentes existentes)

```vue
<template>
  <Picker
    :theme="$q.dark.isActive ? 'dark' : 'light'"
    :key="pickerTheme"
    @emoji-select="onEmojiSelect"
  />
</template>

<script>
import { Picker } from 'emoji-mart-vue'
import 'emoji-mart-vue/css/emoji-mart.css'

export default {
  components: {
    Picker
  },
  computed: {
    pickerTheme() {
      return this.$q.dark.isActive ? 'dark' : 'light'
    }
  },
  methods: {
    onEmojiSelect(emoji) {
      // emoji.native contém o caractere emoji
      console.log(emoji.native)
    }
  }
}
</script>
```

## 🧪 Componente de Teste

Foi criado um componente de teste (`EmojiPickerTest.vue`) para verificar se ambos os tipos estão funcionando:

```vue
<template>
  <div class="emoji-picker-test">
    <h3>Teste dos Emoji Pickers</h3>
    <p>Tema atual: {{ $q.dark.isActive ? 'ESCURO' : 'CLARO' }}</p>
    <q-btn @click="toggleTheme" :label="$q.dark.isActive ? 'Mudar para Claro' : 'Mudar para Escuro'" />
    
    <div class="test-container">
      <h4>emoji-picker-element:</h4>
      <EmojiPickerWrapper @emoji-click="onEmojiSelect" />
    </div>
    
    <div class="test-container">
      <h4>emoji-mart-vue:</h4>
      <Picker
        :theme="$q.dark.isActive ? 'dark' : 'light'"
        @emoji-select="onEmojiSelectMart"
      />
    </div>
  </div>
</template>
```

## 🎨 Características Visuais

### Tema Claro
- Fundo branco (#ffffff)
- Bordas suaves (#e2e8f0)
- Texto escuro (#2d3748)
- Sombra sutil
- Indicador azul (#1976d2)

### Tema Escuro
- Fundo cinza escuro (#2d3748)
- Bordas médias (#4a5568)
- Texto claro (#e2e8f0)
- Sombra mais pronunciada
- Indicador azul claro (#90caf9)

## 🔄 Detecção Automática

### emoji-picker-element
```javascript
updateTheme() {
  this.isDarkMode = this.$q.dark.isActive
  
  if (this.$refs.emojiPicker) {
    const picker = this.$refs.emojiPicker
    
    if (this.isDarkMode) {
      picker.style.setProperty('--background', '#2d3748')
      // ... outras propriedades
    } else {
      picker.style.setProperty('--background', '#ffffff')
      // ... outras propriedades
    }
  }
}
```

### emoji-mart-vue
```vue
<Picker :theme="$q.dark.isActive ? 'dark' : 'light'" />
```

## 🛠️ Manutenção

### Adicionar Novos Componentes

**Para emoji-picker-element (Recomendado):**
```javascript
import EmojiPickerWrapper from 'src/components/EmojiPickerWrapper.vue'
```

**Para emoji-mart-vue:**
```javascript
import { Picker } from 'emoji-mart-vue'
import 'emoji-mart-vue/css/emoji-mart.css'
```

### Personalizar Estilos

**emoji-picker-element:**
```
frontend/src/components/EmojiPickerWrapper.vue
```

**emoji-mart-vue:**
```
frontend/src/css/app.sass
```

## 🐛 Troubleshooting

### Problemas Comuns

1. **Tema não muda**: Verifique se `$q.dark.isActive` está funcionando
2. **Estilos não aplicados**: Verifique o console para logs de debug
3. **Conflito entre pickers**: Certifique-se de usar o tipo correto para cada componente

### Debug

O componente emoji-picker-element inclui logs de debug:
```
EmojiPickerWrapper - Tema atual: CLARO
EmojiPickerWrapper - Mudança de tema: ESCURO
```

## 🎯 Benefícios

### Para Usuários
- ✅ Experiência visual consistente
- ✅ Tema escuro confortável para os olhos
- ✅ Transições suaves entre temas
- ✅ Interface moderna e profissional

### Para Desenvolvedores
- ✅ API consistente
- ✅ Fácil manutenção
- ✅ Configuração automática
- ✅ Reutilização de código
- ✅ **Suporte a dois tipos de picker**
- ✅ **Debug logs para troubleshooting**

## 📝 Notas Técnicas

### Dependências
- `emoji-picker-element`: Para o wrapper
- `emoji-mart-vue`: Para componentes específicos
- `quasar`: Para detecção de tema
- `vue`: Framework base

### Compatibilidade
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge

### Performance
- Estilos aplicados via CSS custom properties
- Detecção de tema via classe CSS
- **MutationObserver para mudanças dinâmicas**
- **JavaScript para aplicação forçada de estilos**

### Arquivos Modificados
- `frontend/src/components/EmojiPickerWrapper.vue` - Wrapper principal
- `frontend/src/css/app.sass` - Estilos globais para ambos os tipos
- `frontend/src/components/EmojiPickerTest.vue` - Componente de teste
- Vários componentes que usam emoji pickers 