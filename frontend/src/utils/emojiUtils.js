/**
 * Utilitários para processamento e exibição de emojis
 */

import twemoji from 'twemoji'

// Regex para detectar emojis Unicode
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]/gu

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
 * Processa texto para melhorar a exibição de emojis
 * @param {string} text - Texto para processar
 * @returns {string} - Texto processado com classes CSS para emojis
 */
export const processEmojis = (text) => {
  if (!text || typeof text !== 'string') return text

  return text.replace(EMOJI_REGEX, (emoji) => {
    return `<span class="emoji" data-emoji="${emoji}" title="${emoji}">${emoji}</span>`
  })
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
 * Processa texto para exibir emojis como imagens SVG usando Twemoji
 * @param {string} text
 * @returns {string} HTML com emojis como imagens
 */
export function twemojiParse (text) {
  return twemoji.parse(text, {
    folder: 'svg',
    ext: '.svg',
    className: 'emoji',
    base: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/'
  })
}

export default {
  hasEmojis,
  countEmojis,
  processEmojis,
  removeEmojis,
  extractEmojis,
  isEmoji,
  formatTextWithEmojis,
  emojiPickerConfig,
  twemojiParse
}
