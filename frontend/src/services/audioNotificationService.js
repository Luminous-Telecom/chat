import alertSound from 'src/assets/sound.mp3'

class AudioNotificationService {
  constructor () {
    this.audioElement = null
    this.audioPermissionGranted = false
    this.isAudioPlaying = false
    this.audioQueue = []
    this.audioThrottle = {
      lastPlayed: 0,
      minInterval: 500 // Intervalo mínimo entre notificações (500ms)
    }
    this.volume = 0.7
    this.preload = 'auto'
  }

  // Inicializar o elemento de áudio
  initAudioElement () {
    if (this.audioElement) {
      return this.audioElement
    }

    this.audioElement = new Audio()
    this.audioElement.src = alertSound
    this.audioElement.volume = this.volume
    this.audioElement.preload = this.preload
    this.audioElement.type = 'audio/mp3'

    // Configurações de segurança para evitar reprodução automática
    this.audioElement.muted = true
    this.audioElement.autoplay = false
    this.audioElement.controls = false
    this.audioElement.loop = false

    return this.audioElement
  }

  // Verificar se o áudio está carregado
  isAudioLoaded () {
    if (!this.audioElement) {
      return false
    }

    return this.audioElement.readyState >= 2
  }

  // Solicitar permissão de áudio
  async requestAudioPermission () {
    if (this.audioPermissionGranted) {
      return true
    }

    try {
      const audio = this.initAudioElement()

      // Apenas verificar se o áudio pode ser reproduzido sem tocar
      // Isso é suficiente para obter permissão em navegadores modernos
      audio.pause()
      audio.currentTime = 0

      // Tentar carregar o áudio sem tocar
      await new Promise((resolve, reject) => {
        audio.addEventListener('canplaythrough', resolve, { once: true })
        audio.addEventListener('error', reject, { once: true })
        audio.load()
      })

      this.audioPermissionGranted = true
      return true
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        // Permissão negada pelo usuário
        console.warn('Permissão de áudio negada pelo usuário')
        return false
      } else {
        console.error('Erro ao solicitar permissão de áudio:', error)
        return false
      }
    }
  }

  // Tocar som de notificação
  async playNotificationSound () {
    // Verificar throttle para evitar spam de notificações
    const now = Date.now()
    if (now - this.audioThrottle.lastPlayed < this.audioThrottle.minInterval) {
      return
    }

    if (!this.audioPermissionGranted) {
      await this.requestAudioPermission()
      return
    }

    const audio = this.initAudioElement()

    // Verificar se o áudio está carregado
    if (!this.isAudioLoaded()) {
      setTimeout(() => {
        this.playNotificationSound()
      }, 500)
      return
    }

    try {
      // Resetar o áudio imediatamente para permitir reprodução rápida
      audio.pause()
      audio.currentTime = 0

      // Desmutar o áudio para tocar
      audio.muted = false

      // Aguardar um pequeno delay para garantir que o reset foi aplicado
      setTimeout(async () => {
        try {
          await audio.play()
          this.audioThrottle.lastPlayed = Date.now()

          // Resetar o flag quando o áudio terminar
          audio.addEventListener('ended', () => {
            // Áudio terminou naturalmente
            audio.muted = true // Mutar novamente após tocar
          }, { once: true })

          // Timeout de segurança para garantir que o áudio não fique travado
          setTimeout(() => {
            if (!audio.paused) {
              audio.pause()
              audio.currentTime = 0
            }
            audio.muted = true // Mutar novamente por segurança
          }, 4000) // 4 segundos (mais que a duração do áudio)
        } catch (error) {
          console.error('Erro ao tocar áudio de notificação:', error)
          audio.muted = true // Mutar novamente em caso de erro
        }
      }, 50) // Delay reduzido para 50ms
    } catch (error) {
      console.error('Erro ao preparar áudio de notificação:', error)
      audio.muted = true // Mutar novamente em caso de erro
    }
  }

  // Tocar som de notificação com volume personalizado
  async playNotificationSoundWithVolume (volume = 0.7) {
    const audio = this.initAudioElement()
    audio.volume = volume
    await this.playNotificationSound()
  }

  // Parar som de notificação
  stopNotificationSound () {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.currentTime = 0
    }
  }

  // Definir volume
  setVolume (volume) {
    this.volume = Math.max(0, Math.min(1, volume)) // Garantir que volume esteja entre 0 e 1
    if (this.audioElement) {
      this.audioElement.volume = this.volume
    }
  }

  // Definir intervalo mínimo entre notificações
  setMinInterval (interval) {
    this.audioThrottle.minInterval = Math.max(0, interval)
  }

  // Verificar se tem permissão de áudio
  hasAudioPermission () {
    return this.audioPermissionGranted
  }

  // Destruir o serviço
  destroy () {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.src = ''
      this.audioElement = null
    }
    this.audioPermissionGranted = false
    this.isAudioPlaying = false
    this.audioQueue = []
  }
}

// Criar instância singleton
const audioNotificationService = new AudioNotificationService()

export default audioNotificationService
