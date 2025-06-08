import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { ticketService } from '../services/api';

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0); // 0: Esperando, 1: Aberto, 2: Fechado
  const [filterMode, setFilterMode] = useState('todos'); // 'meus', 'departamentos', 'todos'

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    // Filtra tickets baseado no termo de busca, status selecionado e modo de filtro
    let filtered = tickets;
    
    // Filtro por status
    if (selectedTab === 0) {
      filtered = filtered.filter(ticket => ticket.status === 'pending');
    } else if (selectedTab === 1) {
      filtered = filtered.filter(ticket => ticket.status === 'open');
    } else if (selectedTab === 2) {
      filtered = filtered.filter(ticket => ticket.status === 'closed');
    }
    
    // Filtro por modo (simulando diferentes tipos de atendimento)
    if (filterMode === 'meus' && selectedTab !== 0) {
      // Para status 'pending', sempre mostra tickets não atribuídos
      // Para outros status, filtra por tickets atribuídos ao usuário atual
      filtered = filtered.filter(ticket => ticket.assignedUser === 'current_user');
    } else if (filterMode === 'departamentos') {
      // Filtra por tickets do departamento do usuário
      filtered = filtered.filter(ticket => ticket.queue?.name === 'user_department');
    }
    // 'todos' não aplica filtro adicional
    
    // Filtro por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(ticket => 
        ticket.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.body?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.id.toString().includes(searchTerm)
      );
    }
    
    setFilteredTickets(filtered);
  }, [tickets, searchTerm, selectedTab, filterMode]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Tenta carregar tickets da API
      const response = await ticketService.getAll({ status: 'pending' });
      setTickets(response.tickets || []);
    } catch (err) {
      console.error('Erro ao carregar tickets:', err);
      
      // Se houver erro, mostra dados simulados
      const mockTickets = [
        {
          id: 1,
          contact: { name: 'João Silva', number: '5511999999999' },
          body: 'Preciso de ajuda com meu pedido',
          status: 'pending',
          queue: { name: 'Suporte' },
          assignedUser: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          contact: { name: 'Maria Santos', number: '5511888888888' },
          body: 'Gostaria de fazer uma reclamação',
          status: 'open',
          queue: { name: 'user_department' },
          assignedUser: 'current_user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 3,
          contact: { name: 'Pedro Costa', number: '5511777777777' },
          body: 'Informações sobre produtos',
          status: 'pending',
          queue: { name: 'Vendas' },
          assignedUser: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 4,
          contact: { name: 'Ana Oliveira', number: '5511666666666' },
          body: 'Ticket resolvido com sucesso',
          status: 'closed',
          queue: { name: 'user_department' },
          assignedUser: 'current_user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 5,
          contact: { name: 'Carlos Ferreira', number: '5511555555555' },
          body: 'Dúvida sobre faturamento',
          status: 'closed',
          queue: { name: 'Financeiro' },
          assignedUser: 'other_user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 6,
          contact: { name: 'Lucia Mendes', number: '5511444444444' },
          body: 'Aguardando atendimento',
          status: 'pending',
          queue: { name: 'Suporte' },
          assignedUser: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 7,
          contact: { name: 'Roberto Lima', number: '5511333333333' },
          body: 'Ticket em andamento',
          status: 'open',
          queue: { name: 'user_department' },
          assignedUser: 'current_user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      setTickets(mockTickets);
      setError('Usando dados simulados - verifique a conexão com o backend');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'open':
        return 'info';
      case 'closed':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'open':
        return 'Aberto';
      case 'closed':
        return 'Fechado';
      default:
        return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const handleViewTicket = (ticketId) => {
    console.log('Visualizar ticket:', ticketId);
    // Aqui você pode implementar a navegação para a página de detalhes do ticket
  };

  const handleEditTicket = (ticketId) => {
    console.log('Editar ticket:', ticketId);
    // Aqui você pode implementar a edição do ticket
  };

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
    // Reset filter mode when changing tabs
    if (newValue === 0) {
      // Para status 'pending', sempre usar filtro específico
      setFilterMode('todos');
    }
  };

  const handleFilterModeChange = (mode) => {
    setFilterMode(mode);
  };

  const getTicketCountByStatus = (status) => {
    return tickets.filter(ticket => ticket.status === status).length;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} sx={{ flexShrink: 0 }}>
        <Typography variant="h4">
          Atendimentos na Fila
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadTickets}
          disabled={loading}
        >
          Atualizar
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2, flexShrink: 0 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 2, flexShrink: 0 }}>
        <Tabs 
          value={selectedTab} 
          onChange={handleTabChange}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          sx={{
            '& .MuiTab-root': {
              minHeight: '64px',
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'none',
              padding: '8px 16px',
              flexDirection: 'column',
              alignItems: 'center'
            },
            '& .MuiTabs-indicator': {
              height: '3px'
            }
          }}
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'inherit', fontSize: '0.875rem' }}>
                    📋 Atendimentos na Fila
                  </Typography>
                  <Badge 
                    badgeContent={getTicketCountByStatus('pending')} 
                    color="warning"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.75rem',
                        height: '18px',
                        minWidth: '18px'
                      }
                    }}
                  >
                    <Box sx={{ width: 8 }} />
                  </Badge>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  Tickets em espera
                </Typography>
              </Box>
            }
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'inherit', fontSize: '0.875rem' }}>
                    💬 Atendimentos em Andamento
                  </Typography>
                  <Badge 
                    badgeContent={getTicketCountByStatus('open')} 
                    color="info"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.75rem',
                        height: '18px',
                        minWidth: '18px'
                      }
                    }}
                  >
                    <Box sx={{ width: 8 }} />
                  </Badge>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  Lista de atendimentos
                </Typography>
              </Box>
            }
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'inherit', fontSize: '0.875rem' }}>
                    📁 Atendimentos Finalizados
                  </Typography>
                  <Badge 
                    badgeContent={getTicketCountByStatus('closed')} 
                    color="success"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.75rem',
                        height: '18px',
                        minWidth: '18px'
                      }
                    }}
                  >
                    <Box sx={{ width: 8 }} />
                  </Badge>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  Histórico de atendimentos
                </Typography>
              </Box>
            }
          />
        </Tabs>
      </Paper>

      {/* Filtros adicionais - similar ao Vue */}
      {selectedTab === 0 ? (
        <Paper sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', flexShrink: 0 }}>
          <Box display="flex" justifyContent="center">
            <Button
              variant="contained"
              size="small"
              color="success"
              disabled
              sx={{ textTransform: 'none' }}
            >
              Tickets não atendidos
            </Button>
          </Box>
        </Paper>
      ) : (
        <Paper sx={{ mb: 2, p: 2, flexShrink: 0 }}>
          <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center">
            <Button
              variant={filterMode === 'meus' ? 'contained' : 'outlined'}
              size="small"
              color={filterMode === 'meus' ? 'success' : 'primary'}
              onClick={() => handleFilterModeChange('meus')}
              sx={{ textTransform: 'none' }}
            >
              Meus atendimentos
            </Button>
            <Button
              variant={filterMode === 'departamentos' ? 'contained' : 'outlined'}
              size="small"
              color={filterMode === 'departamentos' ? 'success' : 'primary'}
              onClick={() => handleFilterModeChange('departamentos')}
              sx={{ textTransform: 'none' }}
            >
              Meus departamentos
            </Button>
            <Button
              variant={filterMode === 'todos' ? 'contained' : 'outlined'}
              size="small"
              color={filterMode === 'todos' ? 'success' : 'primary'}
              onClick={() => handleFilterModeChange('todos')}
              sx={{ textTransform: 'none' }}
            >
              Todos
            </Button>
          </Box>
        </Paper>
      )}

      <Box mb={2} sx={{ flexShrink: 0 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Buscar por nome, número ou mensagem"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Contato</TableCell>
              <TableCell>Mensagem</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Fila</TableCell>
              <TableCell>Criado em</TableCell>
              <TableCell>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                    {searchTerm ? 'Nenhum ticket encontrado para a busca' : 'Nenhum ticket encontrado'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TableRow key={ticket.id} hover>
                  <TableCell>{ticket.id}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        {ticket.contact?.number || 'N/A'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ticket.body || 'Sem mensagem'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(ticket.status)}
                      color={getStatusColor(ticket.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{ticket.queue?.name || 'N/A'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                      {formatDate(ticket.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleViewTicket(ticket.id)}
                      title="Visualizar"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditTicket(ticket.id)}
                      title="Editar"
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </TableContainer>
        
        <Box mt={2} display="flex" justifyContent="space-between" alignItems="center" sx={{ flexShrink: 0, p: 2 }}>
          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem' }}>
            {selectedTab === 0 && `Esperando Atendimento: ${filteredTickets.length} ticket(s)`}
            {selectedTab === 1 && `Em Atendimento: ${filteredTickets.length} ticket(s)`}
            {selectedTab === 2 && `Fechados: ${filteredTickets.length} ticket(s)`}
          </Typography>
          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem' }}>
            Última atualização: {new Date().toLocaleTimeString('pt-BR')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Tickets;