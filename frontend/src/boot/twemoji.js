import { boot } from 'quasar/wrappers'
import twemoji from 'twemoji'

// "async" é opcional;
// mais informações sobre boot files: https://v2.quasar.dev/quasar-cli-webpack/boot-files
export default boot(async (/* { app, router, ... } */) => {
  // Disponibilizar Twemoji globalmente
  if (typeof window !== 'undefined') {
    window.twemoji = twemoji
  }
})
