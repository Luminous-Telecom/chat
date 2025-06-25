import { format, parseISO, parseJSON } from 'date-fns'
import pt from 'date-fns/locale/pt-BR'
import { processEmojis } from 'src/utils/emojiUtils'

export default {
  computed: {
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
    dataInWords (date) {
      if (!date) return ''
      try {
        const parsedDate = parseJSON(date)
        if (isNaN(parsedDate.getTime())) {
          return ''
        }
        return format(parsedDate, 'HH:mm', { locale: pt })
      } catch (error) {
        // Erro ao formatar data
        return ''
      }
    },
    formatarMensagemWhatsapp (body) {
      if (!body) return ''

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

      // Aplicar estilos do WhatsApp
      format = whatsappStyles(format, '_', '<i>', '</i>')
      format = whatsappStyles(format, '*', '<b>', '</b>')
      format = whatsappStyles(format, '~', '<s>', '</s>')

      // Processar quebras de linha
      format = format.replace(/\n/gi, '<br>')

      // Processar emojis convertendo para SVG usando Twemoji
      format = processEmojis(format)

      return format
    },
    formatarData (data, formato = 'dd/MM/yyyy') {
      if (!data) return ''

      try {
        // Tentar múltiplos métodos de parsing
        let parsedDate

        // Primeiro, tentar parseJSON
        try {
          parsedDate = parseJSON(data)
          if (!isNaN(parsedDate.getTime())) {
            return format(parsedDate, formato, { locale: pt })
          }
        } catch (e) {
          // Continue para próxima tentativa
        }

        // Se falhar, tentar parseISO
        try {
          parsedDate = parseISO(data)
          if (!isNaN(parsedDate.getTime())) {
            return format(parsedDate, formato, { locale: pt })
          }
        } catch (e) {
          // Continue para próxima tentativa
        }

        // Se falhar, tentar new Date
        try {
          parsedDate = new Date(data)
          if (!isNaN(parsedDate.getTime())) {
            return format(parsedDate, formato, { locale: pt })
          }
        } catch (e) {
          console.error('[formatarData] Erro ao fazer parse da data:', data, e)
        }

        return ''
      } catch (error) {
        console.error('[formatarData] Erro geral ao formatar data:', data, error)
        return ''
      }
    }
  }
}
