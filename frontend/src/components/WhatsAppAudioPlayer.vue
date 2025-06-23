<template>
  <div class="whatsapp-audio-player" :class="{ 'is-playing': isPlaying, 'is-ptt': isPTT, 'is-sent': isSent }">
    <div class="audio-container">
      <!-- Botão Play/Pause -->
      <q-btn
        round
        flat
        size="sm"
        :icon="isPlaying ? 'pause' : 'play_arrow'"
        class="play-btn"
        @click="togglePlay"
        :loading="isLoading"
      />

      <!-- Visualização de ondas -->
      <div class="audio-waveform" @click="seekToPosition">
        <div
          v-for="(bar, index) in waveformBars"
          :key="index"
          class="wave-bar"
          :class="{ 'is-loading': !waveformGenerated }"
          :style="getBarStyle(index)"
        />
        <!-- Indicador de carregamento do waveform -->
        <div v-if="!waveformGenerated && waveformBars.length > 0" class="waveform-loading">
          <q-spinner-dots size="12px" color="grey-5" />
        </div>
      </div>

      <!-- Tempo e velocidade -->
      <div class="audio-info">
        <div class="audio-time">{{ displayTime }}</div>
        <q-btn
          v-if="showSpeedControl"
          flat
          dense
          size="xs"
          :label="`${playbackRate}x`"
          @click="cyclePlaybackRate"
          class="speed-btn"
        />
      </div>
    </div>

    <!-- Elemento audio oculto -->
    <audio
      ref="audioElement"
      :src="audioUrl"
      preload="metadata"
      @loadedmetadata="onMetadataLoaded"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @loadstart="onLoadStart"
      @canplay="onCanPlay"
      @error="onAudioError"
      style="display: none;"
    />
  </div>
</template>

<script>
// Cache global para waveforms
const waveformCache = new Map()
const audioBufferCache = new Map()

// Debounce helper
function debounce (func, wait) {
  let timeout
  return function executedFunction (...args) {
    const later = () => {
      clearTimeout(timeout)
      func.apply(this, args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export default {
  name: 'WhatsAppAudioPlayer',
  props: {
    audioUrl: {
      type: String,
      required: true
    },
    isPTT: {
      type: Boolean,
      default: false
    },
    isSent: {
      type: Boolean,
      default: false
    },
    showSpeedControl: {
      type: Boolean,
      default: true
    },
    audioName: {
      type: String,
      default: ''
    },
    ackStatus: {
      type: Number,
      default: 0
    }
  },
  data () {
    return {
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1,
      playbackRates: [1, 1.5, 2],
      waveformBars: [],
      progressPercent: 0,
      audioContext: null,
      audioBuffer: null,
      waveformGenerated: false,
      cleanupHandlers: [],
      isDestroyed: false,
      barStyles: [], // Cache para estilos das barras
      barStylesNeedUpdate: true,
      styleUpdateTimeout: null,
      retryAttempted: false
    }
  },

  computed: {
    // Cache do tempo formatado
    displayTime () {
      const time = this.isPlaying ? this.currentTime : this.duration
      return this.formatTime(time)
    },

    // ID único para cache (mais compacto)
    cacheKey () {
      if (!this.audioUrl) return null
      // Usar hash simples da URL para economizar memória
      const url = this.audioUrl.split('/').pop() || this.audioUrl
      return this.audioName ? `${url}_${this.audioName}` : url
    }
  },

  mounted () {
    // Debounced waveform generation
    this.debouncedGenerateWaveform = debounce(this.generateWaveform.bind(this), 150)

    // Inicializar com delay mínimo
    this.$nextTick(() => {
      if (!this.isDestroyed) {
        // Delay reduzido para melhor UX
        const delay = waveformCache.has(this.cacheKey) ? 50 : Math.random() * 200 + 100
        setTimeout(() => {
          if (!this.isDestroyed) {
            this.debouncedGenerateWaveform()
          }
        }, delay)
      }
    })
  },

  methods: {
    // Otimização: Style computation cached
    getBarStyle (index) {
      if (!this.barStyles[index] || this.barStylesNeedUpdate) {
        this.updateBarStyles()
      }
      return this.barStyles[index] || {}
    },

    updateBarStyles () {
      const progressIndex = Math.floor((this.progressPercent / 100) * this.waveformBars.length)

      this.barStyles = this.waveformBars.map((bar, index) => {
        const isProgressed = index <= progressIndex
        return {
          height: bar.height,
          backgroundColor: isProgressed
            ? (this.isSent ? '#ffffff' : '#06d755')
            : (this.isSent ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.2)')
        }
      })
      this.barStylesNeedUpdate = false
    },

    async togglePlay () {
      if (!this.$refs.audioElement || this.isDestroyed) return

      try {
        if (this.isPlaying) {
          this.$refs.audioElement.pause()
          this.isPlaying = false
        } else {
          // Aguardar metadados se necessário
          if (this.$refs.audioElement.readyState < 2) {
            this.isLoading = true
            this.$refs.audioElement.addEventListener('loadedmetadata', () => {
              if (!this.isDestroyed) {
                this.$refs.audioElement.play()
                this.isPlaying = true
                this.isLoading = false
              }
            }, { once: true })
            this.$refs.audioElement.load()
          } else {
            await this.$refs.audioElement.play()
            this.isPlaying = true
          }
        }
      } catch (error) {
        console.warn('Erro ao controlar reprodução:', error)
        this.isPlaying = false
        this.isLoading = false
      }
    },

    cyclePlaybackRate () {
      const currentIndex = this.playbackRates.indexOf(this.playbackRate)
      const nextIndex = (currentIndex + 1) % this.playbackRates.length
      this.playbackRate = this.playbackRates[nextIndex]

      if (this.$refs.audioElement) {
        this.$refs.audioElement.playbackRate = this.playbackRate
      }
    },

    async generateWaveform () {
      if (this.waveformGenerated || !this.audioUrl || this.isDestroyed) {
        return
      }

      // Verificar cache primeiro
      if (waveformCache.has(this.cacheKey)) {
        const cachedWaveform = waveformCache.get(this.cacheKey)
        this.waveformBars = [...cachedWaveform]
        this.waveformGenerated = true
        this.barStylesNeedUpdate = true
        return
      }

      // Gerar placeholder otimizado
      this.generatePlaceholderWaveform()

      // Processar waveform real em background
      this.processRealWaveform()
    },

    generatePlaceholderWaveform () {
      const barCount = 27
      const pattern = [20, 25, 35, 45, 60, 70, 75, 80, 85, 80, 75, 70, 65, 60, 70, 75, 80, 75, 70, 65, 60, 55, 45, 35, 25, 20, 15]

      this.waveformBars = pattern.slice(0, barCount).map((height, index) => ({
        height: `${height}%`,
        index
      }))

      this.barStylesNeedUpdate = true
    },

    async processRealWaveform () {
      try {
        // Early return se destruído
        if (this.isDestroyed) return

        // Verificar suporte ao Web Audio API
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return

        // Reutilizar contexto global se possível
        if (!this.audioContext || this.audioContext.state === 'closed') {
          this.audioContext = new AudioContextClass()
        }

        const audioBuffer = await this.loadAndAnalyzeAudio()
        if (audioBuffer && !this.isDestroyed) {
          this.generateRealWaveform(audioBuffer)
          // Cache o resultado
          if (this.cacheKey) {
            waveformCache.set(this.cacheKey, [...this.waveformBars])
            // Limitar tamanho do cache (reduzido para economizar memória)
            if (waveformCache.size > 30) {
              const firstKey = waveformCache.keys().next().value
              waveformCache.delete(firstKey)
            }
          }
        }
      } catch (error) {
        console.warn('Erro ao processar waveform real:', error)
      }
    },

    async loadAndAnalyzeAudio () {
      try {
        if (this.isDestroyed) return null

        // Cache do buffer de áudio
        if (audioBufferCache.has(this.cacheKey)) {
          return audioBufferCache.get(this.cacheKey)
        }

        if (!this.isAudioContextHealthy()) return null

        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume()
        }

        // Fetch otimizado com cache HTTP
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000) // Timeout reduzido

        this.cleanupHandlers.push(() => {
          clearTimeout(timeoutId)
          controller.abort()
        })

        const response = await fetch(this.audioUrl, {
          signal: controller.signal,
          mode: 'cors',
          cache: 'force-cache', // Usar cache do navegador
          headers: {
            Accept: 'audio/*,*/*'
          }
        })

        clearTimeout(timeoutId)

        if (!response.ok || this.isDestroyed) return null

        const arrayBuffer = await response.arrayBuffer()

        if (!this.isAudioContextHealthy() || this.isDestroyed) return null

        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

        // Cache o buffer
        if (this.cacheKey) {
          audioBufferCache.set(this.cacheKey, audioBuffer)
          // Limitar tamanho do cache (reduzido para economizar memória)
          if (audioBufferCache.size > 15) {
            const firstKey = audioBufferCache.keys().next().value
            audioBufferCache.delete(firstKey)
          }
        }

        return audioBuffer
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('Erro au carregar áudio:', error)
        }
        return null
      }
    },

    generateRealWaveform (audioBuffer) {
      try {
        if (this.isDestroyed) return

        const barCount = 27
        const channelData = audioBuffer.getChannelData(0)
        const samplesPerBar = Math.floor(channelData.length / barCount)

        const amplitudes = new Float32Array(barCount)
        let maxAmplitude = 0

        // Otimização: processar em chunks menores
        for (let i = 0; i < barCount; i++) {
          const startSample = i * samplesPerBar
          const endSample = Math.min(startSample + samplesPerBar, channelData.length)

          let maxSample = 0
          let rmsSum = 0
          const count = endSample - startSample

          // Processar em batches para evitar travamento
          for (let j = startSample; j < endSample; j += 10) {
            const endBatch = Math.min(j + 10, endSample)
            for (let k = j; k < endBatch; k++) {
              const sample = Math.abs(channelData[k])
              maxSample = Math.max(maxSample, sample)
              rmsSum += sample * sample
            }
          }

          const rms = Math.sqrt(rmsSum / count)
          const amplitude = (maxSample * 0.7) + (rms * 0.3)
          amplitudes[i] = amplitude
          maxAmplitude = Math.max(maxAmplitude, amplitude)
        }

        // Aplicar normalização e suavização
        this.waveformBars = []
        for (let i = 0; i < barCount; i++) {
          let normalizedAmplitude = amplitudes[i] / (maxAmplitude || 1)

          // Suavização otimizada
          if (i > 0 && i < barCount - 1) {
            const prev = amplitudes[i - 1] / (maxAmplitude || 1)
            const next = amplitudes[i + 1] / (maxAmplitude || 1)
            normalizedAmplitude = (prev * 0.2 + normalizedAmplitude * 0.6 + next * 0.2)
          }

          normalizedAmplitude = Math.pow(normalizedAmplitude, 0.6)
          const heightPercent = Math.max(15, Math.min(85, normalizedAmplitude * 70 + 15))

          this.waveformBars.push({
            height: `${heightPercent}%`,
            index: i,
            amplitude: normalizedAmplitude
          })
        }

        this.waveformGenerated = true
        this.barStylesNeedUpdate = true
      } catch (error) {
        console.warn('Erro ao gerar waveform real:', error)
      }
    },

    isAudioContextHealthy () {
      return this.audioContext &&
             this.audioContext.state !== 'closed' &&
             typeof this.audioContext.decodeAudioData === 'function'
    },

    formatTime (seconds) {
      if (!seconds || isNaN(seconds)) return '0:00'

      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    },

    seekToPosition (event) {
      if (!this.$refs.audioElement || !this.duration || this.isDestroyed) return

      const rect = event.currentTarget.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100))
      const newTime = (percent / 100) * this.duration

      this.$refs.audioElement.currentTime = newTime
      this.progressPercent = percent
      this.barStylesNeedUpdate = true
    },

    onMetadataLoaded () {
      if (this.$refs.audioElement && !this.isDestroyed) {
        this.duration = this.$refs.audioElement.duration
        this.$refs.audioElement.playbackRate = this.playbackRate
      }
    },

    onTimeUpdate () {
      if (this.$refs.audioElement && !this.isDestroyed) {
        this.currentTime = this.$refs.audioElement.currentTime
        const newProgress = (this.currentTime / this.duration) * 100

        // Otimização: só atualizar se mudança significativa
        if (Math.abs(newProgress - this.progressPercent) > 1) {
          this.progressPercent = newProgress
          this.barStylesNeedUpdate = true
        }
      }
    },

    onEnded () {
      this.isPlaying = false
      this.currentTime = 0
      this.progressPercent = 0
      this.barStylesNeedUpdate = true
    },

    onLoadStart () {
      if (!this.isDestroyed) {
        this.isLoading = true
      }
    },

    onCanPlay () {
      if (!this.isDestroyed) {
        this.isLoading = false
      }
    },

    onAudioError (error) {
      console.warn('Erro no elemento audio:', error)
      this.isLoading = false
      this.isPlaying = false

      // Tentar recarregar uma vez se for erro de rede
      if (!this.retryAttempted && this.$refs.audioElement) {
        this.retryAttempted = true
        setTimeout(() => {
          if (!this.isDestroyed && this.$refs.audioElement) {
            this.$refs.audioElement.load()
          }
        }, 1000)
      }
    },

    cleanup () {
      this.isDestroyed = true

      // Limpar timeouts
      if (this.styleUpdateTimeout) {
        clearTimeout(this.styleUpdateTimeout)
        this.styleUpdateTimeout = null
      }

      // Executar handlers de cleanup
      this.cleanupHandlers.forEach(handler => {
        try {
          handler()
        } catch (error) {
          console.warn('Erro no cleanup handler:', error)
        }
      })
      this.cleanupHandlers = []

      // Parar reprodução
      if (this.$refs.audioElement) {
        try {
          this.$refs.audioElement.pause()
          this.$refs.audioElement.currentTime = 0
          this.$refs.audioElement.src = ''
        } catch (error) {
          console.warn('Erro ao limpar elemento audio:', error)
        }
      }

      // Limpar contexto de áudio de forma mais suave
      if (this.audioContext && this.audioContext.state !== 'closed') {
        // Não fechar o contexto imediatamente, deixar para garbage collection
        this.audioContext = null
      }

      // Limpar referencias
      this.audioBuffer = null
      this.waveformBars = []
      this.barStyles = []
      this.debouncedGenerateWaveform = null
    }
  },

  watch: {
    audioUrl: {
      handler (newUrl, oldUrl) {
        if (newUrl !== oldUrl) {
          // Reset otimizado
          this.isPlaying = false
          this.currentTime = 0
          this.progressPercent = 0
          this.playbackRate = 1
          this.waveformGenerated = false
          this.audioBuffer = null
          this.barStyles = []
          this.barStylesNeedUpdate = true
          this.retryAttempted = false

          if (newUrl && !this.isDestroyed) {
            this.$nextTick(() => {
              if (this.debouncedGenerateWaveform) {
                this.debouncedGenerateWaveform()
              }
            })
          }
        }
      },
      immediate: false // Não executar no mount
    },

    progressPercent () {
      // Debounce da atualização de estilos
      if (!this.styleUpdateTimeout) {
        this.styleUpdateTimeout = setTimeout(() => {
          this.barStylesNeedUpdate = true
          this.styleUpdateTimeout = null
        }, 16) // ~60fps
      }
    }
  },

  beforeDestroy () {
    this.cleanup()
  }
}
</script>

<style lang="scss" scoped>
.whatsapp-audio-player {
  max-width: 250px;
  min-width: 200px;

  .audio-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 7.5px;
    background: #ffffff;
    position: relative;

    .play-btn {
      width: 28px;
      height: 28px;
      min-height: 28px;
      border-radius: 50%;
      background: #06d755;
      color: white;
      flex-shrink: 0;

      .q-icon {
        font-size: 18px;
      }

      &:hover {
        background: #05c251;
      }
    }

    .audio-waveform {
      flex: 1;
      display: flex;
      align-items: center;
      height: 17px;
      gap: 1px;
      cursor: pointer;
      margin: 0 4px;
      position: relative;

      .wave-bar {
        width: 2px;
        min-height: 2px;
        border-radius: 1px;
        flex-shrink: 0;
        will-change: background-color; // Otimização para mudanças de cor
        backface-visibility: hidden; // Força aceleração de hardware

        &.is-loading {
          opacity: 0.6;
          animation: pulseLoading 1.5s ease-in-out infinite;
        }
      }

      .waveform-loading {
        position: absolute;
        top: 50%;
        right: -24px;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        width: 16px;
        height: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
    }

    .audio-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex-shrink: 0;
      gap: 2px;

      .audio-time {
        font-size: 12px;
        color: #667781;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        line-height: 1;
        min-width: 28px;
        text-align: right;
      }

      .speed-btn {
        font-size: 10px;
        color: #667781;
        min-height: 14px;
        padding: 0 4px;
        border-radius: 8px;
        font-weight: 500;

        &:hover {
          background: rgba(0, 0, 0, 0.05);
        }
      }
    }
  }

  // Mensagem enviada (verde)
  &.is-sent .audio-container {
    background: #dcf8c6;

    .play-btn {
      background: #128c7e;

      &:hover {
        background: #0d7377;
      }
    }

    .audio-info {
      .audio-time,
      .speed-btn {
        color: rgba(0, 0, 0, 0.45);
      }

      .speed-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }
    }
  }

      // Ícone de tipo de áudio removido
}

// Tema escuro
.body--dark .whatsapp-audio-player {
  .audio-container {
    background: #2a2f32;

    .play-btn {
      background: #00a884;

      &:hover {
        background: #008f72;
      }
    }

    .audio-info {
      .audio-time,
      .speed-btn {
        color: #8696a0;
      }

      .speed-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }

  &.is-sent .audio-container {
    background: #056162;

    .play-btn {
      background: #00a884;

      &:hover {
        background: #008f72;
      }
    }

    .audio-info {
      .audio-time,
      .speed-btn {
        color: rgba(255, 255, 255, 0.6);
      }

      .speed-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }

  // Cores do ícone PTT no tema escuro também são dinâmicas

  // Loading indicator no tema escuro
  .audio-container .audio-waveform .waveform-loading {
    background: rgba(42, 47, 50, 0.9);
  }

  &.is-sent .audio-container .audio-waveform .waveform-loading {
    background: rgba(5, 97, 98, 0.9);
  }
}

// Ondas ficam fixas como no WhatsApp - apenas mudança de cor por progresso

@keyframes pulseLoading {
  0%, 100% {
    opacity: 0.4;
    transform: scaleY(0.6);
  }
  50% {
    opacity: 0.8;
    transform: scaleY(1);
  }
}

// Loading state
.whatsapp-audio-player .play-btn .q-spinner {
  color: white;
}

.whatsapp-audio-player.is-sent .play-btn .q-spinner {
  color: white;
}

// Responsividade
@media (max-width: 480px) {
  .whatsapp-audio-player {
    max-width: 220px;
    min-width: 180px;

    .audio-container {
      gap: 6px;
      padding: 6px 10px;

      .play-btn {
        width: 24px;
        height: 24px;
        min-height: 24px;

        .q-icon {
          font-size: 16px;
        }
      }

      .audio-waveform {
        margin: 0 2px;

        .wave-bar {
          width: 1.5px;
        }
      }

      .audio-info {
        .audio-time {
          font-size: 11px;
          min-width: 24px;
        }

        .speed-btn {
          font-size: 9px;
          min-height: 12px;
          padding: 0 3px;
        }
      }
    }
  }
}
</style>
