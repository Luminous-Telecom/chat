import { Typography } from '@mui/material';
import Chart from 'react-apexcharts';

interface EvolutionChartProps {
  data: {
    data: string;
    quantidade: number;
  }[];
}

export default function EvolutionChart({ data }: EvolutionChartProps) {
  const options = {
    chart: {
      type: 'line' as const,
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: 'smooth' as const,
      width: 2,
    },
    xaxis: {
      categories: data.map(item => item.data),
      type: 'datetime' as const,
    },
    yaxis: {
      labels: {
        formatter: (value: number) => value.toLocaleString('pt-BR'),
      },
    },
    tooltip: {
      x: {
        format: 'dd/MM/yyyy',
      },
      y: {
        formatter: (value: number) => value.toLocaleString('pt-BR'),
      },
    },
    colors: ['#1976d2'],
  };

  const series = [{
    name: 'Atendimentos',
    data: data.map(item => item.quantidade),
  }];

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Evolução dos Atendimentos
      </Typography>
      <Chart
        options={options}
        series={series}
        type="line"
        height={350}
      />
    </>
  );
} 