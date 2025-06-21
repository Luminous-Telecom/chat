<template>
  <div class="modern-search-wrapper">
    <div class="search-input-container">
      <q-icon name="mdi-magnify" class="search-icon" />
      <input
        ref="searchInput"
        v-model="searchValue"
        :placeholder="placeholder"
        class="modern-search-input"
        type="text"
        :disabled="disabled"
        :readonly="readonly"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keyup.enter="onEnter"
        @keyup.escape="onEscape"
      />
      <q-btn
        v-if="searchValue"
        flat
        round
        dense
        size="sm"
        icon="mdi-close"
        class="clear-search-btn"
        @click="clearSearch"
      />
    </div>
  </div>
</template>

<script>
export default {
  name: 'ModernSearch',
  props: {
    value: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Buscar...'
    },
    disabled: {
      type: Boolean,
      default: false
    },
    readonly: {
      type: Boolean,
      default: false
    },
    debounce: {
      type: Number,
      default: 300
    }
  },
  data () {
    return {
      searchValue: this.value,
      isFocused: false,
      debounceTimer: null
    }
  },
  computed: {},
  watch: {
    value (newVal) {
      this.searchValue = newVal
    },
    searchValue (newVal) {
      this.emitSearch(newVal)
    }
  },
  methods: {
    onInput () {
      this.$emit('input', this.searchValue)
    },
    onFocus () {
      this.isFocused = true
      this.$emit('focus')
    },
    onBlur () {
      this.isFocused = false
      this.$emit('blur')
    },
    onEnter () {
      this.$emit('enter', this.searchValue)
    },
    onEscape () {
      this.clearSearch()
    },
    clearSearch () {
      this.searchValue = ''
      this.$emit('input', '')
      this.$emit('clear')
    },
    emitSearch (value) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }

      this.debounceTimer = setTimeout(() => {
        this.$emit('search', value)
      }, this.debounce)
    },
    focus () {
      this.$refs.searchInput.focus()
    }
  }
}
</script>

<style lang="scss" scoped>
.modern-search-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: 8px 16px;
  margin: 0 8px;
  width: 100%;
  max-width: 280px;
  min-height: 44px;
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;

  &:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.2);
  }

  &:focus-within {
    background: rgba(255, 255, 255, 0.22);
    border-color: rgba(25, 118, 210, 0.5);
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.1);
  }
}

.search-icon {
  color: rgba(255, 255, 255, 0.7);
  font-size: 18px;
  margin-right: 12px;
  flex-shrink: 0;
  transition: color 0.3s ease;
}

.modern-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: white;
  font-size: 14px;
  font-weight: 400;
  min-width: 0;

  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
    font-weight: 400;
  }

  &:focus::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
}

.clear-search-btn {
  color: rgba(255, 255, 255, 0.7);
  margin-left: 8px;
  flex-shrink: 0;

  &:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
  }
}

// Tema escuro
body.body--dark {
  .search-input-container {
    background: rgba(30, 42, 58, 0.8);
    border-color: rgba(52, 73, 94, 0.5);

    &:hover {
      background: rgba(30, 42, 58, 0.9);
      border-color: rgba(52, 73, 94, 0.7);
    }

    &:focus-within {
      background: rgba(30, 42, 58, 0.95);
      border-color: rgba(100, 181, 246, 0.5);
      box-shadow: 0 0 0 4px rgba(100, 181, 246, 0.1);
    }
  }

  .search-icon {
    color: rgba(232, 244, 248, 0.7);
  }

  .modern-search-input {
    color: #e8f4f8;

    &::placeholder {
      color: rgba(232, 244, 248, 0.6);
    }

    &:focus::placeholder {
      color: rgba(232, 244, 248, 0.4);
    }
  }

  .clear-search-btn {
    color: rgba(232, 244, 248, 0.7);

    &:hover {
      color: rgba(232, 244, 248, 0.9);
      background: rgba(52, 73, 94, 0.3);
    }
  }
}

// Responsividade
@media (max-width: 768px) {
  .search-input-container {
    max-width: none;
    min-height: 36px;
    padding: 6px 12px;
    margin: 0 4px;
  }

  .modern-search-input {
    font-size: 13px;
  }

  .search-icon {
    font-size: 16px;
    margin-right: 8px;
  }
}
</style>
