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

      <!-- Ícone do tipo de áudio -->
      <q-icon
        :name="isPTT ? 'mic' : 'music_note'"
        size="16px"
        class="audio-type-icon"
        :style="{ color: audioIconColor }"
      />

            <!-- Visualização de ondas -->
      <div class="audio-waveform" @click="seekToPosition">
        <div
          v-for="(bar, index) in waveformBars"
          :key="index"
          class="wave-bar"
          :class="{ 'is-loading': !waveformGenerated }"
          :style="{
            height: bar.height,
            backgroundColor: getBarColor(index)
          }"
        />
        <!-- Indicador de carregamento do waveform -->
        <div v-if="!waveformGenerated && waveformBars.length > 0" class="waveform-loading">
          <q-spinner-dots size="12px" color="grey-5" />
        </div>
      </div>

      <!-- Tempo e velocidade -->
      <div class="audio-info">
        <div class="audio-time">{{ formatTime(isPlaying ? currentTime : duration) }}</div>
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
      style="display: none;"
    />
  </div>
</template>

<script>
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
      waveformGenerated: false
    }
  },
  computed: {
    audioIconColor () {
      const isDark = this.$q.dark.isActive

      // ACK 5 = áudio foi ouvido/reproduzido - ícone azul
      if (this.ackStatus === 5) {
        if (isDark) {
          return this.isSent ? '#64b5f6' : '#42a5f5'
        }
        return this.isSent ? '#4fc3f7' : '#2196f3'
      }

      // ACK 3 = áudio foi visualizado - ícone verde
      if (this.ackStatus === 3) {
        if (isDark) {
          return this.isSent ? '#66bb6a' : '#4caf50'
        }
        return this.isSent ? '#4caf50' : '#06d755'
      }

      // Cores padrão baseadas no tipo e tema
      if (this.isPTT) {
        if (isDark) {
          return this.isSent ? '#ffb74d' : '#ff9800'
        }
        return this.isSent ? '#e65100' : '#ff9800'
      }

      // Cor padrão
      if (isDark) {
        return this.isSent ? 'rgba(255, 255, 255, 0.6)' : '#8696a0'
      }
      return this.isSent ? 'rgba(0, 0, 0, 0.45)' : '#667781'
    }
  },
  mounted () {
    // Gerar waveform com pequeno delay para evitar sobrecarga
    this.$nextTick(() => {
      setTimeout(() => {
        this.generateWaveform()
      }, Math.random() * 500) // Delay aleatório entre 0-500ms
    })
  },
  methods: {
    togglePlay () {
      if (!this.$refs.audioElement) return

      if (this.isPlaying) {
        this.$refs.audioElement.pause()
        this.isPlaying = false
      } else {
        this.$refs.audioElement.play()
        this.isPlaying = true
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
      if (this.waveformGenerated || !this.audioUrl) {
        return
      }

      // Primeiro, gerar ondas placeholder
      this.generatePlaceholderWaveform()

      try {
        // Inicializar Web Audio API
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
        }

        // Carregar e analisar o áudio
        const audioBuffer = await this.loadAndAnalyzeAudio()
        if (audioBuffer) {
          this.generateRealWaveform(audioBuffer)
        }
      } catch (error) {
        console.warn('Erro ao gerar waveform real, usando placeholder:', error)
        // Manter o placeholder se houver erro
      }
    },

    generatePlaceholderWaveform () {
      // Gerar ondas placeholder enquanto carrega o áudio real
      const barCount = 27
      this.waveformBars = []

      for (let i = 0; i < barCount; i++) {
        // Padrão mais natural baseado na posição
        let heightPercent
        if (i < 3 || i > 23) {
          heightPercent = Math.random() * 25 + 15 // Início e fim baixos
        } else if (i >= 8 && i <= 18) {
          heightPercent = Math.random() * 35 + 50 // Meio alto
        } else {
          heightPercent = Math.random() * 40 + 30 // Variação média
        }

        this.waveformBars.push({
          height: `${heightPercent}%`,
          index: i
        })
      }
    },

    async loadAndAnalyzeAudio () {
      try {
        // Verificar se o contexto está disponível
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume()
        }

        // Cache do buffer de áudio
        if (this.audioBuffer) {
          return this.audioBuffer
        }

        // Carregar o arquivo de áudio com timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const response = await fetch(this.audioUrl, {
          signal: controller.signal,
          mode: 'cors',
          headers: {
            Accept: 'audio/*,*/*'
          }
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()

        // Decodificar o áudio
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
        return this.audioBuffer
      } catch (error) {
        console.warn('Erro ao carregar áudio:', error)
        return null
      }
    },

    generateRealWaveform (audioBuffer) {
      try {
        const barCount = 27
        const channelData = audioBuffer.getChannelData(0) // Canal mono ou esquerdo
        const samplesPerBar = Math.floor(channelData.length / barCount)

        this.waveformBars = []
        let maxAmplitude = 0
        const amplitudes = []

        // Primeiro passo: calcular amplitudes e encontrar máximo
        for (let i = 0; i < barCount; i++) {
          const startSample = i * samplesPerBar
          const endSample = Math.min(startSample + samplesPerBar, channelData.length)

          let maxSample = 0
          let rmsSum = 0
          let count = 0

          // Encontrar pico máximo e RMS neste segmento
          for (let j = startSample; j < endSample; j++) {
            const sample = Math.abs(channelData[j])
            maxSample = Math.max(maxSample, sample)
            rmsSum += sample * sample
            count++
          }

          const rms = Math.sqrt(rmsSum / count)

          // Combinar pico e RMS para melhor representação
          const amplitude = (maxSample * 0.7) + (rms * 0.3)
          amplitudes.push(amplitude)
          maxAmplitude = Math.max(maxAmplitude, amplitude)
        }

        // Segundo passo: normalizar e aplicar suavização
        for (let i = 0; i < barCount; i++) {
          let normalizedAmplitude = amplitudes[i] / (maxAmplitude || 1)

          // Suavização com barras vizinhas
          if (i > 0 && i < barCount - 1) {
            const prev = amplitudes[i - 1] / (maxAmplitude || 1)
            const next = amplitudes[i + 1] / (maxAmplitude || 1)
            normalizedAmplitude = (prev * 0.2 + normalizedAmplitude * 0.6 + next * 0.2)
          }

          // Aplicar curva logarítmica para melhor visualização
          normalizedAmplitude = Math.pow(normalizedAmplitude, 0.6)

          // Converter para porcentagem (15% mínimo, 85% máximo)
          const heightPercent = Math.max(15, Math.min(85, normalizedAmplitude * 70 + 15))

          this.waveformBars.push({
            height: `${heightPercent}%`,
            index: i,
            amplitude: normalizedAmplitude
          })
        }

        this.waveformGenerated = true
        console.log('✅ Waveform real gerado com sucesso baseado no áudio')
      } catch (error) {
        console.warn('Erro ao gerar waveform real:', error)
        // Fallback para placeholder se falhar
        this.generatePlaceholderWaveform()
      }
    },

    getBarColor (index) {
      const progressIndex = Math.floor((this.progressPercent / 100) * this.waveformBars.length)

      if (index <= progressIndex) {
        // Cor de progresso baseada no tema
        return this.isSent ? '#ffffff' : '#06d755'
      } else {
        // Cor não tocada
        return this.isSent ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.2)'
      }
    },

    formatTime (seconds) {
      if (!seconds || isNaN(seconds)) return '0:00'

      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    },

    seekToPosition (event) {
      if (!this.$refs.audioElement || !this.duration) return

      const rect = event.currentTarget.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100))
      const newTime = (percent / 100) * this.duration

      this.$refs.audioElement.currentTime = newTime
      this.progressPercent = percent
    },

    onMetadataLoaded () {
      if (this.$refs.audioElement) {
        this.duration = this.$refs.audioElement.duration
        this.$refs.audioElement.playbackRate = this.playbackRate
      }
    },

    onTimeUpdate () {
      if (this.$refs.audioElement) {
        this.currentTime = this.$refs.audioElement.currentTime
        this.progressPercent = (this.currentTime / this.duration) * 100
      }
    },

    onEnded () {
      this.isPlaying = false
      this.currentTime = 0
      this.progressPercent = 0
    },

    onLoadStart () {
      this.isLoading = true
    },

    onCanPlay () {
      this.isLoading = false
    },

    cleanup () {
      // Limpar recursos Web Audio API
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close()
        } catch (error) {
          console.warn('Erro ao fechar AudioContext:', error)
        }
      }
      this.audioContext = null
      this.audioBuffer = null
      this.waveformGenerated = false
    }
  },

  watch: {
    audioUrl: {
      handler (newUrl, oldUrl) {
        if (newUrl !== oldUrl) {
          // Reset do estado
          this.isPlaying = false
          this.currentTime = 0
          this.progressPercent = 0
          this.playbackRate = 1

          // Limpar waveform anterior
          this.waveformGenerated = false
          this.audioBuffer = null

          // Gerar novo waveform
          if (newUrl) {
            this.$nextTick(() => {
              this.generateWaveform()
            })
          }
        }
      },
      immediate: true
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

    .audio-type-icon {
      flex-shrink: 0;
      margin-left: 2px;
      transition: color 0.3s ease;
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
        transition: all 0.1s ease;
        flex-shrink: 0;

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

    .audio-type-icon {
      color: rgba(0, 0, 0, 0.45);
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

  // Cor do ícone PTT agora é dinâmica via computed property
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

    // Cor do ícone dinâmica via computed property

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

    // Cor do ícone dinâmica via computed property

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

      .audio-type-icon {
        font-size: 14px;
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
