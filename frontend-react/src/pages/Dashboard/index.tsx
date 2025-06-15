import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { dashboardApi } from '../../services/api';
import type { DashboardData, DashboardFilters, Fila } from '../../types/dashboard';
import MetricsCard from './components/MetricsCard';
import ChannelChart from './components/ChannelChart';
import QueueChart from './components/QueueChart';
import EvolutionChart from './components/EvolutionChart';
import PerformanceChart from './components/PerformanceChart';
import UsersTable from './components/UsersTable';

export default function Dashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({
    dataInicio: new Date(new Date().setHours(0, 0, 0, 0)),
    dataFim: new Date(),
    filas: [],
  });

  const { data: filasData, isLoading: isLoadingFilas } = useQuery<Fila[]>({
    queryKey: ['filas'],
    queryFn: dashboardApi.getFilas,
    initialData: [], // Garante que filasData será um array vazio inicialmente
  });

  const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery<DashboardData>({
    queryKey: ['dashboard', filters],
    queryFn: () => dashboardApi.getDashboardData(filters),
  });

  const handleFilaChange = (event: SelectChangeEvent<number[]>) => {
    setFilters(prev => ({
      ...prev,
      filas: event.target.value as number[],
    }));
  };

  const handleUpdate = () => {
    // A query será atualizada automaticamente devido ao queryKey
  };

  if (isLoadingFilas || isLoadingDashboard) {
    return <Typography>Carregando...</Typography>;
  }

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <DatePicker
              label="Data Início"
              value={filters.dataInicio}
              onChange={(date: Date | null) => date && setFilters(prev => ({ ...prev, dataInicio: date }))}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <DatePicker
              label="Data Fim"
              value={filters.dataFim}
              onChange={(date: Date | null) => date && setFilters(prev => ({ ...prev, dataFim: date }))}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Filas</InputLabel>
              <Select
                multiple
                value={filters.filas}
                onChange={handleFilaChange}
                label="Filas"
              >
                {Array.isArray(filasData) && filasData.map((fila: Fila) => (
                  <MenuItem key={fila.id} value={fila.id}>
                    {fila.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={1}>
            <Button
              variant="contained"
              onClick={handleUpdate}
              fullWidth
            >
              Atualizar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <MetricsCard
            title="Total de Atendimentos"
            value={dashboardData?.totalAtendimentos || 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricsCard
            title="Atendimentos Ativos"
            value={dashboardData?.atendimentosAtivos || 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricsCard
            title="Atendimentos Receptivos"
            value={dashboardData?.atendimentosReceptivos || 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricsCard
            title="Novos Contatos"
            value={dashboardData?.novosContatos || 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricsCard
            title="TMA"
            value={dashboardData?.tma || 0}
            suffix="min"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricsCard
            title="TME"
            value={dashboardData?.tme || 0}
            suffix="min"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <ChannelChart data={dashboardData?.atendimentosPorCanal || []} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <QueueChart data={dashboardData?.distribuicaoPorFila || []} />
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <EvolutionChart data={dashboardData?.evolucaoAtendimentos || []} />
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <PerformanceChart data={dashboardData?.desempenhoPorUsuario || []} />
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <UsersTable data={dashboardData?.desempenhoPorUsuario || []} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
} 