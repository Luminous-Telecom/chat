import { Typography } from '@mui/material';
import Chart from 'react-apexcharts';
import type { UserDetail } from '../../../types/dashboard';

interface PerformanceChartProps {
  data: UserDetail[];
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  const options = {
    chart: {
      type: 'bar' as const,
      stacked: true,
    },
    plotOptions: {
      bar: {
        horizontal: true,
        dataLabels: {
          total: {
            enabled: true,
            offsetX: 0,
            style: {
              fontSize: '13px',
              fontWeight: 900,
            },
          },
        },
      },
    },
    stroke: {
      width: 1,
      colors: ['#fff'],
    },
    xaxis: {
      categories: data.map(item => item.name),
      labels: {
        formatter: (value: number) => value.toLocaleString('pt-BR'),
      },
    },
    yaxis: {
      title: {
        text: undefined,
      },
    },
    tooltip: {
      y: {
        formatter: (value: number) => value.toLocaleString('pt-BR'),
      },
    },
    legend: {
      position: 'top' as const,
      horizontalAlign: 'left' as const,
      offsetX: 40,
    },
    colors: ['#1976d2', '#dc004e'],
  };

  const series = [
    {
      name: 'Atendimentos Ativos',
      data: data.map(item => item.activeTickets),
    },
    {
      name: 'Total de Atendimentos',
      data: data.map(item => item.totalTickets),
    },
  ];

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Desempenho por Usuário
      </Typography>
      <Chart
        options={options}
        series={series}
        type="bar"
        height={350}
      />
    </>
  );
} 