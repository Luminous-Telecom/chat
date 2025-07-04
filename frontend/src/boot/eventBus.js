import { boot } from 'quasar/wrappers'
import eventBus from 'src/utils/eventBus'

export default boot(({ app }) => {
  // Disponibilizar o eventBus globalmente
  app.config.globalProperties.$eventBus = eventBus
  
  // Também adicionar no provide/inject para Composition API
  app.provide('$eventBus', eventBus)
}) 