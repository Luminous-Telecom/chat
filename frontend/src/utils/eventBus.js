// Event Bus para substituir $root.$on/$emit do Vue 2
class EventBus {
  constructor() {
    this.events = {}
  }

  // Equivalente ao $on
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  // Equivalente ao $emit
  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        callback(...args)
      })
    }
  }

  // Equivalente ao $off
  off(event, callback) {
    if (this.events[event]) {
      if (callback) {
        this.events[event] = this.events[event].filter(cb => cb !== callback)
      } else {
        delete this.events[event]
      }
    }
  }

  // Limpar todos os eventos
  clear() {
    this.events = {}
  }
}

// Criar instância global
const eventBus = new EventBus()

export default eventBus 