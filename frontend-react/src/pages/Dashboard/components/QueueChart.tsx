import { Typography } from '@mui/material';
import Chart from 'react-apexcharts';

interface QueueChartProps {
  data: {
    fila: string;
    quantidade: number;
  }[];
}

export default function QueueChart({ data }: QueueChartProps) {
  const options = {
    chart: {
      type: 'bar' as const,
    },
    plotOptions: {
      bar: {
        horizontal: true,
        dataLabels: {
          position: 'top',
        },
      },
    },
    colors: ['#1976d2'],
    dataLabels: {
      enabled: true,
      offsetX: 0,
      style: {
        fontSize: '12px',
        colors: ['#fff'],
      },
    },
    xaxis: {
      categories: data.map(item => item.fila),
    },
    yaxis: {
      labels: {
        show: true,
      },
    },
  };

  const series = [{
    name: 'Quantidade',
    data: data.map(item => item.quantidade),
  }];

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Distribuição por Fila
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