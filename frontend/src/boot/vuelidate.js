import { boot } from 'quasar/wrappers'
import { createVuelidate } from '@vuelidate/core'

import linkify from 'vue-linkify'

/* We need messages for validation */
const messages = {
  required: '{attribute} é obrigatório',
  email: '{attribute} é inválido.',
  minValue: '{attribute} deve ser maior que {min}',
  minLength: '{attribute} deve possui no mínimo {min} carateres',
  maxLength: '{attribute} deve possui no máximo {min} carateres',
  validaData: 'Data inválida'
}

const mapNames = {
  email: 'E-mail',
  name: 'Nome',
  nome: 'Nome',
  username: 'Usuário'
}

export default boot(({ app }) => {
  app.directive('linkified', linkify)
  
  // Vuelidate 2.0 para Vue 3 não precisa ser registrado globalmente
  // Usar useVuelidate() diretamente nos componentes
  app.config.globalProperties.$vuelidateMessages = messages
  app.config.globalProperties.$vuelidateMapNames = mapNames
})
