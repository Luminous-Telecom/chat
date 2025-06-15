import { Typography } from '@mui/material';
import Chart from 'react-apexcharts';
import { TicketChannel } from '../../../types/dashboard';

interface ChannelChartProps {
  data: TicketChannel[];
}

export default function ChannelChart({ data }: ChannelChartProps) {
  const options = {
    chart: {
      type: 'pie' as const,
    },
    labels: data.map(item => item.channel),
    colors: ['#1976d2', '#dc004e', '#4caf50', '#ff9800', '#9c27b0'],
    legend: {
      position: 'bottom' as const,
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 200,
        },
        legend: {
          position: 'bottom',
        },
      },
    }],
  };

  const series = data.map(item => item.count);

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Atendimentos por Canal
      </Typography>
      <Chart
        options={options}
        series={series}
        type="pie"
        height={350}
      />
    </>
  );
} 