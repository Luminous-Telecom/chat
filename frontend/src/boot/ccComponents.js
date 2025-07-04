import cInput from 'src/components/cInput'
import { notificarErro, notificarSucesso } from 'src/utils/helpersNotifications'
import { Dark, uid } from 'quasar'
import DatePick from 'src/components/cDatePick'
import cDateTimePick from 'src/components/cDateTimePick'

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { UpdateConfiguracoesUsuarios } from 'src/service/user'

const formatarValorMoeda = (num, black = false, intl = {}) => {
  const config = {
    language: 'pt-br',
    options: {
      // style: 'currency',
      // currency: 'BRL',
      // currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    }
  }
  const intlConfig = {
    ...config,
    ...intl
  }
  const valor = Intl.NumberFormat(intlConfig.language, intlConfig.options).format(num)
  if (black && num <= 0.0) {
    return ''
  }
  return valor
}

const arredodar = (num, places) => {
  if (!('' + num).includes('e')) {
    return +(Math.round(num + 'e+' + places) + 'e-' + places)
  } else {
    const arr = ('' + num).split('e')
    let sig = ''
    if (+arr[1] + places > 0) {
      sig = '+'
    }
    return +(
      Math.round(+arr[0] + 'e' + sig + (+arr[1] + places)) +
      'e-' +
      places
    )
  }
}

const iniciaisString = nomecompleto => {
  nomecompleto = nomecompleto.replace(/\s(de|da|dos|das)\s/g, ' ') // Remove os de,da, dos,das.
  const iniciais = nomecompleto.match(/\b(\w)/gi) // Iniciais de cada parte do nome.
  // var nome = nomecompleto.split(' ')[0].toLowerCase() // Primeiro nome.
  const sobrenomes = iniciais
    .splice(1, iniciais.length - 1)
    .join('')
    .toLowerCase() // Iniciais
  const iniciaisNome = iniciais + sobrenomes
  return iniciaisNome.toUpperCase()
}

const formatarData = (data, formato = 'dd/MM/yyyy') => {
      return format(parseISO(data), formato, { locale: ptBR })
}

const setConfigsUsuario = ({ isDark }) => {
  const filtroPadrao = {
    searchParam: '',
    pageNumber: 1,
    status: ['open', 'pending'],
    showAll: false,
    count: null,
    queuesIds: [],
    withUnreadMessages: false,
    isNotAssignedUser: false,
    includeNotQueueDefined: true
    // date: new Date(),
  }
  // this.isDark = !this.isDark
  Dark.set(isDark)
  const usuario = JSON.parse(localStorage.getItem('usuario'))
  const filtrosAtendimento = JSON.parse(localStorage.getItem('filtrosAtendimento')) || filtroPadrao
  const data = {
    filtrosAtendimento,
    isDark: Dark.isActive
  }
  UpdateConfiguracoesUsuarios(usuario.userId, data)
    .then(r => r)
    .catch(e => console.error)

  localStorage.setItem('usuario', JSON.stringify({ ...usuario, configs: data }))
}

import { boot } from 'quasar/wrappers'

export default boot(({ app }) => {
  app.component('cInput', cInput)
  app.component('DatePick', DatePick)
  app.component('cDateTimePick', cDateTimePick)
  
  // Adicionar propriedades globais
  app.config.globalProperties.$formatarValorMoeda = formatarValorMoeda
  app.config.globalProperties.$round = arredodar
  app.config.globalProperties.$formatarData = formatarData
  app.config.globalProperties.$iniciaisString = iniciaisString
  app.config.globalProperties.$notificarErro = notificarErro
  app.config.globalProperties.$notificarSucesso = notificarSucesso
  app.config.globalProperties.$setConfigsUsuario = setConfigsUsuario
  app.config.globalProperties.$uuid = uid
})
