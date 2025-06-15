import { Paper, Typography } from '@mui/material';

interface MetricsCardProps {
  title: string;
  value: number;
  suffix?: string;
}

export default function MetricsCard({ title, value, suffix }: MetricsCardProps) {
  return (
    <Paper
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <Typography color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Typography component="p" variant="h4">
        {value.toLocaleString('pt-BR')}
        {suffix && ` ${suffix}`}
      </Typography>
    </Paper>
  );
} 