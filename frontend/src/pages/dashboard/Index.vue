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
          <div class="metric-value time-value">{{ cTmaFormat }}</div>

        </div>

        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon">
              <q-icon name="mdi-timer-outline" />
            </div>
            <span class="metric-title">TME</span>
          </div>
          <div class="metric-value time-value">{{ cTmeFormat }}</div>

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
              <ApexChart
                v-if="ticketsChannelsOptions.series && ticketsChannelsOptions.series.length > 0"
                ref="ChartTicketsChannels"
                type="donut"
                height="280"
                width="100%"
                :options="ticketsChannelsOptions"
                :series="ticketsChannelsOptions.series"
              />
              <div v-else class="loading-state">
                <q-spinner-dots size="2rem" color="primary" />
                <p>Carregando dados...</p>
              </div>
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
              <ApexChart
                v-if="ticketsInstancesOptions.series && ticketsInstancesOptions.series.length > 0"
                ref="ChartTicketsInstances"
                type="donut"
                height="280"
                width="100%"
                :options="ticketsInstancesOptions"
                :series="ticketsInstancesOptions.series"
              />
              <div v-else class="loading-state">
                <q-spinner-dots size="2rem" color="primary" />
                <p>Carregando dados...</p>
              </div>
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
              <ApexChart
                v-if="ticketsQueueOptions.series && ticketsQueueOptions.series.length > 0"
                ref="ChartTicketsQueue"
                type="donut"
                height="280"
                width="100%"
                :options="ticketsQueueOptions"
                :series="ticketsQueueOptions.series"
              />
              <div v-else class="loading-state">
                <q-spinner-dots size="2rem" color="primary" />
                <p>Carregando dados...</p>
              </div>
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
            <ApexChart
              v-if="ticketsEvolutionChannelsOptions.series && ticketsEvolutionChannelsOptions.series.length > 0"
              ref="ChartTicketsEvolutionChannels"
              type="bar"
              height="350"
              width="100%"
              :options="ticketsEvolutionChannelsOptions"
              :series="ticketsEvolutionChannelsOptions.series"
            />
            <div v-else class="loading-state">
              <q-spinner-dots size="2rem" color="primary" />
              <p>Carregando dados...</p>
            </div>
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
            <ApexChart
              v-if="ticketsEvolutionByPeriodOptions.series && ticketsEvolutionByPeriodOptions.series.length > 0"
              ref="ChartTicketsEvolutionByPeriod"
              type="line"
              height="350"
              :options="ticketsEvolutionByPeriodOptions"
              :series="ticketsEvolutionByPeriodOptions.series"
            />
            <div v-else class="loading-state">
              <q-spinner-dots size="2rem" color="primary" />
              <p>Carregando dados...</p>
            </div>
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
            <ApexChart
              v-if="ticketsPerUsersDetailOptions.series && ticketsPerUsersDetailOptions.series.length > 0"
              ref="ChartTicketsPerUsersDetail"
              type="bar"
              height="350"
              :options="ticketsPerUsersDetailOptions"
              :series="ticketsPerUsersDetailOptions.series"
            />
            <div v-else class="loading-state">
              <q-spinner-dots size="2rem" color="primary" />
              <p>Carregando dados...</p>
            </div>
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
              :columns="TicketsPerUsersDetailColumn"
              row-key="email"
              :pagination.sync="paginationTableUser"
              :rows-per-page-options="[10, 25, 50]"
              flat
              bordered
              class="modern-table"
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
  </div>
</template>

<script>
import { groupBy } from 'lodash'
import { ListarFilas } from 'src/service/filas'
import {
  GetDashTicketsAndTimes,
  GetDashTicketsChannels,
  GetDashTicketsEvolutionChannels,
  GetDashTicketsQueue,
  GetDashTicketsEvolutionByPeriod,
  GetDashTicketsPerUsersDetail
} from 'src/service/estatisticas'
import { formatDuration } from 'date-fns'
import ApexChart from 'vue-apexcharts'
import { GetDashTicketsInstances } from 'src/service/dashboard'

export default {
  name: 'Dashboard',
  components: {
    ApexChart
  },
  data () {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(today)
    endDate.setHours(23, 59, 59, 999)

    const baseChartOptions = {
      chart: {
        type: 'donut',
        fontFamily: 'Roboto, sans-serif',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        },
        toolbar: {
          show: false
        }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            background: 'transparent',
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '16px',
                fontFamily: 'Roboto, sans-serif',
                fontWeight: 600,
                color: '#666',
                offsetY: -10
              },
              value: {
                show: true,
                fontSize: '24px',
                fontFamily: 'Roboto, sans-serif',
                fontWeight: 700,
                color: '#1976d2',
                offsetY: 5
              },
              total: {
                show: true,
                label: 'Total',
                fontSize: '14px',
                fontFamily: 'Roboto, sans-serif',
                fontWeight: 600,
                color: '#666'
              }
            }
          }
        }
      },
      legend: {
        position: 'bottom',
        horizontalAlign: 'center',
        floating: false,
        fontSize: '13px',
        fontFamily: 'Roboto, sans-serif',
        fontWeight: 500,
        markers: {
          width: 12,
          height: 12,
          radius: 6
        },
        itemMargin: {
          horizontal: 10,
          vertical: 5
        }
      },
      stroke: {
        width: 0,
        show: true
      },
      dataLabels: {
        enabled: false
      },
      tooltip: {
        enabled: true,
        theme: 'light',
        style: {
          fontSize: '13px',
          fontFamily: 'Roboto, sans-serif'
        },
        y: {
          formatter: function (value) {
            return value + ' atendimentos'
          }
        }
      },
      colors: ['#1976d2', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9', '#bbdefb'],
      responsive: [{
        breakpoint: 480,
        options: {
          chart: {
            height: 280
          },
          legend: {
            position: 'bottom',
            offsetY: 0
          }
        }
      }]
    }

    return {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        queuesIds: []
      },
      paginationTableUser: {
        rowsPerPage: 10,
        rowsNumber: 0,
        lastIndex: 0
      },
      filas: [],
      ticketsChannels: [],
      ticketsChannelsOptions: {
        ...baseChartOptions,
        labels: []
      },
      ticketsQueue: [],
      ticketsQueueOptions: {
        ...baseChartOptions,
        labels: []
      },
      ticketsEvolutionChannels: [],
      ticketsEvolutionChannelsOptions: {
        chart: {
          type: 'bar',
          stacked: true,
          toolbar: { show: false }
        },

        dataLabels: {
          enabled: false
        },
        series: [{
          name: 'Carregando...',
          data: [0]
        }],
        xaxis: {
          categories: ['Carregando...']
        },
        yaxis: {
          title: {
            text: 'Atendimentos'
          }
        },
        legend: {
          position: 'top'
        }
      },
      ticketsEvolutionByPeriod: [],
      ticketsEvolutionByPeriodOptions: {
        chart: {
          toolbar: { show: false }
        },

        dataLabels: {
          enabled: false
        },
        series: [{
          name: 'Atendimentos',
          type: 'column',
          data: [0]
        }, {
          type: 'line',
          data: [0]
        }],
        xaxis: {
          categories: ['Carregando...']
        },
        yaxis: {
          title: {
            text: 'Atendimentos'
          }
        },
        legend: {
          show: false
        }
      },
      ticketsAndTimes: {
        qtd_total_atendimentos: null,
        qtd_demanda_ativa: null,
        qtd_demanda_receptiva: null,
        new_contacts: null,
        tma: null,
        tme: null
      },
      ticketsPerUsersDetail: [],
      TicketsPerUsersDetailColumn: [
        {
          name: 'name',
          label: 'Usuário',
          field: 'name',
          align: 'left',
          style: 'width: 250px;'
        },
        {
          name: 'qtd_pendentes',
          label: 'Pendentes',
          field: 'qtd_pendentes',
          align: 'center'
        },
        {
          name: 'qtd_em_atendimento',
          label: 'Atendendo',
          field: 'qtd_em_atendimento',
          align: 'center'
        },
        {
          name: 'qtd_resolvidos',
          label: 'Finalizados',
          field: 'qtd_resolvidos',
          align: 'center'
        },
        {
          name: 'qtd_por_usuario',
          label: 'Total',
          field: 'qtd_por_usuario',
          align: 'center'
        },
        {
          name: 'tme',
          label: 'T.M.E',
          field: 'tme',
          align: 'center',
          format: v => formatDuration(v) || ''
        },
        {
          name: 'tma',
          label: 'T.M.A',
          field: 'tma',
          align: 'center',
          format: v => formatDuration(v) || ''
        }
      ],
      ticketsPerUsersDetailOptions: {
        series: [{
          name: 'Carregando...',
          data: [0]
        }],
        chart: {
          type: 'bar',
          toolbar: { show: false }
        },

        xaxis: {
          categories: ['Carregando...']
        },
        yaxis: {
          title: {
            text: 'Atendimentos'
          }
        }
      },
      ticketsInstances: [],
      ticketsInstancesOptions: {
        ...baseChartOptions,
        labels: [],
        series: [],
        chart: {
          ...baseChartOptions.chart,
          type: 'donut',
          height: 280,
          width: '100%'
        }
      },
      loadingInstances: false
    }
  },
  computed: {
    cTmaFormat () {
      const tma = this.ticketsAndTimes.tma || {}
      return formatDuration(tma) || '0min'
    },
    cTmeFormat () {
      const tme = this.ticketsAndTimes.tme || {}
      return formatDuration(tme) || '0min'
    }
  },
  methods: {
    async listarFilas () {
      try {
        const { data } = await ListarFilas()
        this.filas = data
      } catch (error) {
        console.error('Erro ao carregar filas:', error)
      }
    },
    getDashTicketsAndTimes () {
      GetDashTicketsAndTimes(this.params).then(res => {
        this.ticketsAndTimes = (res.data && res.data[0]) || {
          qtd_total_atendimentos: 0,
          qtd_demanda_ativa: 0,
          qtd_demanda_receptiva: 0,
          new_contacts: 0
        }
      }).catch(_err => {
        this.ticketsAndTimes = {
          qtd_total_atendimentos: 0,
          qtd_demanda_ativa: 0,
          qtd_demanda_receptiva: 0,
          new_contacts: 0
        }
      })
    },
    async getDashTicketsQueue () {
      try {
        const res = await GetDashTicketsQueue(this.params)
        const series = []
        const labels = []

        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          this.ticketsQueue = res.data
          res.data.forEach(e => {
            if (e?.qtd != null && e?.label) {
              series.push(Number(e.qtd) || 0)
              labels.push(String(e.label) || 'Não informado')
            }
          })
        }

        if (series.length === 0) {
          series.push(0)
          labels.push('Sem dados')
        }

        this.ticketsQueueOptions = {
          ...this.ticketsQueueOptions,
          series,
          labels
        }

        if (this.$refs.ChartTicketsQueue) {
          await this.$nextTick()
          this.$refs.ChartTicketsQueue.updateOptions(this.ticketsQueueOptions)
          this.$refs.ChartTicketsQueue.updateSeries(series, true)
        }
      } catch (err) {
        console.error('Erro ao carregar dados da fila:', err)
      }
    },
    getDashTicketsChannels () {
      GetDashTicketsChannels(this.params).then(res => {
        this.ticketsChannels = res.data || []
        const series = []
        const labels = []

        if (Array.isArray(this.ticketsChannels) && this.ticketsChannels.length > 0) {
          this.ticketsChannels.forEach(e => {
            if (e && e.qtd !== undefined && e.label) {
              series.push(+e.qtd)
              labels.push(e.label)
            }
          })
        }

        if (series.length === 0) {
          series.push(0)
          labels.push('Sem dados')
        }

        this.ticketsChannelsOptions.series = series
        this.ticketsChannelsOptions.labels = labels

        if (this.$refs.ChartTicketsChannels) {
          this.$refs.ChartTicketsChannels.updateOptions(this.ticketsChannelsOptions)
          this.$refs.ChartTicketsChannels.updateSeries(series, true)
        }
      }).catch(_err => {
        console.error('Erro ao carregar dados dos canais:', _err)
      })
    },
    getDashTicketsEvolutionChannels () {
      GetDashTicketsEvolutionChannels(this.params).then(res => {
        this.ticketsEvolutionChannels = res.data || []

        if (!Array.isArray(this.ticketsEvolutionChannels) || this.ticketsEvolutionChannels.length === 0) {
          this.ticketsEvolutionChannelsOptions.series = [{
            name: 'Sem dados',
            data: [0]
          }]
          this.ticketsEvolutionChannelsOptions.xaxis.categories = ['Sem dados']
          if (this.$refs.ChartTicketsEvolutionChannels) {
            this.$refs.ChartTicketsEvolutionChannels.updateOptions(this.ticketsEvolutionChannelsOptions)
            this.$refs.ChartTicketsEvolutionChannels.updateSeries(this.ticketsEvolutionChannelsOptions.series, true)
          }
          return
        }

        const dataLabel = groupBy({ ...this.ticketsEvolutionChannels }, 'dt_referencia')
        const labels = Object.keys(dataLabel)

        this.ticketsEvolutionChannelsOptions.labels = labels
        this.ticketsEvolutionChannelsOptions.xaxis.categories = labels
        const series = []
        const dados = groupBy({ ...this.ticketsEvolutionChannels }, 'label')

        for (const item in dados) {
          if (Array.isArray(dados[item])) {
            series.push({
              name: item,
              data: dados[item].map(d => d && d.qtd !== undefined ? d.qtd : 0)
            })
          }
        }

        if (!series || series.length === 0) {
          series.push({
            name: 'Sem dados',
            data: [0]
          })
        }

        this.ticketsEvolutionChannelsOptions.series = series
        if (this.$refs.ChartTicketsEvolutionChannels) {
          this.$refs.ChartTicketsEvolutionChannels.updateOptions(this.ticketsEvolutionChannelsOptions)
          this.$refs.ChartTicketsEvolutionChannels.updateSeries(series, true)
        }
      }).catch(_error => {
        console.error('Erro ao carregar evolução dos canais:', _error)
      })
    },
    getDashTicketsEvolutionByPeriod () {
      GetDashTicketsEvolutionByPeriod(this.params).then(res => {
        this.ticketsEvolutionByPeriod = res.data || []

        const series = [{
          name: 'Atendimentos',
          type: 'column',
          data: []
        }, {
          type: 'line',
          data: []
        }]

        const labels = []

        if (Array.isArray(this.ticketsEvolutionByPeriod) && this.ticketsEvolutionByPeriod.length > 0) {
          this.ticketsEvolutionByPeriod.forEach(e => {
            if (e && e.qtd !== undefined && e.label) {
              series[0].data.push(+e.qtd)
              labels.push(e.label)
            }
          })
        }

        if (series[0].data.length === 0) {
          series[0].data.push(0)
          labels.push('Sem dados')
        }

        series[1].data = series[0].data
        this.ticketsEvolutionByPeriodOptions.labels = labels
        this.ticketsEvolutionByPeriodOptions.series = series

        if (this.$refs.ChartTicketsEvolutionByPeriod) {
          this.$refs.ChartTicketsEvolutionByPeriod.updateOptions(this.ticketsEvolutionByPeriodOptions)
          this.$refs.ChartTicketsEvolutionByPeriod.updateSeries(series, true)
        }
      }).catch(_error => {
        console.error('Erro ao carregar evolução por período:', _error)
      })
    },
    getDashTicketsPerUsersDetail () {
      GetDashTicketsPerUsersDetail(this.params).then(res => {
        this.ticketsPerUsersDetail = res.data || []
      }).catch(_error => {
        this.ticketsPerUsersDetail = []
        console.error('Erro ao carregar detalhes dos usuários:', _error)
      })
    },
    async getDashTicketsInstances () {
      this.loadingInstances = true
      try {
        const { data } = await GetDashTicketsInstances(this.params)
        const series = []
        const labels = []

        if (data && Array.isArray(data) && data.length > 0) {
          data.forEach(item => {
            if (item?.qtd != null && item?.whatsapp) {
              series.push(Number(item.qtd) || 0)
              labels.push(String(item.whatsapp) || 'Não informado')
            }
          })
        }

        if (series.length === 0) {
          series.push(0)
          labels.push('Sem dados')
        }

        this.ticketsInstancesOptions = {
          ...this.ticketsInstancesOptions,
          series,
          labels
        }

        if (this.$refs.ChartTicketsInstances) {
          await this.$nextTick()
          this.$refs.ChartTicketsInstances.updateOptions(this.ticketsInstancesOptions)
          this.$refs.ChartTicketsInstances.updateSeries(series, true)
        }
      } catch (error) {
        console.error('Erro ao carregar dados das instâncias:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao carregar dados das instâncias'
        })
      } finally {
        this.loadingInstances = false
      }
    },
    async loadData () {
      try {
        await Promise.all([
          this.listarFilas(),
          this.getDashTicketsAndTimes(),
          this.getDashTicketsQueue(),
          this.getDashTicketsChannels(),
          this.getDashTicketsEvolutionChannels(),
          this.getDashTicketsEvolutionByPeriod(),
          this.getDashTicketsPerUsersDetail(),
          this.getDashTicketsInstances()
        ])
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao carregar dados do dashboard'
        })
      }
    }
  },
  mounted () {
    this.loadData()
  },
  watch: {
    params: {
      handler () {
        this.loadData()
      },
      deep: true
    }
  }
}
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
    max-width: 1400px;
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
  max-width: 1400px;
  margin: 0 auto 2rem;
  padding: 0 1.5rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 1rem 0;
  padding: 0 1rem;
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
</style>
