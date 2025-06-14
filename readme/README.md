# Guia de Correção de Erros de Linting

## Erros de Trailing Spaces

O erro "Trailing spaces not allowed" ocorre quando há espaços em branco no final das linhas. Este é um erro comum de linting que pode ser facilmente corrigido.

### Como Corrigir Automaticamente

Você pode usar um dos seguintes comandos para corrigir automaticamente os erros de trailing spaces:

#### Usando ESLint (Recomendado)
```bash
# Corrigir todos os arquivos
npm run lint -- --fix

# Ou especificamente para o arquivo Index.vue
npx eslint frontend/src/pages/atendimento/Index.vue --fix
```

#### Usando Prettier
```bash
# Corrigir todos os arquivos
npx prettier --write "frontend/src/**/*.{js,vue}"

# Ou especificamente para o arquivo Index.vue
npx prettier --write frontend/src/pages/atendimento/Index.vue
```

#### Usando sed (Linux/Mac)
```bash
# Remover trailing spaces de um arquivo específico
sed -i 's/[[:space:]]*$//' frontend/src/pages/atendimento/Index.vue

# Remover trailing spaces de todos os arquivos .vue
find frontend/src -name "*.vue" -exec sed -i 's/[[:space:]]*$//' {} \;
```

### Configuração do Editor

Para evitar este problema no futuro, você pode configurar seu editor para remover automaticamente trailing spaces:

#### VS Code
1. Abra as configurações (Ctrl+,)
2. Procure por "files.trimTrailingWhitespace"
3. Marque a opção para true

#### Sublime Text
1. Abra as configurações (Preferences > Settings)
2. Adicione: `"trim_trailing_white_space_on_save": true`

#### WebStorm/IntelliJ
1. Abra as configurações (Ctrl+Alt+S)
2. Editor > General > "Strip trailing spaces on Save"
3. Selecione "All"

### Regras do ESLint

Se você quiser desabilitar esta regra (não recomendado), você pode adicionar a seguinte configuração no seu `.eslintrc`:

```json
{
  "rules": {
    "no-trailing-spaces": "off"
  }
}
```

## Boas Práticas

1. Sempre use um linter no seu editor
2. Configure o editor para remover trailing spaces automaticamente
3. Execute o linter antes de fazer commit
4. Mantenha o código limpo e bem formatado

## Comandos Úteis

```bash
# Verificar erros de linting
npm run lint

# Corrigir erros automaticamente
npm run lint -- --fix

# Verificar um arquivo específico
npx eslint frontend/src/pages/atendimento/Index.vue

# Corrigir um arquivo específico
npx eslint frontend/src/pages/atendimento/Index.vue --fix
``` 