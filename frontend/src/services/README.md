# Serviço de Notificações de Áudio

Este serviço centraliza todas as funcionalidades relacionadas a notificações de áudio no sistema.

## Arquivos

- `audioNotificationService.js` - Serviço principal de notificações de áudio
- `helpersNotifications.js` - Helpers para facilitar o uso do serviço

## Como usar

### Importação básica

```javascript
import { tocarSomNotificacao } from 'src/helpers/helpersNotifications'
```

### Funções disponíveis

#### `tocarSomNotificacao()`

Toca o som de notificação padrão.

```javascript
await tocarSomNotificacao()
```

#### `tocarSomNotificacaoComVolume(volume)`

Toca o som de notificação com volume personalizado (0.0 a 1.0).

```javascript
await tocarSomNotificacaoComVolume(0.5) // 50% do volume
```

#### `pararSomNotificacao()`

Para o som de notificação em reprodução.

```javascript
pararSomNotificacao()
```

#### `solicitarPermissaoAudio()`

Solicita permissão para reproduzir áudio.

```javascript
const temPermissao = await solicitarPermissaoAudio()
```

#### `temPermissaoAudio()`

Verifica se tem permissão para reproduzir áudio.

```javascript
const temPermissao = temPermissaoAudio()
```

#### `definirVolumeNotificacao(volume)`

Define o volume padrão para notificações (0.0 a 1.0).

```javascript
definirVolumeNotificacao(0.8) // 80% do volume
```

#### `definirIntervaloMinimoNotificacao(interval)`

Define o intervalo mínimo entre notificações em milissegundos.

```javascript
definirIntervaloMinimoNotificacao(1000) // 1 segundo
```

#### `inicializarServicoAudio()`

Inicializa o serviço de áudio.

```javascript
inicializarServicoAudio()
```

#### `destruirServicoAudio()`

Destrói o serviço de áudio e limpa recursos.

```javascript
destruirServicoAudio()
```

## Exemplo de uso em um componente Vue

```javascript
import { 
  tocarSomNotificacao, 
  solicitarPermissaoAudio, 
  inicializarServicoAudio 
} from 'src/helpers/helpersNotifications'

export default {
  async mounted() {
    // Inicializar o serviço
    inicializarServicoAudio()
    
    // Solicitar permissão no primeiro clique
    document.addEventListener('click', async () => {
      await solicitarPermissaoAudio()
    }, { once: true })
  },
  
  methods: {
    async handleNovaMensagem() {
      // Tocar som de notificação
      await tocarSomNotificacao()
    }
  }
}
```

## Características

- **Singleton**: Uma única instância do serviço é compartilhada em toda a aplicação
- **Throttle**: Evita spam de notificações com intervalo mínimo configurável
- **Permissões**: Gerencia automaticamente as permissões de áudio do navegador
- **Volume**: Permite controle de volume personalizado
- **Fallback**: Tratamento de erros e fallbacks para navegadores antigos
- **Limpeza**: Método para destruir o serviço e limpar recursos

## Migração

Para migrar componentes existentes:

1. Remover elementos `<audio>` inline
2. Remover propriedades relacionadas ao áudio do `data()`
3. Remover métodos de áudio locais
4. Importar e usar as funções do `helpersNotifications.js`
5. Inicializar o serviço no `mounted()`
