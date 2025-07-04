<template>
  <div class="modern-dashboard">
    <!-- Header com filtros modernos -->
    <div class="dashboard-header">
      <div class="header-content">
        <h1 class="dashboard-title">
          <q-icon name="mdi-view-dashboard" class="title-icon" />
          Dashboard Analytics
        </h1>

        <!-- Filtros em linha horizontal -->
        <div class="filters-container">
          <div class="filter-item">
            <q-input
              class="modern-input"
              dense
              outlined
              stack-label
              label="Data Inicial"
              color="primary"
              v-model="params.startDate"
              readonly
            >
              <template v-slot:prepend>
                <q-icon name="mdi-calendar-start" />
              </template>
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="params.startDate" mask="YYYY-MM-DD">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="Fechar" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>

          <div class="filter-item">
            <q-input
              class="modern-input"
              dense
              outlined
              stack-label
              label="Data Final"
              color="primary"
              v-model="params.endDate"
              readonly
            >
              <template v-slot:prepend>
                <q-icon name="mdi-calendar-end" />
              </template>
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="params.endDate" mask="YYYY-MM-DD">
                      <div class="row items-center justify-end">
                        <q-btn v-close-popup label="Fechar" color="primary" flat />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>

          <div class="filter-item filter-select">
            <q-select
              class="modern-input"
              dense
              outlined
              emit-value
              map-options
              multiple
              use-chips
              label="Filas"
              color="primary"
              v-model="params.queuesIds"
              :options="filas"
              option-value="id"
              option-label="queue"
            >
              <template v-slot:prepend>
                <q-icon name="mdi-format-list-bulleted" />
              </template>
            </q-select>
          </div>

          <div class="filter-item">
            <q-btn
              class="update-btn"
              unelevated
              color="primary"
              icon="mdi-refresh"
              label="Atualizar"
              :loading="isLoading"
              :disable="isLoading"
              @click="loadData"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Cards de métricas com design uniforme -->
    <div class="metrics-section">
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon">
              <q-icon name="mdi-chart-line" />
            </div>
            <span class="metric-title">Total Atendimentos</span>
          </div>
          <div class="metric-value">{{ ticketsAndTimes.qtd_total_atendimentos || 0 }}</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon">
              <q-icon name="mdi-account-check" />
            </div>
            <span class="metric-title">Atendimento Ativo</span>
          </div>
          <div class="metric-value">{{ ticketsAndTimes.qtd_demanda_ativa || 0 }}</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon">
              <q-icon name="mdi-phone-incoming" />
            </div>
            <span class="metric-title">Atendimento Receptivo</span>
          </div>
          <div class="metric-value">{{ ticketsAndTimes.qtd_demanda_receptiva || 0 }}</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon">
              <q-icon name="mdi-account-plus" />
            </div>
            <span class="metric-title">Novos Contatos</span>
          </div>
          <div class="metric-value">{{ ticketsAndTimes.new_contacts || 0 }}</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon">
              <q-icon name="mdi-clock-outline" />
            </div>
            <span class="metric-title">TMA</span>
          </div>
          <div class="metric-value time-value">{{ formatMinutes(ticketsAndTimes.tma) }}</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon">
              <q-icon name="mdi-timer-outline" />
            </div>
            <span class="metric-title">TME</span>
          </div>
          <div class="metric-value time-value">{{ formatMinutes(ticketsAndTimes.tme) }}</div>
        </div>
      </div>
    </div>

    <!-- Seção de gráficos -->
    <div class="charts-section">
      <!-- Gráficos pequenos lado a lado -->
      <div class="charts-row">
        <div class="chart-container">
          <div class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">
                <q-icon name="mdi-chart-donut" />
                Atendimentos por Canal
              </h3>
            </div>
            <div class="chart-content-wrapper">
              <div class="chart-content">
                <canvas id="ticketsChannels" class="pizza-chart"></canvas>
              </div>
              <div class="chart-legend" id="ticketsChannelsLegend"></div>
            </div>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">
                <q-icon name="mdi-chart-donut" />
                Atendimentos por Instância
              </h3>
            </div>
            <div class="chart-content-wrapper">
              <div class="chart-content">
                <canvas id="ticketsInstances" class="pizza-chart"></canvas>
              </div>
              <div class="chart-legend" id="ticketsInstancesLegend"></div>
            </div>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">
                <q-icon name="mdi-chart-pie" />
                Distribuição por Fila
              </h3>
            </div>
            <div class="chart-content-wrapper">
              <div class="chart-content">
                <canvas id="ticketsEvolutionByQueue" class="pizza-chart"></canvas>
              </div>
              <div class="chart-legend" id="ticketsEvolutionByQueueLegend"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Gráfico de barras empilhadas -->
      <div class="chart-full-width">
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">
              <q-icon name="mdi-chart-bar-stacked" />
              Evolução de Atendimentos por Canal
            </h3>
          </div>
          <div class="chart-content">
            <canvas id="channelEvolutionChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Gráfico de linha temporal -->
      <div class="chart-full-width">
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">
              <q-icon name="mdi-chart-timeline-variant" />
              Evolução Temporal de Atendimentos
            </h3>
          </div>
          <div class="chart-content">
            <canvas id="ticketsEvolutionByPeriod"></canvas>
          </div>
        </div>
      </div>

      <!-- Gráfico de performance por usuário -->
      <div class="chart-full-width">
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">
              <q-icon name="mdi-account-group" />
              Performance por Usuário
            </h3>
          </div>
          <div class="chart-content">
            <canvas id="ticketsPerUsersDetail"></canvas>
          </div>
        </div>
      </div>

      <!-- Tabela de performance -->
      <div class="table-section">
        <div class="table-card">
          <div class="table-header">
            <h3 class="table-title">
              <q-icon name="mdi-table" />
              Detalhamento de Performance por Usuário
            </h3>
          </div>
          <div class="table-content">
            <q-table
              :rows="ticketsPerUsersDetail"
              :columns="columns"
              :pagination="{
                rowsPerPage: 10,
                rowsNumber: ticketsPerUsersDetail.length,
                lastIndex: 0
              }"
              row-key="name"
              flat
              bordered
              class="tickets-table"
            >
              <template v-slot:body-cell-name="props">
                <q-td :props="props" class="user-cell">
                  <div class="user-info">
                    <div class="user-avatar">
                      <q-icon name="mdi-account" />
                    </div>
                    <div class="user-details">
                      <div class="user-name">{{ props.row.name || 'Não informado' }}</div>
                      <div class="user-email">{{ props.row.email }}</div>
                    </div>
                  </div>
                </q-td>
              </template>
            </q-table>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabela de Atendimentos por Usuário -->
    <div class="table-section">
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">
            <q-icon name="mdi-account-group" />
            Atendimentos por Usuário
          </h3>
        </div>
        <div class="chart-content">
          <q-table
            :rows="ticketsPerUsersDetail"
            :columns="columns"
            :pagination="{
              rowsPerPage: 10,
              rowsNumber: ticketsPerUsersDetail.length,
              lastIndex: 0
            }"
            row-key="name"
            flat
            bordered
            class="tickets-table"
          >
            <template v-slot:body-cell-name="props">
              <q-td :props="props">
                <div class="user-cell">
                  <q-avatar size="sm">
                    <q-icon name="mdi-account" />
                  </q-avatar>
                  <span>{{ props.value }}</span>
                </div>
              </q-td>
            </template>
            <template v-slot:no-data>
              <div class="no-data">
                <q-icon name="mdi-alert" size="2rem" />
                <p>Nenhum dado disponível</p>
              </div>
            </template>
          </q-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import '../../css/dashboard.css'
import { ref, onMounted, onUnmounted, reactive, watch, nextTick } from 'vue'
import { Notify, debounce } from 'quasar'
import groupBy from 'lodash/groupBy'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  DoughnutController,
  BarController,
  BarElement,
  Filler
} from 'chart.js'
import { ListarFilas } from 'src/service/filas'
import {
  GetDashTicketsPerUsersDetail,
  GetDashTicketsAndTimes,
  GetDashTicketsEvolutionChannels,
  GetDashTicketsInstances,
  GetDashTicketsEvolutionByPeriod,
  GetDashTicketsEvolutionByQueue,
  GetDashTicketsChannels
} from 'src/service/dashboard'

// Registrar componentes do Chart.js
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  DoughnutController,
  BarController,
  BarElement,
  Filler
)

// Inicializar todas as variáveis reativas
const today = new Date()
const startDate = new Date(today)
startDate.setHours(0, 0, 0, 0)
const endDate = new Date(today)
endDate.setHours(23, 59, 59, 999)

// Usar reactive ao invés de ref para params
const params = reactive({
  startDate: startDate.toISOString(),
  endDate: endDate.toISOString(),
  queuesIds: []
})

// Definir refs para os gráficos com valores iniciais
const ChartTicketsChannels = ref(null)
const ChartTicketsInstances = ref(null)
const ChartTicketsEvolutionByPeriod = ref(null)
const ChartTicketsEvolutionByQueue = ref(null)
const ChartTicketsEvolutionChannels = ref(null)
const channelEvolutionChart = ref(null)

// Definir outras variáveis reativas
const filas = ref([])
const ticketsPerUsersDetail = ref([])
const ticketsAndTimes = ref({
  qtd_total_atendimentos: 0,
  qtd_demanda_ativa: 0,
  qtd_demanda_receptiva: 0,
  new_contacts: 0,
  tma: null,
  tme: null
})

const ticketsEvolutionChannels = ref([])
const ticketsEvolutionChannelsOptions = ref({
  series: [],
  chart: {
    type: 'bar',
    stacked: true,
    toolbar: {
      show: false
    }
  },
  xaxis: {
    categories: [],
    labels: {
      style: {
        colors: '#666'
      }
    }
  },
  yaxis: {
    title: {
      text: 'Quantidade de Tickets'
    }
  },
  colors: ['#1976D2', '#4CAF50', '#FFC107', '#F44336', '#9C27B0'],
  legend: {
    position: 'bottom-right'
  },
  tooltip: {
    shared: true
  }
})

// eslint-disable-next-line no-unused-vars
const columns = [
  {
    name: 'name',
    label: 'Usuário',
    field: 'name',
    align: 'left',
    sortable: true
  },
  {
    name: 'email',
    label: 'E-mail',
    field: 'email',
    align: 'left',
    sortable: true
  },
  {
    name: 'total',
    label: 'Total',
    field: 'total',
    align: 'right',
    sortable: true
  },
  {
    name: 'open',
    label: 'Abertos',
    field: 'open',
    align: 'right',
    sortable: true
  },
  {
    name: 'pending',
    label: 'Pendentes',
    field: 'pending',
    align: 'right',
    sortable: true
  },
  {
    name: 'closed',
    label: 'Fechados',
    field: 'closed',
    align: 'right',
    sortable: true
  }
]

// Paleta de cores sólidas para as pizzas
const solidColors = [
  '#4CAF50', // verde
  '#1976D2', // azul
  '#FFC107', // amarelo
  '#F44336', // vermelho
  '#9C27B0', // roxo
  '#00BCD4', // ciano
  '#FF9800', // laranja
  '#8BC34A', // verde claro
  '#E91E63', // rosa
  '#3F51B5', // azul escuro
  '#CDDC39', // lima
  '#009688', // teal
  '#673AB7', // roxo escuro
  '#FFEB3B', // amarelo claro
  '#607D8B' // cinza azulado
]

// Adicionar uma variável para controlar se já está carregando
const isLoading = ref(false)

// Função utilitária para garantir formato de data correto
function formatDateOnly (dateStr) {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

// Função para preparar params antes de cada requisição
function getParams () {
  return {
    ...params,
    startDate: formatDateOnly(params.startDate),
    endDate: formatDateOnly(params.endDate)
  }
}

const listarFilas = async () => {
  try {
    const { data } = await ListarFilas()
    filas.value = data
  } catch (error) {
    console.error('Erro ao carregar filas:', error)
  }
}

const getDashTicketsAndTimes = async () => {
  try {
    const res = await GetDashTicketsAndTimes(getParams())
    const data = (res?.data && res.data[0]) || {}
    ticketsAndTimes.value = {
      qtd_total_atendimentos: data.qtd_total_atendimentos || 0,
      qtd_demanda_ativa: data.qtd_demanda_ativa || 0,
      qtd_demanda_receptiva: data.qtd_demanda_receptiva || 0,
      new_contacts: data.new_contacts || 0,
      tma: data.tma || '0min',
      tme: data.tme || '0min'
    }
  } catch (error) {
    console.error('Erro ao carregar dados de tempo:', error)
  }
}

const getDashTicketsEvolutionChannels = () => {
  GetDashTicketsEvolutionChannels(getParams()).then(res => {
    ticketsEvolutionChannels.value = res.data || []

    if (!Array.isArray(ticketsEvolutionChannels.value) || ticketsEvolutionChannels.value.length === 0) {
      ticketsEvolutionChannelsOptions.value.series = [{
        name: 'Sem dados',
        data: [0]
      }]
      ticketsEvolutionChannelsOptions.value.xaxis.categories = ['Sem dados']
      if (ChartTicketsEvolutionChannels.value) {
        ChartTicketsEvolutionChannels.value.updateOptions(ticketsEvolutionChannelsOptions.value)
        ChartTicketsEvolutionChannels.value.updateSeries(ticketsEvolutionChannelsOptions.value.series, true)
      }
      return
    }

    const dataLabel = groupBy(ticketsEvolutionChannels.value, 'dt_referencia')
    const labels = Object.keys(dataLabel).sort()

    ticketsEvolutionChannelsOptions.value = {
      ...ticketsEvolutionChannelsOptions.value,
      xaxis: {
        ...ticketsEvolutionChannelsOptions.value.xaxis,
        categories: labels
      }
    }

    const series = []
    const dados = groupBy(ticketsEvolutionChannels.value, d => d.label && d.label !== 'undefined' && d.label !== '' ? d.label : 'Não definido')

    // Definir cores modernas para cada canal (mover para fora do if e antes do for)
    const channelColors = {
      whatsapp: {
        background: 'rgb(37, 211, 102)',
        border: 'rgb(37, 211, 102)',
        hover: 'rgb(37, 211, 102)'
      },
      facebook: {
        background: 'rgb(24, 119, 242)',
        border: 'rgb(24, 119, 242)',
        hover: 'rgb(24, 119, 242)'
      },
      instagram: {
        background: 'rgb(228, 64, 95)',
        border: 'rgb(228, 64, 95)',
        hover: 'rgb(228, 64, 95)'
      },
      telegram: {
        background: 'rgb(0, 136, 204)',
        border: 'rgb(0, 136, 204)',
        hover: 'rgb(0, 136, 204)'
      },
      web: {
        background: 'rgb(76, 175, 80)',
        border: 'rgb(76, 175, 80)',
        hover: 'rgb(76, 175, 80)'
      },
      email: {
        background: 'rgb(234, 67, 53)',
        border: 'rgb(234, 67, 53)',
        hover: 'rgb(234, 67, 53)'
      },
      default: {
        background: 'rgb(156, 39, 176)',
        border: 'rgb(156, 39, 176)',
        hover: 'rgb(156, 39, 176)'
      }
    }

    for (const item in dados) {
      if (Array.isArray(dados[item])) {
        const dataPoints = labels.map(label => {
          const point = dados[item].find(d => d.dt_referencia === label)
          return point ? Number(point.qtd) || 0 : 0
        })
        const channelType = (item && item.toLowerCase && item.toLowerCase()) || 'default'
        const colors = channelColors[channelType] || channelColors.default
        const nomeSerie = (item && item !== 'undefined' && item !== '' && item !== undefined && item !== null) ? item : 'Não definido'
        series.push({
          name: nomeSerie,
          label: nomeSerie,
          data: dataPoints,
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 2,
          borderRadius: 4,
          hoverBackgroundColor: colors.hover,
          hoverBorderColor: colors.border,
          hoverBorderWidth: 3
        })
      }
    }

    ticketsEvolutionChannelsOptions.value.series = series

    if (ChartTicketsEvolutionChannels.value) {
      ChartTicketsEvolutionChannels.value.updateOptions(ticketsEvolutionChannelsOptions.value)
      ChartTicketsEvolutionChannels.value.updateSeries(series, true)
    }
  }).catch(err => {
    console.error('Erro ao carregar evolução dos canais:', err)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de evolução dos canais'
    })
  })
}

const loadTicketsEvolutionByPeriod = async () => {
  try {
    const response = await GetDashTicketsEvolutionByPeriod(getParams())
    if (response?.data && response.data.length > 0) {
      const sortedData = [...response.data].sort((a, b) => new Date(a.date) - new Date(b.date))
      const dates = sortedData.map(item => item.date)
      const tickets = sortedData.map(item => item.tickets)
      const resolved = sortedData.map(item => item.resolved)
      destroyChart(ChartTicketsEvolutionByPeriod)
      const ctx = document.getElementById('ticketsEvolutionByPeriod')
      ChartTicketsEvolutionByPeriod.value = createChart(ctx, 'line', {
        labels: dates,
        datasets: [
          {
            label: 'Total de Tickets',
            data: tickets,
            borderColor: '#1976D2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#1976D2',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#1976D2',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Tickets Resolvidos',
            data: resolved,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#4CAF50',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#4CAF50',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            tension: 0.4,
            fill: true
          }
        ]
      }, {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'bottom-right',
            align: 'center',
            labels: {
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            displayColors: true,
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || ''
                const value = context.parsed.y || 0
                return `${label}: ${value} tickets`
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 10,
              stepSize: 1
            },
            title: {
              display: true,
              text: 'Quantidade de Tickets',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: { top: 10, bottom: 10 }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 10,
              maxRotation: 45,
              minRotation: 45
            },
            title: {
              display: true,
              text: 'Data',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: { top: 10, bottom: 10 }
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      })
    }
  } catch (error) {
    console.error('Erro ao carregar dados de evolução por período:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de evolução por período',
      position: 'bottom-right',
      timeout: 5000
    })
  }
}

const getDashTicketsPerUsersDetail = async () => {
  try {
    const res = await GetDashTicketsPerUsersDetail(getParams())
    if (res?.data) {
      ticketsPerUsersDetail.value = res.data
    }
  } catch (err) {
    console.error('Erro ao carregar dados dos usuários:', err)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados dos usuários'
    })
  }
}

const loadTicketsEvolutionByQueue = async (customParams = null) => {
  try {
    const paramsToSend = customParams || getParams()

    // Destruir o gráfico existente antes de fazer a nova requisição
    if (ChartTicketsEvolutionByQueue.value) {
      ChartTicketsEvolutionByQueue.value.destroy()
      ChartTicketsEvolutionByQueue.value = null
    }

    const response = await GetDashTicketsEvolutionByQueue(paramsToSend)

    if (!response?.data || !Array.isArray(response.data)) {
      console.warn('Dados de distribuição por fila inválidos ou vazios')
      return
    }

    // Processar dados no formato retornado pelo backend
    // Formato: [{ date: "2024-01-01", queues: { "Fila 1": 5, "Fila 2": 3 } }]
    const queueTotals = {}

    response.data.forEach(dayData => {
      if (dayData.queues && typeof dayData.queues === 'object') {
        Object.entries(dayData.queues).forEach(([queue, count]) => {
          const queueName = queue || 'Não informado'
          queueTotals[queueName] = (queueTotals[queueName] || 0) + Number(count || 0)
        })
      }
    })

    // Converter para array e filtrar dados válidos
    const validData = Object.entries(queueTotals)
      .map(([queue, count]) => ({ queue, count }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)

    if (validData.length === 0) {
      console.warn('Nenhum dado válido de distribuição por fila encontrado')
      return
    }

    const labels = validData.map(item => item.queue)
    const values = validData.map(item => item.count)
    const colors = validData.map((_, index) => solidColors[index % solidColors.length])

    // Aguardar o próximo tick para garantir que o DOM foi renderizado
    await nextTick()

    const ctx = document.getElementById('ticketsEvolutionByQueue')
    if (!ctx) {
      // Silenciar o warning se o elemento não existir ainda
      return
    }

    // Criar novo gráfico com dados processados
    ChartTicketsEvolutionByQueue.value = createChart(ctx, 'doughnut', {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#22242e',
        borderWidth: 0,
        borderRadius: 8,
        spacing: 1
      }]
    }, {
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: {
              size: 12
            },
            padding: 20,
            generateLabels: function (chart) {
              const datasets = chart.data.datasets
              return chart.data.labels.map((label, i) => ({
                text: `${label}: ${datasets[0].data[i]} atendimentos`,
                fillStyle: datasets[0].backgroundColor[i],
                hidden: false,
                lineCap: 'butt',
                lineDash: [],
                lineDashOffset: 0,
                lineJoin: 'miter',
                lineWidth: 1,
                strokeStyle: datasets[0].backgroundColor[i],
                pointStyle: 'circle',
                rotation: 0
              }))
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || ''
              const value = context.raw || 0
              const total = context.dataset.data.reduce((a, b) => a + b, 0)
              const percentage = ((value / total) * 100).toFixed(1)
              return `${label}: ${value} atendimentos (${percentage}%)`
            }
          }
        }
      }
    })
  } catch (error) {
    console.error('Erro ao carregar dados de distribuição por fila:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de distribuição por fila'
    })
    throw error
  }
}

const loadTicketsInstances = async (customParams = null) => {
  try {
    const paramsToSend = customParams || getParams()

    // Destruir o gráfico existente antes de fazer a nova requisição
    if (ChartTicketsInstances.value) {
      ChartTicketsInstances.value.destroy()
      ChartTicketsInstances.value = null
    }

    const response = await GetDashTicketsInstances(paramsToSend)

    if (!response?.data || !Array.isArray(response.data)) {
      console.warn('Dados de instâncias inválidos ou vazios')
      return
    }

    // Adaptar para aceitar status/count, label/qtd ou whatsapp/qtd
    const validData = response.data
      .filter(item => item && (item.status || item.label || item.whatsapp) && (item.count || item.qtd))
      .map(item => ({
        status: item.status || item.label || item.whatsapp || 'Não definido',
        count: Number(item.count || item.qtd) || 0
      }))
    if (validData.length === 0) {
      console.warn('Nenhum dado válido de instâncias encontrado')
      return
    }

    const labels = validData.map(item => item.status || 'Não definido')
    const values = validData.map(item => item.count || 0)
    const colors = validData.map((_, index) => solidColors[index % solidColors.length])

    // Aguardar o próximo tick para garantir que o DOM foi renderizado
    await nextTick()

    const ctx = document.getElementById('ticketsInstances')
    if (!ctx) {
      // Silenciar o warning se o elemento não existir ainda
      return
    }

    // Criar novo gráfico apenas se tivermos dados válidos
    if (labels.length > 0 && values.length > 0) {
      ChartTicketsInstances.value = createChart(ctx, 'doughnut', {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#22242e',
          borderWidth: 0,
          borderRadius: 8,
          spacing: 1
        }]
      }, {
        plugins: {
          legend: {
            position: 'right'
          }
        }
      })
    }
  } catch (error) {
    console.error('Erro ao carregar dados de instâncias:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de instâncias'
    })
    throw error // Propagar o erro para o loadDataWithParams
  }
}

const loadTicketsChannels = async (customParams = null) => {
  try {
    const paramsToSend = customParams || getParams()
    const response = await GetDashTicketsChannels(paramsToSend)
    if (!response?.data) {
      console.warn('Dados de canais não disponíveis')
      return
    }

    // Adaptar para aceitar tanto channel/count quanto label/qtd
    const validData = response.data
      .filter(item => item && (item.channel || item.label) && (item.count || item.qtd))
      .map(item => ({
        channel: item.channel || item.label || 'Não definido',
        count: Number(item.count || item.qtd) || 0
      }))
    if (validData.length === 0) {
      console.warn('Nenhum dado válido de canais encontrado')
      return
    }

    const labels = validData.map(item => item.channel || 'Não definido')
    const values = validData.map(item => item.count || 0)
    const colors = validData.map((_, index) => solidColors[index % solidColors.length])

    if (ChartTicketsChannels.value) {
      ChartTicketsChannels.value.destroy()
    }

    // Aguardar o próximo tick para garantir que o DOM foi renderizado
    await nextTick()

    const ctx = document.getElementById('ticketsChannels')
    if (!ctx) {
      // Silenciar o warning se o elemento não existir ainda
      return
    }

    ChartTicketsChannels.value = createChart(ctx, 'doughnut', {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#22242e',
        borderWidth: 0,
        borderRadius: 8,
        spacing: 1
      }]
    }, {

      plugins: {
        legend: {
          position: 'right'
        }
      }
    })
  } catch (error) {
    console.error('Erro ao carregar dados de canais:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de canais'
    })
  }
}

const loadData = async () => {
  await loadDataWithParams(getParams())
}

// Modificar a função loadDataWithParams para melhor controle de loading
const loadDataWithParams = async (customParams) => {
  // Se já estiver carregando, aguarda um momento e tenta novamente
  if (isLoading.value) {
    // Aguarda 100ms e tenta novamente
    await new Promise(resolve => setTimeout(resolve, 100))
    if (isLoading.value) {
      return
    }
  }

  try {
    isLoading.value = true

    if (!customParams.startDate || !customParams.endDate) {
      throw new Error('Parâmetros não definidos')
    }

    // Usar um Set para garantir que não há chamadas duplicadas
    const loadFunctions = new Set([
      () => loadTicketsChannels(customParams),
      () => loadTicketsEvolutionByPeriod(customParams),
      () => getDashTicketsPerUsersDetail(customParams),
      () => getDashTicketsAndTimes(customParams),
      () => getDashTicketsEvolutionChannels(customParams),
      () => loadTicketsEvolutionByQueue(customParams),
      () => loadTicketsInstances(customParams)
    ])

    // Converter Set para Array e executar as promessas
    const loadPromises = Array.from(loadFunctions).map(fn => fn())

    // Usar Promise.allSettled para lidar com erros individuais
    const results = await Promise.allSettled(loadPromises)

    // Verificar resultados
    const errors = results.filter(result => result.status === 'rejected')
    if (errors.length > 0) {
      console.warn('Alguns dados não puderam ser carregados:', errors)
      Notify.create({
        type: 'warning',
        message: 'Alguns dados não puderam ser carregados'
      })
    }
  } catch (error) {
    console.error('Erro ao carregar dados:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados do dashboard'
    })
  } finally {
    // Garantir que o loading seja resetado mesmo em caso de erro
    isLoading.value = false
  }
}

// Função auxiliar para criar gráficos
const createChart = (ctx, type, data, options) => {
  if (!ctx) {
    // Silenciar o warning se o contexto não existir
    return null
  }

  try {
    // Destruir gráfico existente se houver
    const existingChart = Chart.getChart(ctx)
    if (existingChart) {
      existingChart.destroy()
    }

    // Validar dados antes de criar o gráfico
    if (!data || !data.labels || !data.datasets) {
      console.warn('Dados inválidos para o gráfico:', data)
      return null
    }

    // Forçar a legenda padrão como desabilitada
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800 // Deixa a transição mais lenta e suave
      },
      plugins: {
        legend: {
          display: false, // Garante que a legenda padrão não será exibida
          labels: {
            generateLabels: () => [] // Garante que não será gerado nenhum item
          }
        },
        tooltip: {
          enabled: true
        }
      }
    }

    // Mesclar opções recebidas, mas sempre sobrescrever legend
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      plugins: {
        ...defaultOptions.plugins,
        ...(options && options.plugins),
        legend: {
          ...defaultOptions.plugins.legend,
          ...(options && options.plugins && options.plugins.legend),
          display: false,
          labels: {
            generateLabels: () => []
          }
        }
      }
    }

    const chart = new Chart(ctx, {
      type,
      data,
      options: mergedOptions
    })

    // Criar legenda personalizada
    if (type === 'doughnut' || type === 'pie') {
      const legendContainer = document.getElementById(ctx.id + 'Legend')
      if (legendContainer) {
        legendContainer.innerHTML = ''
        const ul = document.createElement('ul')
        ul.className = 'custom-legend'

        data.labels.forEach((label, index) => {
          const li = document.createElement('li')
          const color = data.datasets[0].backgroundColor[index]

          li.innerHTML = `
            <span class="legend-color" style="background-color: ${color}"></span>
            <span class="legend-label">${label}</span>
            <span class="legend-separator">:</span>
            <span class="legend-value">${data.datasets[0].data[index]}</span>
          `

          li.addEventListener('click', () => {
            const meta = chart.getDatasetMeta(0)
            meta.data[index].hidden = !meta.data[index].hidden
            chart.update()
            li.classList.toggle('legend-disabled', meta.data[index].hidden)
          })

          ul.appendChild(li)
        })

        legendContainer.appendChild(ul)
      }
    }

    return chart
  } catch (error) {
    console.error('Erro ao criar gráfico:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao criar gráfico'
    })
    return null
  }
}

// Função para destruir gráficos com tratamento de erro
const destroyChart = (chartRef) => {
  try {
    if (chartRef?.value) {
      const chart = Chart.getChart(chartRef.value.canvas)
      if (chart) {
        chart.destroy()
      }
      chartRef.value = null
    }
  } catch (error) {
    console.error('Erro ao destruir gráfico:', error)
  }
}

// Função para limpar todos os gráficos com tratamento de erro
const clearAllCharts = () => {
  try {
    destroyChart(ChartTicketsChannels)
    destroyChart(ChartTicketsInstances)
    destroyChart(ChartTicketsEvolutionByPeriod)
    destroyChart(ChartTicketsEvolutionByQueue)
    destroyChart(ChartTicketsEvolutionChannels)
    destroyChart(channelEvolutionChart)
  } catch (error) {
    console.error('Erro ao limpar gráficos:', error)
  }
}

// Limpar gráficos quando o componente for desmontado
onUnmounted(() => {
  clearAllCharts()
})

const loadChannelEvolutionData = async () => {
  try {
    if (!params.startDate || !params.endDate) {
      throw new Error('Parâmetros não definidos')
    }

    const response = await GetDashTicketsEvolutionChannels(params)
    if (response?.data) {
      const data = response.data
      if (!Array.isArray(data) || data.length === 0) {
        console.warn('Dados de evolução dos canais vazios ou inválidos')
        return
      }

      const dataLabel = groupBy(data, 'dt_referencia')
      const labels = Object.keys(dataLabel).sort()
      const dados = groupBy(data, d => d.label && d.label !== 'undefined' && d.label !== '' ? d.label : 'Não definido')

      // Definir cores modernas para cada canal (mover para fora do if e antes do for)
      const channelColors = {
        whatsapp: {
          background: 'rgb(37, 211, 102)',
          border: 'rgb(37, 211, 102)',
          hover: 'rgb(37, 211, 102)'
        },
        facebook: {
          background: 'rgb(24, 119, 242)',
          border: 'rgb(24, 119, 242)',
          hover: 'rgb(24, 119, 242)'
        },
        instagram: {
          background: 'rgb(228, 64, 95)',
          border: 'rgb(228, 64, 95)',
          hover: 'rgb(228, 64, 95)'
        },
        telegram: {
          background: 'rgb(0, 136, 204)',
          border: 'rgb(0, 136, 204)',
          hover: 'rgb(0, 136, 204)'
        },
        web: {
          background: 'rgb(76, 175, 80)',
          border: 'rgb(76, 175, 80)',
          hover: 'rgb(76, 175, 80)'
        },
        email: {
          background: 'rgb(234, 67, 53)',
          border: 'rgb(234, 67, 53)',
          hover: 'rgb(234, 67, 53)'
        },
        default: {
          background: 'rgb(156, 39, 176)',
          border: 'rgb(156, 39, 176)',
          hover: 'rgb(156, 39, 176)'
        }
      }

      const series = Object.keys(dados).map(channel => ({
        label: channel,
        data: labels.map(label => {
          const dayData = dados[channel]?.find(d => d.dt_referencia === label)
          return dayData ? Number(dayData.count || dayData.qtd || 0) : 0
        }),
        backgroundColor: channelColors[channel]?.background || channelColors.default.background,
        borderColor: channelColors[channel]?.border || channelColors.default.border,
        hoverBackgroundColor: channelColors[channel]?.hover || channelColors.default.hover,
        borderWidth: 0,
        borderRadius: 4
      }))

      // Aguardar o próximo tick para garantir que o DOM foi renderizado
      await nextTick()

      const ctx = document.getElementById('channelEvolutionChart')
      if (!ctx) {
        // Silenciar o warning se o elemento não existir ainda
        return
      }

      channelEvolutionChart.value = createChart(ctx, 'bar', {
        labels,
        datasets: series.map(s => ({
          ...s,
          barThickness: 40, // largura máxima da barra
          maxBarThickness: 60, // largura máxima absoluta
          minBarLength: 2, // comprimento mínimo para visualização
          categoryPercentage: 0.5, // espaçamento entre categorias
          barPercentage: 0.7 // espaçamento entre barras
        }))
      }, {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'bottom-right',
            align: 'center',
            labels: {
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            displayColors: true,
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || ''
                const value = context.parsed.y || 0
                return `${label}: ${value} atendimentos`
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 10
            },
            title: {
              display: true,
              text: 'Quantidade de Tickets',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: { top: 10, bottom: 10 }
            }
          },
          x: {
            stacked: true,
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 10,
              maxRotation: 45,
              minRotation: 45
            },
            title: {
              display: true,
              text: 'Data',
              font: {
                size: 14,
                weight: 'bold'
              },
              padding: { top: 10, bottom: 10 }
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      })
    }
  } catch (error) {
    console.error('Erro ao carregar dados de evolução dos canais:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de evolução dos canais',
      position: 'bottom-right',
      timeout: 5000
    })
  }
}

// eslint-disable-next-line no-unused-vars
function formatMinutes (time) {
  if (!time || typeof time !== 'object') return '-'
  const min = Number(time.minutes) || 0
  const sec = Number(time.seconds) || 0
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) {
    return `${h}h ${m}min${sec > 0 ? ' ' + sec + 's' : ''}`
  }
  if (m > 0) {
    return `${m}min${sec > 0 ? ' ' + sec + 's' : ''}`
  }
  return `${sec}s`
}

onMounted(async () => {
  try {
    // Bloquear seleção e cópia
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
    document.body.style.msUserSelect = 'none'
    document.body.style.mozUserSelect = 'none'
    // Bloqueia Ctrl+C, Ctrl+X, Ctrl+A
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
    })
    // Bloqueia botão direito do mouse
    document.addEventListener('contextmenu', function (e) {
      e.preventDefault()
    })
    // Garantir que params está definido
    if (!params.startDate || !params.endDate) {
      params.startDate = startDate.toISOString()
      params.endDate = endDate.toISOString()
      params.queuesIds = []
    }

    await listarFilas()

    // Aguardar o próximo tick para garantir que o DOM foi renderizado
    await nextTick()

    // Carregar dados em paralelo para melhor performance
    await Promise.allSettled([
      loadData(),
      loadChannelEvolutionData(),
      loadTicketsEvolutionByPeriod(),
      loadTicketsEvolutionByQueue(),
      loadTicketsChannels()
    ])
  } catch (error) {
    console.error('Erro ao inicializar dashboard:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao inicializar dashboard'
    })
  }
})

// Modificar o watch para ser mais resiliente
watch(
  () => [params.startDate, params.endDate],
  debounce(async ([start, end]) => {
    if (!start || !end) return

    const formattedStart = start.split('T')[0]
    const formattedEnd = end.split('T')[0]

    // Em vez de modificar params diretamente, vamos apenas chamar loadData com as datas formatadas
    const paramsToSend = {
      ...params,
      startDate: formattedStart,
      endDate: formattedEnd
    }

    // Carregar dados com os parâmetros formatados
    await loadDataWithParams(paramsToSend)
  }, 300)
)
</script>
