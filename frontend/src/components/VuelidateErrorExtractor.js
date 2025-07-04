// Substituto simplificado para vuelidate-error-extractor
// Compatível com @vuelidate/core para Vue 3

export const singleErrorExtractorMixin = {
  props: {
    attribute: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    }
  },

  computed: {
    hasErrors() {
      return this.$v && this.$v.$error
    },

    firstError() {
      if (!this.$v || !this.$v.$error) return null
      
      // Obter o primeiro erro
      for (const key in this.$v) {
        if (key.startsWith('$')) continue
        const validator = this.$v[key]
        if (validator && validator.$invalid) {
          return {
            validator: key,
            message: this.getErrorMessage(key, validator)
          }
        }
      }
      return null
    },

    firstErrorMessage() {
      const error = this.firstError
      return error ? error.message : ''
    }
  },

  methods: {
    getErrorMessage(validator, validatorObj) {
      // Mensagens padrão em português
      const messages = {
        required: `${this.label || this.attribute} é obrigatório`,
        email: `${this.label || this.attribute} deve ser um email válido`,
        minLength: `${this.label || this.attribute} deve ter pelo menos ${validatorObj.$params?.min || ''} caracteres`,
        maxLength: `${this.label || this.attribute} deve ter no máximo ${validatorObj.$params?.max || ''} caracteres`,
        minValue: `${this.label || this.attribute} deve ser maior que ${validatorObj.$params?.min || ''}`,
        maxValue: `${this.label || this.attribute} deve ser menor que ${validatorObj.$params?.max || ''}`,
        sameAs: `${this.label || this.attribute} deve ser igual ao campo ${validatorObj.$params?.eq || ''}`,
        numeric: `${this.label || this.attribute} deve ser numérico`,
        validaData: 'Data inválida'
      }

      return messages[validator] || `${this.label || this.attribute} é inválido`
    }
  }
} 