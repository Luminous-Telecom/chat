import { format, parseISO, parseJSON, isValid } from 'date-fns'
import pt from 'date-fns/locale/pt-BR'
import { mapGetters } from 'vuex'

export default {
  computed: {
    ...mapGetters(['mensagensTicket', 'ticketFocado', 'hasMore'])
  },
  data () {
    return {
      loading: false
    }
  },
  methods: {
    scrollToBottom () {
      setTimeout(() => {
        this.$root.$emit('scrollToBottomMessageChat')
      }, 200)
    },
    dataInWords (data) {
      if (!data) return 'N/A'
      try {
        let parsedDate
        if (typeof data === 'string') {
          // Tenta primeiro como ISO
          parsedDate = parseISO(data)
          if (!isValid(parsedDate)) {
            // Se não for ISO válido, tenta como JSON
            parsedDate = parseJSON(data)
          }
        } else if (typeof data === 'number') {
          // Se for timestamp
          parsedDate = new Date(data)
        } else if (data instanceof Date) {
          // Se já for Date
          parsedDate = data
        } else if (data && typeof data === 'object' && data.$date) {
          // Formato do MongoDB/Sequelize
          parsedDate = new Date(data.$date)
        } else {
          console.warn('Invalid date format in dataInWords:', data)
          return 'Data inválida'
        }

        if (!isValid(parsedDate)) {
          console.warn('Invalid date after parsing in dataInWords:', data)
          return 'Data inválida'
        }

        // Retorna apenas o horário no formato HH:mm
        return format(parsedDate, 'HH:mm', { locale: pt })
      } catch (err) {
        console.error('Error formatting date in dataInWords:', err, 'Date value:', data)
        return 'Erro ao formatar data'
      }
    },
    farmatarMensagemWhatsapp (body) {
      if (!body) return
      let format = body
      function is_aplhanumeric (c) {
        var x = c.charCodeAt()
        return !!(((x >= 65 && x <= 90) || (x >= 97 && x <= 122) || (x >= 48 && x <= 57)))
      }
      function whatsappStyles (format, wildcard, opTag, clTag) {
        var indices = []
        for (var i = 0; i < format.length; i++) {
          if (format[i] === wildcard) {
            // eslint-disable-next-line no-unused-expressions
            if (indices.length % 2) { (format[i - 1] == ' ') ? null : ((typeof (format[i + 1]) == 'undefined') ? indices.push(i) : (is_aplhanumeric(format[i + 1]) ? null : indices.push(i))) } else { (typeof (format[i + 1]) == 'undefined') ? null : ((format[i + 1] == ' ') ? null : (typeof (format[i - 1]) == 'undefined') ? indices.push(i) : ((is_aplhanumeric(format[i - 1])) ? null : indices.push(i))) }
          } else {
            // eslint-disable-next-line no-unused-expressions
            (format[i].charCodeAt() == 10 && indices.length % 2) ? indices.pop() : null
          }
        }
        // eslint-disable-next-line no-unused-expressions
        (indices.length % 2) ? indices.pop() : null
        var e = 0
        indices.forEach(function (v, i) {
          var t = (i % 2) ? clTag : opTag
          v += e
          format = format.substr(0, v) + t + format.substr(v + 1)
          e += (t.length - 1)
        })
        return format
      }
      format = whatsappStyles(format, '_', '<i>', '</i>')
      format = whatsappStyles(format, '*', '<b>', '</b>')
      format = whatsappStyles(format, '~', '<s>', '</s>')
      format = format.replace(/\n/gi, '<br>')
      return format
    },
    formatarData (data, formato = 'dd/MM/yyyy') {
      if (!data) return 'N/A'
      try {
        let parsedDate
        if (typeof data === 'string') {
          // Tenta primeiro como ISO
          parsedDate = parseISO(data)
          if (!isValid(parsedDate)) {
            // Se não for ISO válido, tenta como JSON
            parsedDate = parseJSON(data)
          }
        } else if (typeof data === 'number') {
          // Se for timestamp
          parsedDate = new Date(data)
        } else if (data instanceof Date) {
          // Se já for Date
          parsedDate = data
        } else if (data && typeof data === 'object' && data.$date) {
          // Formato do MongoDB/Sequelize
          parsedDate = new Date(data.$date)
        } else {
          console.warn('Invalid date format:', data)
          return 'Data inválida'
        }

        if (!isValid(parsedDate)) {
          console.warn('Invalid date after parsing:', data)
          return 'Data inválida'
        }

        return format(parsedDate, formato, { locale: pt })
      } catch (err) {
        console.error('Error formatting date:', err, 'Date value:', data)
        return 'Erro ao formatar data'
      }
    }
  }
}
