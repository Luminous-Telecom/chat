import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as TicketsIcon,
  People as UsersIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const { totalUnreadCount } = useSelector((state) => state.notifications);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTickets: 0,
    pendingTickets: 0,
    resolvedTickets: 0,
    activeUsers: 0,
  });

  useEffect(() => {
    // Simula carregamento de dados
    const loadDashboardData = async () => {
      try {
        // Aqui você pode fazer chamadas para APIs reais
        // Por enquanto, vamos simular dados
        setTimeout(() => {
          setStats({
            totalTickets: 150,
            pendingTickets: totalUnreadCount || 12,
            resolvedTickets: 138,
            activeUsers: 8,
          });
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [totalUnreadCount]);

  const StatCard = ({ title, value, icon, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="caption" sx={{ fontSize: '0.75rem' }}>
              {title}
            </Typography>
            <Typography variant="h4" component="h2">
              {loading ? <CircularProgress size={24} /> : value}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.main`,
              borderRadius: '50%',
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(icon, { sx: { color: 'white' } })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Typography variant="caption" color="textSecondary" sx={{ mb: 3, fontSize: '0.875rem' }}>
        Bem-vindo, {user?.name || 'Usuário'}!
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total de Tickets"
            value={stats.totalTickets}
            icon={<TicketsIcon />}
            color="primary"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Tickets Pendentes"
            value={stats.pendingTickets}
            icon={<DashboardIcon />}
            color="warning"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Tickets Resolvidos"
            value={stats.resolvedTickets}
            icon={<TrendingUpIcon />}
            color="success"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Usuários Ativos"
            value={stats.activeUsers}
            icon={<UsersIcon />}
            color="info"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Atividade Recente
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
              Aqui você pode ver as atividades mais recentes do sistema.
            </Typography>
            {/* Aqui você pode adicionar uma lista de atividades recentes */}
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Status do Sistema
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                Sistema: Online
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                Última atualização: Agora
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                Filas ativas: {user?.queues?.length || 0}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;