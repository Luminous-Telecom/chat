<template>
  <div class="donut-chart-container" :style="{ height: `${height}px` }">
    <Doughnut
      v-if="chartDataComputed.labels.length > 0"
      :data="chartDataComputed"
      :options="options"
    />
    <div v-else class="no-data">
      Sem dados disponíveis
    </div>
  </div>
</template>

<script>
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale)

export default {
  name: 'DonutChartRounded',
  components: {
    Doughnut
  },
  props: {
    chartData: {
      type: Object,
      required: true
    },
    chartOptions: {
      type: Object,
      default: () => ({})
    },
    height: {
      type: Number,
      default: 300
    }
  },
  computed: {
    chartDataComputed () {
      if (!this.chartData || !this.chartData.labels || !this.chartData.series) {
        return {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: []
          }]
        }
      }

      return {
        labels: this.chartData.labels,
        datasets: [{
          data: this.chartData.series,
          backgroundColor: this.chartData.colors || [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF'
          ],
          borderWidth: 0,
          borderRadius: 5,
          hoverOffset: 4
        }]
      }
    },
    options () {
      return {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function (context) {
                return `${context.label}: ${context.raw} atendimentos`
              }
            }
          }
        }
      }
    }
  }
}
</script>

<style scoped>
.donut-chart-container {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.no-data {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--text-color-secondary);
  font-size: 14px;
}
</style>
