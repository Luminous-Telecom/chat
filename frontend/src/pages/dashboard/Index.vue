<template>
  <div class="q-pa-sm">
    <q-card class="q-my-md">
      <q-card-section class="row justify-between items-center">
        <div class="col-12 justify-center flex q-gutter-sm">
          <q-datetime-picker
            style="width: 200px"
            dense
            rounded
            hide-bottom-space
            outlined
            stack-label
            bottom-slots
            label="Data/Hora Agendamento"
            mode="date"
            color="primary"
            format24h
            v-model="params.startDate"
          />
          <q-datetime-picker
            style="width: 200px"
            dense
            rounded
            hide-bottom-space
            outlined
            stack-label
            bottom-slots
            label="Data/Hora Agendamento"
            mode="date"
            color="primary"
            format24h
            v-model="params.endDate"
          />
          <q-select
            style="width: 300px"
            dense
            rounded
            outlined
            hide-bottom-space
            emit-value
            map-options
            multiple
            options-dense
            use-chips
            label="Filas"
            color="primary"
            v-model="params.queuesIds"
            :options="filas"
            :input-debounce="700"
            option-value="id"
            option-label="queue"
            input-style="width: 280px; max-width: 280px;"
          />
          <q-btn
            rounded
            color="primary"
            icon="refresh"
            label="Atualizar"
            @click="getDashData"
          />
        </div>

      </q-card-section>
    </q-card>
    <q-card class="q-my-md q-pa-sm">
      <q-card-section class="q-pa-md">
        <div class="row q-gutter-md justify-center">
          <div class="col-xs-12 col-sm-shrink">
            <q-card
              flat
              bordered
              class="my-card full-height"
              style="min-width: 200px"
            >
              <q-card-section class="text-center ">
                <p class="text-h4 text-bold text-center"> {{ ticketsAndTimes.qtd_total_atendimentos }} </p>
                Total Atendimentos
              </q-card-section>
            </q-card>
          </div>
          <div class="col-xs-12 col-sm-shrink">
            <q-card
              flat
              bordered
              class="my-card full-height"
              style="min-width: 200px"
            >
              <q-card-section class="text-center">
                <p class="text-h4 text-bold text-center"> {{ ticketsAndTimes.qtd_demanda_ativa }} </p>
                Ativo
              </q-card-section>
            </q-card>
          </div>
          <div class="col-xs-12 col-sm-shrink">
            <q-card
              flat
              bordered
              class="my-card full-height"
              style="min-width: 200px"
            >
              <q-card-section class="text-center">
                <p class="text-h4 text-bold text-center"> {{ ticketsAndTimes.qtd_demanda_receptiva }} </p>
                Receptivo
              </q-card-section>
            </q-card>
          </div>
          <div class="col-xs-12 col-sm-shrink">
            <q-card
              flat
              bordered
              class="my-card full-height"
              style="min-width: 200px"
            >
              <q-card-section class="text-center">
                <p class="text-h4 text-bold text-center"> {{ ticketsAndTimes.new_contacts }} </p>
                Novos Contatos
              </q-card-section>
            </q-card>
          </div>
          <div class="col-xs-12 col-sm-4 col-md-3 col-lg-2">
            <q-card
              flat
              bordered
              class="my-card full-height"
            >
              <q-card-section class="text-center">
                <p class="text-h5 text-bold text-center"> {{ cTmaFormat }} </p>
                Tempo Médio Atendimento (TMA)
              </q-card-section>
            </q-card>
          </div>
          <div class="col-xs-12 col-sm-4 col-md-3 col-lg-2">
            <q-card
              flat
              bordered
              class="my-card full-height"
            >
              <q-card-section class="text-center">
                <p class="text-h5 text-bold text-center"> {{ cTmeFormat }} </p>
                Tempo Médio 1º Resposta
              </q-card-section>
            </q-card>
          </div>
        </div>

      </q-card-section>
    </q-card>

    <div class="row q-col-gutter-md">
      <div class="col-xs-12 col-sm-6">
        <q-card>
          <q-card-section class="q-pa-md">
            <ApexChart
              ref="ChartTicketsChannels"
              type="donut"
              height="300"
              width="100%"
              :options="ticketsChannelsOptions"
              :series="ticketsChannelsOptions.series"
            />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-xs-12 col-sm-6">
        <q-card>
          <q-card-section class="q-pa-md">
            <ApexChart
              v-if="ticketsQueueOptions.series && ticketsQueueOptions.series.length > 0"
              ref="ChartTicketsQueue"
              type="donut"
              height="300"
              width="100%"
              :options="chartOptions"
              :series="ticketsQueueOptions.series"
            />
            <div v-else class="text-center q-pa-md">
              Carregando dados...
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
    <q-card class="q-my-md">
      <q-card-section>
        <ApexChart
          v-if="ticketsEvolutionChannelsOptions.series && ticketsEvolutionChannelsOptions.series.length > 0"
          ref="ChartTicketsEvolutionChannels"
          type="bar"
          height="300"
          width="100%"
          :options="ticketsEvolutionChannelsOptions"
          :series="ticketsEvolutionChannelsOptions.series"
        />
        <div v-else class="text-center q-pa-md">
          Carregando dados...
        </div>
      </q-card-section>
    </q-card>
    <q-card class="q-my-md">
      <q-card-section class="q-pa-md">
        <ApexChart
          v-if="ticketsEvolutionByPeriodOptions.series && ticketsEvolutionByPeriodOptions.series.length > 0"
          ref="ChartTicketsEvolutionByPeriod"
          type="line"
          height="300"
          :options="ticketsEvolutionByPeriodOptions"
          :series="ticketsEvolutionByPeriodOptions.series"
        />
        <div v-else class="text-center q-pa-md">
          Carregando dados...
        </div>
      </q-card-section>
    </q-card>

    <q-card class="q-my-md q-pa-sm">
      <q-card-section class="q-pa-md">
        <q-table
          title="Performance Usuários"
          :data="ticketsPerUsersDetail"
          :columns="TicketsPerUsersDetailColumn"
          row-key="email"
          :pagination.sync="paginationTableUser"
          :rows-per-page-options="[0]"
          bordered
          flat
          hide-bottom
        >
          <template v-slot:body-cell-name="props">
            <q-td :props="props">
              <div class="row col text-bold"> {{ props.row.name || 'Não informado' }} </div>
              <div class="row col text-caption">{{ props.row.email }} </div>
            </q-td>
          </template>
        </q-table>

      </q-card-section>

    </q-card>

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
import { subDays, format, formatDuration, differenceInDays } from 'date-fns'
import ApexChart from 'vue-apexcharts'

export default {
  name: 'IndexDashboard',
  components: { ApexChart },
  data () {
    return {
      confiWidth: {
        horizontal: false,
        width: this.$q.screen.width
      },
      params: {
        startDate: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        queuesIds: []
      },
      paginationTableUser: {
        rowsPerPage: 40,
        rowsNumber: 0,
        lastIndex: 0
      },
      filas: [],
      ticketsChannels: [],
      ticketsChannelsOptions: {
        // colors: ['#008FFB', '#00E396', '#FEB019'],
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 1000
        },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'dark',
            type: 'vertical',
            shadeIntensity: 0.05,
            inverseColors: false,
            opacityFrom: 1,
            opacityTo: 0.9,
            stops: [0, 100]
          }
        },
        chart: {
          toolbar: {
            show: true
          }
        },
        legend: {
          position: 'bottom'
        },
        title: {
          text: 'Atendimento por canal'
        },
        noData: {
          text: 'Sem dados aqui!',
          align: 'center',
          verticalAlign: 'middle',
          offsetX: 0,
          offsetY: 0,
          style: {
            color: undefined,
            fontSize: '14px',
            fontFamily: undefined
          }
        },
        series: [],
        labels: [],
        theme: {
          mode: 'light',
          palette: 'palette1'
        },
        plotOptions: {
          pie: {
            dataLabels: {
              offset: -10
            }
          }
        },
        dataLabels: {
          enabled: true,
          textAnchor: 'middle',
          style: {
            fontSize: '16px',
            offsetY: '150',
            fontFamily: 'Helvetica, Arial, sans-serif'
          },
          offsetX: 0
        }
      },
      ticketsQueue: [],
      ticketsQueueOptions: {
        series: [0],
        labels: ['Carregando...'],
        chart: {
          type: 'donut',
          toolbar: {
            show: true
          }
        },
        plotOptions: {
          pie: {
            donut: {
              size: '50%'
            }
          }
        },
        legend: {
          position: 'bottom'
        },
        title: {
          text: 'Atendimento por fila',
          align: 'center'
        },
        noData: {
          text: 'Sem dados disponíveis',
          align: 'center',
          verticalAlign: 'middle'
        },
        responsive: [{
          breakpoint: 480,
          options: {
            chart: {
              width: 200
            },
            legend: {
              position: 'bottom'
            }
          }
        }]
      },
      ticketsEvolutionChannels: [],
      ticketsEvolutionChannelsOptions: {
        // colors: ['#008FFB', '#00E396', '#FEB019'],
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 1000
        },
        chart: {
          type: 'bar',
          // height: 300,
          stacked: true,
          stackType: '100%',
          toolbar: {
            tools: {
              download: true,
              selection: false,
              zoom: false,
              zoomin: false,
              zoomout: false,
              pan: false,
              reset: false | '<img src="/static/icons/reset.png" width="20">'
            }

          }
        },
        theme: {
          mode: 'light',
          palette: 'palette1'
        },
        grid: {
          show: true,
          strokeDashArray: 0
        },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'dark',
            type: 'vertical',
            shadeIntensity: 0.05,
            inverseColors: false,
            opacityFrom: 1,
            opacityTo: 0.9,
            stops: [0, 100]
          }
        },
        dataLabels: {
          enabled: true
        },
        title: {
          text: 'Evolução por canal',
          align: 'left'
        },
        stroke: {
          width: 0
        },
        series: [{
          name: 'Carregando...',
          data: [0]
        }],
        // responsive: [{
        //   breakpoint: 480,
        //   options: {
        //     chart: {
        //       width: 250
        //     },
        //     legend: {
        //       position: 'bottom'
        //     }
        //   }
        // }],
        xaxis: {
          type: 'category',
          categories: ['Carregando...'],
          tickPlacement: 'on'
          // labels: {
          //   formatter: function (value, timestamp, opts) {
          //     return format(new Date(timestamp), 'dd/MM')
          //     // return opts.dateFormatter().format('dd MMM')
          //   }
          // }
          // type: 'datetime'
          // format: 'dd/MM'
          // datetimeFormatter: {
          //   // year: 'yyyy',
          //   month: 'MM',
          //   day: 'DD'
          //   // hour: 'HH:mm',
          // }
        },
        yaxis: {
          title: {
            text: 'Atendimentos',
            style: {
              color: '#FFF'
            }
          }
        },
        tooltip: {
          y: {
            formatter: function (val) {
              return Number(val).toFixed(0)
            }
          }
        }
      },
      ticketsEvolutionByPeriod: [],
      ticketsEvolutionByPeriodOptions: {
        // colors: ['#008FFB', '#00E396', '#FEB019'],
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 1000
        },
        theme: {
          mode: 'light',
          palette: 'palette1'
        },
        chart: {
          toolbar: {
            tools: {
              download: true,
              selection: false,
              zoom: false,
              zoomin: false,
              zoomout: false,
              pan: false,
              reset: false | '<img src="/static/icons/reset.png" width="20">'
            }

          }
        },
        grid: {
          show: true,
          strokeDashArray: 0,
          xaxis: {
            lines: {
              show: true
            }
          }
        },
        stroke: {
          width: [4, 4, 4]
        },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'dark',
            type: 'vertical',
            shadeIntensity: 0.05,
            inverseColors: false,
            opacityFrom: 1,
            opacityTo: 0.9,
            stops: [0, 100]
          }
        },
        title: {
          text: 'Evolução atendimentos',
          align: 'left'
        },
        dataLabels: {
          enabled: true,
          enabledOnSeries: [1]
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
        tooltip: {
          shared: false,
          x: {
            show: false
          },
          y: {
            formatter: function (val) {
              return Number(val).toFixed(0)
            }
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
          style: 'width: 300px;',
          format: (v, r) => {
            return v ? `${r.name} | ${r.email}` : 'Não informado'
          }
        },
        {
          name: 'qtd_pendentes',
          label: 'Pendentes',
          field: 'qtd_pendentes'
        },
        {
          name: 'qtd_em_atendimento',
          label: 'Atendendo',
          field: 'qtd_em_atendimento'
        },
        {
          name: 'qtd_resolvidos',
          label: 'Finalizados',
          field: 'qtd_resolvidos'
        },
        {
          name: 'qtd_por_usuario',
          label: 'Total',
          field: 'qtd_por_usuario'
        },
        {
          name: 'tme',
          label: 'T.M.E',
          field: 'tme',
          align: 'center',
          headerStyle: 'text-align: center !important',
          format: v => {
            return formatDuration(v) || ''
          }
        },
        {
          name: 'tma',
          label: 'T.M.A',
          field: 'tma',
          align: 'center',
          headerStyle: 'text-align: center !important',
          format: v => {
            return formatDuration(v) || ''
          }
        }
      ]
    }
  },
  watch: {
    '$q.dark.isActive' () {
      // necessário para carregar os gráficos com a alterçaão do mode (dark/light)
      this.$nextTick(() => {
        // Force re-render of charts without page reload
        this.$forceUpdate()
      })
    },
    '$q.screen.width' () {
      // necessário para carregar os gráficos com a alterçaão do mode (dark/light)
      this.setConfigWidth()
    }
  },
  computed: {
    cTmaFormat () {
      const tma = this.ticketsAndTimes.tma || {}
      return formatDuration(tma) || ''
    },
    cTmeFormat () {
      const tme = this.ticketsAndTimes.tme || {}
      return formatDuration(tme) || ''
    },
    chartOptions () {
      return {
        ...this.ticketsQueueOptions,
        labels: this.ticketsQueueOptions.labels || ['Carregando...'],
        series: this.ticketsQueueOptions.series || [0]
      }
    }
  },
  methods: {
    async listarFilas () {
      const { data } = await ListarFilas()
      this.filas = data
    },
    setConfigWidth () {
      const diffDays = differenceInDays(new Date(this.params.endDate), new Date(this.params.startDate))
      if (diffDays > 30) {
        this.configWidth = { horizontal: true, width: 2200 }
      } else {
        const actualWidth = this.$q.screen.width
        this.configWidth = { horizontal: true, width: actualWidth - (actualWidth < 768 ? 40 : 100) }
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
      })
        .catch(_err => {
          // Erro ao carregar dados gerais
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
        // Erro ao carregar dados do gráfico
        this.ticketsQueueOptions = {
          ...this.ticketsQueueOptions,
          series: [0],
          labels: ['Erro ao carregar']
        }
        if (this.$refs.ChartTicketsQueue) {
          await this.$nextTick()
          this.$refs.ChartTicketsQueue.updateOptions(this.ticketsQueueOptions)
          this.$refs.ChartTicketsQueue.updateSeries([0], true)
        }
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

        // Ensure we have data to display
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
      })
        .catch(_err => {
          // Erro ao carregar dados dos canais
          // Set fallback data on error
          this.ticketsChannelsOptions.series = [0]
          this.ticketsChannelsOptions.labels = ['Erro ao carregar']
          if (this.$refs.ChartTicketsChannels) {
            this.$refs.ChartTicketsChannels.updateOptions(this.ticketsChannelsOptions)
            this.$refs.ChartTicketsChannels.updateSeries([0], true)
          }
        })
    },
    getDashTicketsEvolutionChannels () {
      GetDashTicketsEvolutionChannels(this.params)
        .then(res => {
          this.ticketsEvolutionChannels = res.data || []

          if (!Array.isArray(this.ticketsEvolutionChannels) || this.ticketsEvolutionChannels.length === 0) {
            // Set fallback data
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
                data: dados[item].map(d => {
                  return d && d.qtd !== undefined ? d.qtd : 0
                })
              })
            }
          }

          // Ensure we have valid series data
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
        })
        .catch(_error => {
          // Erro ao carregar evolução dos canais

          // Set fallback data on error
          this.ticketsEvolutionChannelsOptions.series = [{
            name: 'Erro ao carregar',
            data: [0]
          }]
          this.ticketsEvolutionChannelsOptions.xaxis.categories = ['Erro']
          if (this.$refs.ChartTicketsEvolutionChannels) {
            this.$refs.ChartTicketsEvolutionChannels.updateOptions(this.ticketsEvolutionChannelsOptions)
            this.$refs.ChartTicketsEvolutionChannels.updateSeries(this.ticketsEvolutionChannelsOptions.series, true)
          }
        })
    },
    getDashTicketsEvolutionByPeriod () {
      GetDashTicketsEvolutionByPeriod(this.params)
        .then(res => {
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

          // Ensure we have at least some data
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
        })
        .catch(_error => {
          // Erro ao carregar evolução por período

          // Set fallback data on error
          const fallbackSeries = [{
            name: 'Atendimentos',
            type: 'column',
            data: [0]
          }, {
            type: 'line',
            data: [0]
          }]
          this.ticketsEvolutionByPeriodOptions.labels = ['Erro']
          this.ticketsEvolutionByPeriodOptions.series = fallbackSeries

          if (this.$refs.ChartTicketsEvolutionByPeriod) {
            this.$refs.ChartTicketsEvolutionByPeriod.updateOptions(this.ticketsEvolutionByPeriodOptions)
            this.$refs.ChartTicketsEvolutionByPeriod.updateSeries(fallbackSeries, true)
          }
        })
    },
    getDashTicketsPerUsersDetail () {
      GetDashTicketsPerUsersDetail(this.params)
        .then(res => {
          this.ticketsPerUsersDetail = res.data || []
        })
        .catch(_error => {
          // Erro ao carregar detalhes por usuário
          this.ticketsPerUsersDetail = []
        })
    },
    getDashData () {
      this.setConfigWidth()
      this.getDashTicketsAndTimes()
      this.getDashTicketsChannels()
      this.getDashTicketsEvolutionChannels()
      this.getDashTicketsQueue()
      this.getDashTicketsEvolutionByPeriod()
      this.getDashTicketsPerUsersDetail()
    }

  },
  beforeMount () {
    const mode = this.$q.dark.isActive ? 'dark' : 'light'
    const theme = {
      mode,
      palette: 'palette1',
      monochrome: {
        enabled: true,
        color: '#0288d1',
        shadeTo: mode,
        shadeIntensity: 0.95
      }

    }
    this.ticketsQueueOptions = { ...this.ticketsQueueOptions, theme }
    this.ticketsChannelsOptions = { ...this.ticketsChannelsOptions, theme }
    this.ticketsEvolutionChannelsOptions = { ...this.ticketsEvolutionChannelsOptions, theme }
    this.ticketsEvolutionByPeriodOptions = { ...this.ticketsEvolutionByPeriodOptions, theme }
  },
  mounted () {
    this.listarFilas()
    this.getDashData()
  }
}
</script>

<style lang="scss" >
.apexcharts-theme-dark svg {
  background: none !important;
}
</style>
