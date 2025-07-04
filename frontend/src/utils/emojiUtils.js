/**
 * Utilitários para processamento e exibição de emojis
 */

import countryFlagEmoji from 'country-flag-emoji'
import EmojiConvertor from 'emoji-js'

// Regex para detectar emojis Unicode
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]/gu

// Regex específica para bandeiras (Regional Indicator Symbols)
const FLAG_REGEX = /[\u{1F1E0}-\u{1F1FF}][\u{1F1E0}-\u{1F1FF}]/gu

// Instância global para performance
const emoji = new EmojiConvertor()
emoji.replace_mode = 'img'
emoji.img_set = 'apple'
emoji.img_sets.apple.path = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/'

/**
 * Detecta se uma string contém emojis
 * @param {string} text - Texto para verificar
 * @returns {boolean} - True se contém emojis
 */
export const hasEmojis = (text) => {
  if (!text || typeof text !== 'string') return false
  return EMOJI_REGEX.test(text)
}

/**
 * Conta quantos emojis há em uma string
 * @param {string} text - Texto para contar emojis
 * @returns {number} - Número de emojis encontrados
 */
export const countEmojis = (text) => {
  if (!text || typeof text !== 'string') return 0
  const matches = text.match(EMOJI_REGEX)
  return matches ? matches.length : 0
}

/**
 * Processa texto para melhorar a exibição de emojis convertendo para SVG
 * @param {string} text - Texto para processar
 * @returns {string} - Texto processado com emojis como SVG
 */
export const processEmojis = (text) => {
  if (!text || typeof text !== 'string') return text;
  return text;
}

/**
 * Remove emojis de uma string
 * @param {string} text - Texto para remover emojis
 * @returns {string} - Texto sem emojis
 */
export const removeEmojis = (text) => {
  if (!text || typeof text !== 'string') return text
  return text.replace(EMOJI_REGEX, '')
}

/**
 * Extrai apenas os emojis de uma string
 * @param {string} text - Texto para extrair emojis
 * @returns {string[]} - Array com os emojis encontrados
 */
export const extractEmojis = (text) => {
  if (!text || typeof text !== 'string') return []
  const matches = text.match(EMOJI_REGEX)
  return matches || []
}

/**
 * Verifica se um caractere é um emoji
 * @param {string} char - Caractere para verificar
 * @returns {boolean} - True se é um emoji
 */
export const isEmoji = (char) => {
  if (!char || typeof char !== 'string') return false
  return EMOJI_REGEX.test(char)
}

/**
 * Verifica se uma string contém bandeiras
 * @param {string} text - Texto para verificar
 * @returns {boolean} - True se contém bandeiras
 */
export const hasFlags = (text) => {
  if (!text || typeof text !== 'string') return false
  return FLAG_REGEX.test(text)
}

/**
 * Extrai apenas as bandeiras de uma string
 * @param {string} text - Texto para extrair bandeiras
 * @returns {string[]} - Array com as bandeiras encontradas
 */
export const extractFlags = (text) => {
  if (!text || typeof text !== 'string') return []
  const matches = text.match(FLAG_REGEX)
  return matches || []
}

/**
 * Formata texto para exibição segura com emojis
 * @param {string} text - Texto para formatar
 * @returns {string} - Texto formatado com emojis processados
 */
export const formatTextWithEmojis = (text) => {
  if (!text || typeof text !== 'string') return text

  // Primeiro processa quebras de linha
  let formatted = text.replace(/\n/g, '<br>')

  // Depois processa emojis
  formatted = processEmojis(formatted)

  return formatted
}

/**
 * Configurações para o VEmojiPicker
 */
export const emojiPickerConfig = {
  showSearch: false,
  emojisByRow: 20,
  labelSearch: 'Localizar...',
  lang: 'pt-BR',
  // Configurações adicionais para melhor compatibilidade
  emojiSize: '1.5em',
  emojiFont: "'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'Android Emoji', 'EmojiSymbols', 'EmojiOne Mozilla', 'Twemoji Mozilla', 'Segoe UI', sans-serif"
}

/**
 * Extrai o caractere emoji de diferentes estruturas de objeto do emoji-picker-element
 * @param {Object|string} emoji - Objeto emoji do emoji-picker-element ou string
 * @returns {string|null} - Caractere emoji ou null se não encontrado
 */
export const extractEmojiChar = (emoji) => {
  if (!emoji) return null

  // Se já é uma string, retorna diretamente
  if (typeof emoji === 'string') {
    return emoji
  }

  // Se é um objeto, tenta diferentes propriedades possíveis
  if (typeof emoji === 'object') {
    // Para vue3-emoji-picker, o emoji está na propriedade 'i'
    // Priorizar 'i' que é o que estamos vendo nos logs
    const possibleProps = [
      'i', // vue3-emoji-picker (prioridade)
      'unicode', // emoji-picker-element v1.26.3
      'emoji', // emoji-picker-element v1.26.3 (alternativo)
      'data', // VEmojiPicker v2.3.1
      'char', // VEmojiPicker v1.x
      'character', // VEmojiPicker v1.x
      'symbol', // VEmojiPicker v1.x
      'native' // VEmojiPicker v2.x
    ]

    for (const prop of possibleProps) {
      if (emoji[prop] && typeof emoji[prop] === 'string') {
        return emoji[prop]
      }
    }

    // Se não encontrou nas propriedades, tenta acessar diretamente
    // Para emoji-picker-element, o emoji pode estar no próprio objeto
    if (emoji.unicode) {
      return emoji.unicode
    }
    
    // Fallback para estruturas não reconhecidas
    console.debug('Estrutura de emoji não reconhecida:', emoji)
  }

  return null
}

/**
 * Insere emoji em um textarea na posição do cursor
 * @param {Object} emoji - Objeto emoji do VEmojiPicker
 * @param {HTMLElement} textarea - Elemento textarea
 * @param {Function} updateCallback - Função para atualizar o valor do campo
 * @param {string} currentValue - Valor atual do campo
 * @returns {boolean} - True se inserido com sucesso
 */
export const insertEmojiInTextarea = (emoji, textarea, updateCallback, currentValue = '') => {
  const emojiChar = extractEmojiChar(emoji)

  if (!emojiChar) {
    console.warn('Não foi possível extrair o emoji')
    return false
  }

  if (!textarea) {
    console.warn('Elemento textarea não encontrado')
    return false
  }

  // Obter posição do cursor
  const startPos = textarea.selectionStart
  const endPos = textarea.selectionEnd
  const cursorPos = startPos
  const tmpStr = textarea.value || currentValue

  // Inserir emoji
  const newValue = tmpStr.substring(0, startPos) + emojiChar + tmpStr.substring(endPos, tmpStr.length)

  // Atualizar valor
  if (updateCallback && typeof updateCallback === 'function') {
    updateCallback(newValue)
  }

  // Mover cursor
  setTimeout(() => {
    textarea.selectionStart = textarea.selectionEnd = cursorPos + emojiChar.length
    textarea.focus()
  }, 10)

  return true
}

/**
 * Testa a funcionalidade das bandeiras usando country-flag-emoji
 * @param {string} flagEmoji - Emoji de bandeira para testar
 * @returns {Object} - Resultado do teste
 */
export const testCountryFlag = (flagEmoji) => {
  try {
    // Procurar bandeira na lista do country-flag-emoji
    const flagData = countryFlagEmoji.list.find(country => country.emoji === flagEmoji)
    
    if (flagData) {
      // Teste de ida e volta usando o código do país
      const backToEmoji = countryFlagEmoji.get(flagData.code)
      
      return {
        originalEmoji: flagEmoji,
        countryCode: flagData.code,
        countryName: flagData.name,
        backToEmoji: backToEmoji ? backToEmoji.emoji : null,
        isValid: flagEmoji === (backToEmoji ? backToEmoji.emoji : null),
        allCountryEmojis: countryFlagEmoji.list.length
      }
    } else {
      return {
        originalEmoji: flagEmoji,
        error: 'Bandeira não encontrada na base de dados',
        isValid: false,
        allCountryEmojis: countryFlagEmoji.list.length
      }
    }
  } catch (error) {
    return {
      originalEmoji: flagEmoji,
      error: error.message,
      isValid: false,
      allCountryEmojis: 0
    }
  }
}

/**
 * Lista todas as bandeiras disponíveis no country-flag-emoji
 * @returns {Array} - Lista de bandeiras e códigos
 */
export const getAllCountryFlags = () => {
  try {
    return countryFlagEmoji.list.map(country => ({
      code: country.code,
      emoji: country.emoji,
      name: country.name,
      unicode: country.unicode
    }))
  } catch (error) {
    console.error('Erro ao obter bandeiras:', error)
    return []
  }
}

/**
 * Substitui emojis de bandeira por SVG usando country-flag-emoji
 * @param {string} text - Texto para processar
 * @param {object} [imgProps] - Propriedades extras para a tag <img> (opcional)
 * @returns {string} - Texto com bandeiras como SVG
 */
export const replaceFlagsWithSVG = (text, imgProps = {style: 'height: 1.2em; vertical-align: -0.2em;'}) => {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/([\u{1F1E6}-\u{1F1FF}]{2})/gu, (match) => {
    const flagData = countryFlagEmoji.list.find(country => country.emoji === match);
    if (flagData && flagData.code) {
      const code = flagData.code.toUpperCase();
      // Usando CDN jsdelivr para SVG das bandeiras
      const svgUrl = `https://cdn.jsdelivr.net/npm/country-flag-icons/3x2/${code}.svg`;
      const extra = Object.entries(imgProps).map(([k,v]) => `${k}='${v}'`).join(' ');
      return `<img src='${svgUrl}' alt='${code}' title='${flagData.name}' ${extra} />`;
    }
    return match;
  });
}

/**
 * Substitui automaticamente todos os emojis por imagens Apple Emoji
 * @param {string} text
 * @returns {string}
 */
export const processAllEmojisWithAppleEmoji = (text) => {
  if (!text || typeof text !== 'string') return text;
  return emoji.replace_unified(text);
}

export default {
  hasEmojis,
  countEmojis,
  processEmojis,
  removeEmojis,
  extractEmojis,
  isEmoji,
  hasFlags,
  extractFlags,
  formatTextWithEmojis,
  emojiPickerConfig,
  extractEmojiChar,
  insertEmojiInTextarea,
  testCountryFlag,
  getAllCountryFlags,
  replaceFlagsWithSVG,
  processAllEmojisWithAppleEmoji
}
