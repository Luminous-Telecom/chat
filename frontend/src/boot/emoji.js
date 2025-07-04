import { boot } from 'quasar/wrappers'
import countryFlagEmoji from 'country-flag-emoji'
import { testCountryFlag, getAllCountryFlags } from 'src/utils/emojiUtils'

// "async" é opcional;
// mais informações sobre boot files: https://v2.quasar.dev/quasar-cli-webpack/boot-files
export default boot(async (/* { app, router, ... } */) => {
  // Sistema de emoji SVG estilo WhatsApp carregado
  
  // Teste básico do country-flag-emoji
  try {
    // Verificar se o pacote foi carregado corretamente
    
    // Apenas um log resumido sobre o funcionamento
    const totalFlags = getAllCountryFlags().length
    
  } catch (error) {
    // Erro silencioso - não logar
  }
})
