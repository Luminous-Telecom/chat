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
            <q-datetime-picker
              class="modern-input"
              dense
              outlined
              stack-label
              label="Data Inicial"
              mode="date"
              color="primary"
              v-model="params.startDate"
            >
              <template v-slot:prepend>
                <q-icon name="mdi-calendar-start" />
              </template>
            </q-datetime-picker>
          </div>

          <div class="filter-item">
            <q-datetime-picker
              class="modern-input"
              dense
              outlined
              stack-label
              label="Data Final"
              mode="date"
              color="primary"
              v-model="params.endDate"
            >
              <template v-slot:prepend>
                <q-icon name="mdi-calendar-end" />
              </template>
            </q-datetime-picker>
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
            <div class="chart-content">
              <canvas id="ticketsChannels" class="pizza-chart"></canvas>
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
            <div class="chart-content">
              <canvas id="ticketsInstances" class="pizza-chart"></canvas>
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
            <div class="chart-content">
              <canvas id="ticketsEvolutionByQueue" class="pizza-chart"></canvas>
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
              :data="ticketsPerUsersDetail"
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
            :data="ticketsPerUsersDetail"
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
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { Notify } from 'quasar'
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
  BarElement
} from 'chart.js'
import { ListarFilas } from 'src/service/filas'
import {
  GetDashTicketsPerUsersDetail,
  GetDashTicketsAndTimes,
  GetDashTicketsEvolutionChannels,
  GetDashTicketsInstances,
  GetDashTicketsEvolutionByPeriod,
  GetDashTicketsEvolutionByQueue,
  GetDashTicketsChannels,
  GetDashTicketsQueue
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
  BarElement
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
const ChartTicketsQueue = ref(null)
const ChartTicketsEvolutionByPeriod = ref(null)
const ChartTicketsEvolutionByQueue = ref(null)
const ChartTicketsInstances = ref(null)
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
    position: 'top'
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

const getChannelColor = (channel) => {
  if (!channel) return 'rgba(156, 39, 176, 0.2)' // cor padrão para canais indefinidos

  const colors = {
    whatsapp: 'rgba(37, 211, 102, 0.2)', // Verde WhatsApp
    facebook: 'rgba(24, 119, 242, 0.2)', // Azul Facebook
    instagram: 'rgba(228, 64, 95, 0.2)', // Rosa Instagram
    telegram: 'rgba(0, 136, 204, 0.2)', // Azul Telegram
    web: 'rgba(76, 175, 80, 0.2)', // Verde Web
    email: 'rgba(234, 67, 53, 0.2)', // Vermelho Email
    default: 'rgba(156, 39, 176, 0.2)' // Roxo padrão
  }
  return colors[channel.toLowerCase()] || colors.default
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
    const res = await GetDashTicketsAndTimes(params)
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
  GetDashTicketsEvolutionChannels(params).then(res => {
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
    const dados = groupBy(ticketsEvolutionChannels.value, 'label')

    for (const item in dados) {
      if (Array.isArray(dados[item])) {
        const dataPoints = labels.map(label => {
          const point = dados[item].find(d => d.dt_referencia === label)
          return point ? Number(point.qtd) || 0 : 0
        })
        series.push({
          name: item,
          data: dataPoints
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
    const response = await GetDashTicketsEvolutionByPeriod(params)
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
            fill: true
          },
          {
            label: 'Tickets Resolvidos',
            data: resolved,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true
          }
        ]
      }, {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Quantidade de Tickets'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Data'
            }
          }
        }
      })
    }
  } catch (error) {
    console.error('Erro ao carregar dados de evolução por período:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de evolução por período'
    })
  }
}

const getDashTicketsPerUsersDetail = async () => {
  try {
    const res = await GetDashTicketsPerUsersDetail(params)
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

const loadTicketsEvolutionByQueue = async () => {
  try {
    const response = await GetDashTicketsEvolutionByQueue(params)

    if (response?.data && response.data.length > 0) {
      // Tratar caso especial: resposta vem como objeto 'queues'
      let dataArr = response.data
      if (Array.isArray(dataArr) && dataArr.length === 1 && dataArr[0].queues && typeof dataArr[0].queues === 'object') {
        // Extrair as filas do objeto 'queues'
        dataArr = Object.entries(dataArr[0].queues).map(([queue, qtd]) => ({
          queue: queue || 'Não definido',
          count: Number(qtd) || 0
        }))
      }
      // Adaptar para aceitar queue/count, label/qtd ou qualquer campo de nome para fila e quantidade
      const validData = dataArr
        .filter(item => item && (item.queue || item.label || item.fila) && (item.count || item.qtd))
        .map(item => ({
          queue: item.queue || item.label || item.fila || 'Não definido',
          count: Number(item.count || item.qtd) || 0
        }))
      if (validData.length === 0) {
        console.warn('Nenhum dado válido de filas encontrado')
        return
      }

      const labels = validData.map(item => item.queue || 'Não definido')
      const values = validData.map(item => item.count || 0)
      const colors = validData.map((_, index) => solidColors[index % solidColors.length])
      if (ChartTicketsEvolutionByQueue.value) {
        ChartTicketsEvolutionByQueue.value.destroy()
      }
      const ctx = document.getElementById('ticketsEvolutionByQueue')
      if (ctx) {
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
              position: 'right'
            }
          }
        })
      }
    }
  } catch (error) {
    console.error('Erro ao carregar dados de evolução por fila:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de evolução por fila'
    })
  }
}

const loadTicketsInstances = async () => {
  try {
    const response = await GetDashTicketsInstances(params)

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

    destroyChart(ChartTicketsInstances)

    const ctx = document.getElementById('ticketsInstances')
    if (!ctx) {
      console.warn('Canvas de instâncias não encontrado')
      return
    }

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
  } catch (error) {
    console.error('Erro ao carregar dados de instâncias:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de instâncias'
    })
  }
}

const loadTicketsQueue = async () => {
  try {
    const response = await GetDashTicketsQueue(params)
    if (response?.data && response.data.length > 0) {
      const labels = response.data.map(item => item.queue)
      const values = response.data.map(item => item.count)
      const colors = response.data.map((_, index) => solidColors[index % solidColors.length])
      if (ChartTicketsQueue.value) {
        ChartTicketsQueue.value.destroy()
      }
      const ctx = document.getElementById('ticketsQueue')
      if (ctx) {
        ChartTicketsQueue.value = createChart(ctx, 'doughnut', {
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
    }
  } catch (error) {
    console.error('Erro ao carregar dados de filas:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de filas'
    })
  }
}

const loadTicketsChannels = async () => {
  try {
    const response = await GetDashTicketsChannels(params)
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

    const ctx = document.getElementById('ticketsChannels')
    if (!ctx) {
      console.warn('Canvas de canais não encontrado')
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
  try {
    // Verificar se params está definido
    if (!params.startDate || !params.endDate) {
      throw new Error('Parâmetros não definidos')
    }

    // Carregar dados em paralelo com tratamento de erro individual
    const loadPromises = [
      loadTicketsChannels(),
      loadTicketsQueue(),
      loadTicketsEvolutionByPeriod(),
      getDashTicketsPerUsersDetail(),
      getDashTicketsAndTimes(),
      getDashTicketsEvolutionChannels(),
      loadTicketsEvolutionByQueue()
    ]

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
  }
}

// Função auxiliar para criar gráficos
const createChart = (ctx, type, data, options) => {
  if (!ctx) {
    console.warn('Contexto do canvas não encontrado')
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

    // Criar novo gráfico com configurações padrão
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 0 // Desabilitar animações para melhor performance
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          enabled: true
        }
      }
    }

    const chart = new Chart(ctx, {
      type,
      data,
      options: {
        ...defaultOptions,
        ...options
      }
    })

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
    destroyChart(ChartTicketsQueue)
    destroyChart(ChartTicketsEvolutionByPeriod)
    destroyChart(ChartTicketsEvolutionByQueue)
    destroyChart(ChartTicketsInstances)
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
      const dados = groupBy(data, 'label')

      const series = []
      for (const item in dados) {
        if (Array.isArray(dados[item])) {
          const dataPoints = labels.map(label => {
            const point = dados[item].find(d => d.dt_referencia === label)
            return point ? Number(point.qtd) || 0 : 0
          })
          series.push({
            name: item,
            data: dataPoints
          })
        }
      }

      if (channelEvolutionChart.value) {
        channelEvolutionChart.value.destroy()
      }

      const ctx = document.getElementById('channelEvolutionChart')
      if (!ctx) {
        console.warn('Canvas de evolução dos canais não encontrado')
        return
      }

      channelEvolutionChart.value = createChart(ctx, 'bar', {
        labels,
        datasets: series.map(s => ({
          label: s.name,
          data: s.data,
          backgroundColor: getChannelColor(s.name),
          borderColor: getChannelColor(s.name).replace('0.2', '1'),
          borderWidth: 1
        }))
      }, {
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
            title: {
              display: true,
              text: 'Quantidade de Tickets'
            }
          },
          x: {
            stacked: true,
            title: {
              display: true,
              text: 'Data'
            }
          }
        }
      })
    }
  } catch (error) {
    console.error('Erro ao carregar dados de evolução dos canais:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao carregar dados de evolução dos canais'
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
    // Garantir que params está definido
    if (!params.startDate || !params.endDate) {
      params.startDate = startDate.toISOString()
      params.endDate = endDate.toISOString()
      params.queuesIds = []
    }

    await listarFilas()
    await loadData()
    await loadChannelEvolutionData()
    await loadTicketsEvolutionByPeriod()
    await loadTicketsInstances()
    await loadTicketsEvolutionByQueue()
    await loadTicketsChannels()
  } catch (error) {
    console.error('Erro ao inicializar dashboard:', error)
    Notify.create({
      type: 'negative',
      message: 'Erro ao inicializar dashboard'
    })
  }
})
</script>

<style lang="scss" scoped>
.modern-dashboard {
  min-height: 100vh;
  background: linear-gradient(135deg, $grey-1 0%, $grey-3 100%);
  padding: 0;

  .body--dark & {
    background: linear-gradient(135deg, $dark-primary 0%, $dark-secondary 100%);
  }
}

// Header Section
.dashboard-header {
  background: rgba($white, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba($black, 0.05);
  padding: 1.5rem;
  margin-bottom: 2rem;

  .body--dark & {
    background: rgba($dark-primary, 0.95);
    border-bottom: 1px solid rgba($white, 0.1);
  }

  .header-content {
    margin: 0 auto;
  }
}

.dashboard-title {
  font-size: 2rem;
  font-weight: 700;
  color: $dark;
  margin: 0 0 1.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;

  .body--dark & {
    color: $dark-text-secondary;
  }

  .title-icon {
    color: $primary;
    font-size: 2.25rem;
  }
}

.filters-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.filter-item {
  flex: 1;
  min-width: 200px;

  &.filter-select {
    min-width: 280px;
  }

  @media (max-width: 768px) {
    min-width: 100%;
  }
}

.modern-input {
  .q-field__control {
    border-radius: 12px;
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 4px 12px rgba($primary, 0.15);
    }
  }
}

.update-btn {
  height: 48px;
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  padding: 0 2rem;
  box-shadow: 0 4px 12px rgba($primary, 0.3);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba($primary, 0.4);
  }
}

// Metrics Section
.metrics-section {
  margin: 0 auto 2rem;
  padding: 0 1.5rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.metric-card {
  background: $white;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba($black, 0.1), 0 2px 4px -1px rgba($black, 0.06);
  border: 1px solid rgba($black, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba($black, 0.1), 0 10px 10px -5px rgba($black, 0.04);
  }

  .body--dark & {
    background: $dark-secondary;
    border: 1px solid rgba($white, 0.1);
    color: $dark-text-primary;
  }
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: $blue-1;
  border-radius: 10px;
  color: $primary;

  .body--dark & {
    background: rgba($primary, 0.1);
  }

  .q-icon {
    font-size: 1.25rem;
  }
}

.metric-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: $grey-6;
  text-transform: uppercase;
  letter-spacing: 0.025em;

  .body--dark & {
    color: $grey-5;
  }
}

.metric-value {
  font-size: 2.25rem;
  font-weight: 700;
  color: $dark;
  margin-bottom: 0.5rem;
  line-height: 1;

  &.time-value {
    font-size: 1.75rem;
  }

  .body--dark & {
    color: $dark-text-secondary;
  }
}

.metric-trend {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;

  .trend-icon {
    font-size: 1rem;

    &.positive {
      color: $positive;
    }

    &.negative {
      color: $negative;
    }
  }

  span {
    color: $grey-6;

    .body--dark & {
      color: $grey-5;
    }
  }
}

// Charts Section
.charts-section {
  margin: 0 auto;
  padding: 0 1.5rem;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 1rem 0;
}

.chart-container,
.chart-full-width {
  width: 100%;
}

.chart-full-width {
  margin-bottom: 1.5rem;
}

.chart-card {
  background: $white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba($black, 0.1), 0 2px 4px -1px rgba($black, 0.06);
  border: 1px solid rgba($black, 0.05);
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 25px -5px rgba($black, 0.1), 0 10px 10px -5px rgba($black, 0.04);
  }

  .body--dark & {
    background: $dark-secondary;
    border: 1px solid rgba($white, 0.1);
  }
}

.chart-header {
  background: $grey-1;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba($black, 0.05);

  .body--dark & {
    background: $dark-primary;
    border-bottom: 1px solid rgba($white, 0.1);
  }
}

.chart-title {
  font-size: 1rem;
  font-weight: 600;
  color: $dark;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .body--dark & {
    color: $dark-text-secondary;
  }

  .q-icon {
    color: $primary;
    font-size: 1.125rem;
  }
}

.chart-content {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  min-width: 300px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: $grey-6;

  .body--dark & {
    color: $grey-5;
  }

  p {
    margin: 1rem 0 0;
    font-size: 0.875rem;
    font-weight: 500;
  }
}

// Table Section
.table-section {
  margin-top: 1.5rem;
}

.table-card {
  background: $white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba($black, 0.1), 0 2px 4px -1px rgba($black, 0.06);
  border: 1px solid rgba($black, 0.05);
  overflow: hidden;

  .body--dark & {
    background: $dark-secondary;
    border: 1px solid rgba($white, 0.1);
  }
}

.table-header {
  background: $grey-1;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba($black, 0.05);

  .body--dark & {
    background: $dark-primary;
    border-bottom: 1px solid rgba($white, 0.1);
  }
}

.table-title {
  font-size: 1rem;
  font-weight: 600;
  color: $dark;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .body--dark & {
    color: $dark-text-secondary;
  }

  .q-icon {
    color: $primary;
    font-size: 1.125rem;
  }
}

.table-content {
  padding: 0;
}

.modern-table {
  .q-table__top {
    display: none;
  }

  .q-table thead th {
    background: $grey-1;
    color: $grey-8;
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    padding: 1rem;

    .body--dark & {
      background: $dark-primary;
      color: $grey-4;
    }
  }

  .q-table tbody td {
    padding: 1rem;
    border-bottom: 1px solid $grey-2;

    .body--dark & {
      border-bottom: 1px solid rgba($white, 0.1);
    }
  }
}

.user-cell {
  padding: 0.75rem 1rem !important;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: $blue-1;
  border-radius: 50%;
  color: $primary;

  .body--dark & {
    background: rgba($primary, 0.1);
  }

  .q-icon {
    font-size: 1.25rem;
  }
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 600;
  color: $dark;
  margin-bottom: 0.125rem;

  .body--dark & {
    color: $dark-text-secondary;
  }
}

.user-email {
  font-size: 0.75rem;
  color: $grey-6;

  .body--dark & {
    color: $grey-5;
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .dashboard-header {
    padding: 1rem;
  }

  .dashboard-title {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }

  .metrics-section,
  .charts-section {
    padding: 0 1rem;
  }

  .metric-card {
    padding: 1rem;
  }

  .metric-value {
    font-size: 1.75rem;

    &.time-value {
      font-size: 1.25rem;
    }
  }

  .chart-header,
  .table-header {
    padding: 1rem;
  }

  .chart-content {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  .dashboard-header {
    padding: 0.75rem;
  }

  .dashboard-title {
    font-size: 1.25rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .metrics-section,
  .charts-section {
    padding: 0 0.75rem;
  }

  .metric-card {
    padding: 0.75rem;
  }

  .metric-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .metric-value {
    font-size: 1.5rem;

    &.time-value {
      font-size: 1.125rem;
    }
  }

  .chart-header,
  .table-header {
    padding: 0.75rem;
  }

  .chart-content {
    padding: 0.75rem;
  }

  .modern-table {
    .q-table thead th,
    .q-table tbody td {
      padding: 0.5rem;
      font-size: 0.75rem;
    }
  }

  .user-avatar {
    width: 32px;
    height: 32px;

    .q-icon {
      font-size: 1rem;
    }
  }
}

// Smooth transitions for dark mode
* {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

.table-section {
  margin-top: 2rem;
  padding: 0 1rem;
}

.tickets-table {
  width: 100%;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  :deep(.q-table__top) {
    padding: 1rem;
  }

  :deep(.q-table__bottom) {
    padding: 1rem;
  }

  :deep(.q-table thead th) {
    font-weight: 600;
    color: #666;
    background: #f5f5f5;
  }

  :deep(.q-table tbody td) {
    color: #333;
  }
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .q-avatar {
    background: #e3f2fd;
    color: #1976d2;
  }
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #666;
  gap: 0.5rem;

  .q-icon {
    color: #999;
  }
}

.pizza-chart {
  width: 260px !important;
  height: 260px !important;
  max-width: 100%;
  max-height: 100%;
  margin: 0 auto;
  display: block;
}

</style>
