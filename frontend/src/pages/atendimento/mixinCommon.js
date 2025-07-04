import { format, parseJSON } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { processAllEmojisWithAppleEmoji } from 'src/utils/emojiUtils'

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
        this.$eventBus.emit('scrollToBottomMessageChat')
      }, 200)
    },
    dataInWords (date) {
      if (!date) return ''
      try {
        const parsedDate = parseJSON(date)
        if (isNaN(parsedDate.getTime())) {
          return ''
        }
        return format(parsedDate, 'HH:mm', { locale: ptBR })
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

      // Substituir todos os emojis por imagens Apple Emoji
      format = processAllEmojisWithAppleEmoji(format)

      return format
    },
    formatarData (data, formato = 'dd/MM/yyyy') {
      if (!data) return ''

      try {
        // Otimização: parseJSON é o mais eficiente para dados do backend
        const parsedDate = parseJSON(data)
        return format(parsedDate, formato, { locale: ptBR })
      } catch (error) {
        // Fallback apenas se parseJSON falhar
        try {
          const fallbackDate = new Date(data)
          if (!isNaN(fallbackDate.getTime())) {
            return format(fallbackDate, formato, { locale: ptBR })
          }
        } catch (e) {
          console.warn('[formatarData] Erro ao formatar data:', data)
        }
        return ''
      }
    }
  }
}
