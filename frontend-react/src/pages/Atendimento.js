import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MainLayout from '../components/common/Layout/MainLayout';
import ChatWindow from '../components/ChatWindow';
import {
  Box,
  Drawer,
  Typography,
  TextField,
  InputAdornment,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Badge,
  Chip,
  Divider,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  Search as SearchIcon,
  Timeline as TimelineIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  WhatsApp as WhatsAppIcon,
  Telegram as TelegramIcon,
  Instagram as InstagramIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  PauseCircleOutline as PauseCircleOutlineIcon,
  AddCircle as AddCircleIcon,
  Delete as DeleteIcon,
  ArrowForward as AccountArrowRightIcon,
  ArrowBack as AccountArrowLeftIcon,
  SwapHoriz as AccountConvertIcon,
  SmartToy as RobotIcon,
  CallSplit as ArrowDecisionIcon,
  CheckCircle as AccountCheckIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material';
import { ticketService } from '../services/api';

// Constantes para larguras
const SIDEBAR_WIDTH = 350;
const DETAILS_WIDTH = 260;

// Tipos de canal e seus ícones
const channelTypes = [
  { label: 'WhatsApp', value: 'whatsapp', icon: <WhatsAppIcon /> },
  { label: 'Telegram', value: 'telegram', icon: <TelegramIcon /> },
  { label: 'Instagram', value: 'instagram', icon: <InstagramIcon /> }
];

const getChannelIcon = (type) => {
  const channelType = channelTypes.find(ct => ct.value === type);
  return channelType ? channelType.icon : <WhatsAppIcon />;
};

// Constantes para tipos de logs
const messagesLog = {
  access: {
    message: 'Acessou o ticket',
    color: '#616161',
    icon: <VisibilityIcon />
  },
  closed: {
    message: 'Resolveu o ticket',
    color: '#4caf50',
    icon: <CheckCircleIcon />
  },
  create: {
    message: 'Ticket criado',
    color: '#66bb6a',
    icon: <AddCircleIcon />
  },
  delete: {
    message: 'Deletou o Ticket',
    color: '#f44336',
    icon: <DeleteIcon />
  },
  open: {
    message: 'Iniciou o atendimento',
    color: '#1976d2',
    icon: <PlayCircleOutlineIcon />
  },
  pending: {
    message: 'Retornou atendimento para fila de pendentes',
    color: '#ff9800',
    icon: <PauseCircleOutlineIcon />
  },
  transfered: {
    message: 'Transferiu o atendimento',
    color: '#4db6ac',
    icon: <AccountArrowRightIcon />
  },
  receivedTransfer: {
    message: 'Recebeu o atendimento por transferência',
    color: '#26a69a',
    icon: <AccountArrowLeftIcon />
  },
  queue: {
    message: 'Bot: Fila definida',
    color: '#a5d6a7',
    icon: <ArrowDecisionIcon />
  },
  userDefine: {
    message: 'Bot: Usuário definido',
    color: '#80deea',
    icon: <AccountCheckIcon />
  },
  retriesLimitQueue: {
    message: 'Bot: Fila definida (Limite de tentativas)',
    color: '#a5d6a7',
    icon: <ArrowDecisionIcon />
  },
  retriesLimitUserDefine: {
    message: 'Bot: Usuário definido (Limite de tentativas)',
    color: '#80deea',
    icon: <AccountCheckIcon />
  },
  chatBot: {
    message: 'ChatBot iniciado',
    color: '#42a5f5',
    icon: <RobotIcon />
  },
  autoClose: {
    message: 'Bot: Atendimento fechado pelo cliente',
    color: '#1565c0',
    icon: <CheckCircleIcon />
  }
};

const Atendimento = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [filterMode, setFilterMode] = useState(searchParams.get('status') || 'todos'); // 'todos', 'meus', 'fila'
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [ticketLogs, setTicketLogs] = useState([]);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      
      // Obter status da URL ou usar 'all' como padrão
      const status = searchParams.get('status') || 'all';
      
      // Buscar tickets reais da API com parâmetro status
      const response = await ticketService.getAll({ status });
      const tickets = response.data?.tickets || response.tickets || response.data || response || [];
      setTickets(tickets);
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
      // Em caso de erro, manter array vazio
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    // Atualiza o filterMode quando os parâmetros da URL mudam
    const status = searchParams.get('status');
    if (status) {
      setFilterMode(status);
    } else {
      setFilterMode('todos');
    }
  }, [searchParams]);

  useEffect(() => {
    // Filtra tickets baseado no termo de busca e modo de filtro
    let filtered = tickets;
    
    // Filtro por status (já vem filtrado da API, mas mantemos para compatibilidade)
    if (filterMode === 'pending') {
      filtered = filtered.filter(ticket => ticket.status === 'pending');
    } else if (filterMode === 'open') {
      filtered = filtered.filter(ticket => ticket.status === 'open');
    } else if (filterMode === 'closed') {
      filtered = filtered.filter(ticket => ticket.status === 'closed');
    } else if (filterMode === 'meus') {
      filtered = filtered.filter(ticket => ticket.assignedUser === 'current_user');
    } else if (filterMode === 'fila') {
      filtered = filtered.filter(ticket => ticket.queue?.name === 'user_department');
    }
    
    // Filtro por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(ticket => {
        const contactName = ticket.contact?.name || ticket.name || '';
        const ticketBody = ticket.body || ticket.lastMessage || '';
        const ticketId = ticket.id ? ticket.id.toString() : '';
        
        return contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               ticketBody.toLowerCase().includes(searchTerm.toLowerCase()) ||
               ticketId.includes(searchTerm);
      });
    }
    
    setFilteredTickets(filtered);
  }, [tickets, searchTerm, filterMode]);



  // Função para obter o título baseado no filtro
  const getPageTitle = () => {
    switch (filterMode) {
      case 'pending':
        return 'Atendimentos na Fila';
      case 'open':
        return 'Atendimentos em Andamento';
      case 'closed':
        return 'Atendimentos Finalizados';
      case 'meus':
        return 'Meus Atendimentos';
      case 'fila':
        return 'Atendimentos da Fila';
      default:
        return 'Todos os Atendimentos';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadTicketLogs = async (ticketId) => {
    try {
      const response = await ticketService.getTicketLogs(ticketId);
      const logs = response?.data?.logs || response?.data || response?.logs || [];
      setTicketLogs(Array.isArray(logs) ? logs : []);
      setLogsModalOpen(true);
    } catch (error) {
      console.error('Erro ao carregar logs do ticket:', error);
      setTicketLogs([]);
      alert('Erro ao carregar logs do ticket. Tente novamente.');
    }
  };

  const handleAcceptTicket = async (ticketId) => {
    try {
      // Chamar API para aceitar o ticket
      await ticketService.acceptTicket(ticketId);
      
      // Atualizar o ticket selecionado imediatamente
      if (selectedTicket && selectedTicket.id === ticketId) {
        const updatedTicket = {
          ...selectedTicket,
          status: 'open',
          userId: JSON.parse(localStorage.getItem('usuario'))?.id
        };
        setSelectedTicket(updatedTicket);
        
        // Navegar para a tela de atendimentos em andamento
        navigate('/atendimento?status=open');
      }
      
      // Recarregar os tickets para atualizar a lista
      await loadTickets();
      
    } catch (error) {
      console.error('Erro ao aceitar ticket:', error);
      alert('Erro ao aceitar o ticket. Tente novamente.');
    }
  };

  const handleTicketClick = useCallback((ticket) => {
    setSelectedTicket(ticket);
    setDetailsOpen(true);
  }, []);

  const handleStartAttendance = useCallback((ticket) => {
    setSelectedTicket(ticket);
    setDetailsOpen(true);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return '#1976d2'; // primary
      case 'pending': return '#d32f2f'; // negative
      case 'closed': return '#388e3c'; // positive
      default: return '#757575'; // grey
    }
  };



  const formatTimeDistance = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'agora';
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`;
    return `${Math.floor(diffInMinutes / 1440)}d atrás`;
  };

  const TicketItem = ({ ticket }) => (
    <ListItem
      onClick={() => handleTicketClick(ticket)}
      sx={{
        borderLeft: `6px solid ${getStatusColor(ticket.status)}`,
        borderRadius: '10px',
        marginBottom: '8px',
        backgroundColor: selectedTicket?.id === ticket.id ? '#e3f2fd' : 'transparent',
        '&:hover': {
          backgroundColor: '#e3f2fd',
          transition: 'all 0.2s',
        },
        cursor: 'pointer',
        maxWidth: '370px',
        padding: '8px',
      }}
    >
      <ListItemAvatar sx={{ minWidth: '60px' }}>
        <Box sx={{ position: 'relative' }}>
          <Avatar 
            src={ticket.profilePicUrl || ticket.contact?.profilePicUrl}
            onClick={ticket.status === 'pending' ? (e) => {
              e.stopPropagation();
              handleStartAttendance(ticket);
            } : undefined}
            sx={{ 
              width: 40, 
              height: 40,
              cursor: ticket.status === 'pending' ? 'pointer' : 'default',
              border: ticket.status === 'pending' ? '2px solid #4caf50' : 'none',
              '&:hover': ticket.status === 'pending' ? { 
                transform: 'scale(1.05)',
                transition: 'transform 0.2s'
              } : {}
            }}
          >
            {(!ticket.profilePicUrl && !ticket.contact?.profilePicUrl) && 
              ((ticket.name || ticket.contact?.name || '?').charAt(0).toUpperCase())
            }
          </Avatar>

          {ticket.unreadMessages > 0 && (
            <Badge
              badgeContent={ticket.unreadMessages}
              color="primary"
              sx={{
                position: 'absolute',
                top: -5,
                right: -5,
                '& .MuiBadge-badge': {
                  backgroundColor: '#2196f3',
                  color: 'black',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                },
              }}
            />
          )}
        </Box>
      </ListItemAvatar>
      <ListItemText
        component="div"
        primaryTypographyProps={{ component: 'div' }}
        secondaryTypographyProps={{ component: 'div' }}
        primary={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ wordBreak: 'break-word' }}>
              {ticket.name || ticket.contact?.name || 'Contato sem nome'}
            </Typography>
            <Chip
              label={formatTimeDistance(ticket.lastMessageAt || ticket.updatedAt)}
              size="small"
              variant="outlined"
              sx={{
                fontSize: '0.7em',
                height: '20px',
                color: '#666',
                borderColor: '#ddd',
              }}
            />
          </Box>
        }
        secondary={
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, marginBottom: '4px' }}>
              <Typography
                component="div"
                variant="body2"
                color="text.secondary"
                sx={{ 
                  wordBreak: 'break-word',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  flex: 1
                }}
              >
                {ticket.lastMessage || ticket.body || 'Sem mensagem'}
              </Typography>
              {ticket.lastMessageFromMe && (
                <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {ticket.lastMessageStatus === 'pending' && (
                    <CheckIcon sx={{ fontSize: 14, color: 'grey.400' }} />
                  )}
                  {ticket.lastMessageStatus === 'sended' && (
                    <CheckIcon sx={{ fontSize: 14, color: 'grey.600' }} />
                  )}
                  {ticket.lastMessageStatus === 'received' && (
                    <DoneAllIcon sx={{ fontSize: 14, color: 'grey.600' }} />
                  )}
                  {ticket.lastMessageStatus === 'read' && (
                    <DoneAllIcon sx={{ fontSize: 14, color: '#1976d2' }} />
                  )}
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  label={ticket.whatsapp?.name || 'WhatsApp'}
                  size="small"
                  sx={{
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    fontSize: '0.7rem',
                    height: '20px',
                    fontWeight: 'bold',
                  }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '16px', color: '#1976d2' }}>
                  {getChannelIcon(ticket.whatsapp?.type || ticket.channel || 'whatsapp')}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                 <Typography component="div" variant="caption" fontWeight="bold">
                   #{ticket.id}
                 </Typography>
                 {ticket.status === 'closed' && (
                   <CheckCircleIcon color="success" sx={{ fontSize: '1.2rem' }} />
                 )}
               </Box>
            </Box>
            <Typography component="div" variant="caption" color="text.secondary">
              Usuário: {ticket.username || ticket.user?.name || ticket.assignedUser || 'N/A'}
            </Typography>
            <Typography component="div" variant="caption" color="text.secondary">
              Fila: {ticket.queue?.name || ticket.queueName || ticket.whatsapp?.name || 'N/A'}
            </Typography>
          </Box>
        }
      />
    </ListItem>
  );

  const Sidebar = () => (
      <Drawer
        variant="permanent"
        anchor="left"
        open={true}
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%',
            borderRight: '1px solid #e0e0e0',
            zIndex: 0,
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h6" sx={{ mb: 1, fontSize: '1rem' }}>
              {getPageTitle()}
            </Typography>
            
            {/* Busca */}
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar atendimentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1 }}
            />
            
            {/* Filtros */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button
                size="small"
                variant={filterMode === 'todos' ? 'contained' : 'outlined'}
                onClick={() => setFilterMode('todos')}
                sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
              >
                Todos
              </Button>
              <Button
                size="small"
                variant={filterMode === 'meus' ? 'contained' : 'outlined'}
                onClick={() => setFilterMode('meus')}
                sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
              >
                Meus
              </Button>
              <Button
                size="small"
                variant={filterMode === 'fila' ? 'contained' : 'outlined'}
                onClick={() => setFilterMode('fila')}
                sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
              >
                Fila
              </Button>
            </Box>
          </Box>

          <Divider />

          {/* Lista de tickets */}
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2">Carregando...</Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {filteredTickets.map((ticket) => (
                  <TicketItem key={ticket.id} ticket={ticket} />
                ))}
                {filteredTickets.length === 0 && (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhum atendimento encontrado
                    </Typography>
                  </Box>
                )}
              </List>
            )}
          </Box>
        </Box>
      </Drawer>
    );

  const DetailsPanel = ({ selectedTicket, setDetailsOpen, detailsOpen, theme, formatTime }) => {
    // Não renderiza o painel se não há ticket selecionado
    if (!selectedTicket) {
      return null;
    }
    
    return (
      <Drawer
        variant="persistent"
        anchor="right"
        open={detailsOpen}
        sx={{
          width: DETAILS_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DETAILS_WIDTH,
            boxSizing: 'border-box',
            position: 'absolute',
            right: 0,
            top: 0,
            height: '100vh',
            borderLeft: '1px solid #e0e0e0',
            zIndex: 1200,
          },
        }}
      >
        {selectedTicket && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h6" sx={{ fontSize: '0.9rem' }}>
                Detalhes
              </Typography>
            </Box>
            
            {/* Informações do contato */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>
              <Avatar 
                src={selectedTicket.profilePicUrl || selectedTicket.contact?.profilePicUrl}
                sx={{ 
                  width: 100, 
                  height: 100, 
                  mx: 'auto', 
                  mb: 2,
                  border: '1px solid #9e9e9ea1'
                }}
              >
                {(!selectedTicket.profilePicUrl && !selectedTicket.contact?.profilePicUrl) && 
                  <span style={{ fontSize: '60px', color: '#9e9e9e' }}>
                    {(selectedTicket.name || selectedTicket.contact?.name || '?').charAt(0).toUpperCase()}
                  </span>
                }
              </Avatar>
              
              <Typography variant="body1" sx={{ fontWeight: 500, mb: 1, fontSize: '14px' }}>
                {selectedTicket.name || selectedTicket.contact?.name || 'Usuário'}
              </Typography>
              
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mb: 1, 
                  fontSize: '14px',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' }
                }}
                onClick={() => {
                  const number = selectedTicket.number || selectedTicket.contact?.number;
                  if (number) {
                    navigator.clipboard?.writeText(number);
                  }
                }}
              >
                {selectedTicket.number || selectedTicket.contact?.number || 'N/A'}
              </Typography>
              
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mb: 2, 
                  fontSize: '14px',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' }
                }}
                onClick={() => {
                  const email = selectedTicket.email || selectedTicket.contact?.email;
                  if (email) {
                    navigator.clipboard?.writeText(email);
                  }
                }}
              >
                {selectedTicket.email || selectedTicket.contact?.email || 'N/A'}
              </Typography>
              
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                size="small"
                sx={{ 
                  borderRadius: '20px',
                  textTransform: 'none',
                  fontSize: '12px'
                }}
              >
                Editar Contato
              </Button>
            </Box>
            
            {/* Seção de Logs */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
              <Button
                variant="contained"
                startIcon={<TimelineIcon />}
                fullWidth
                size="small"
                onClick={() => loadTicketLogs(selectedTicket.id)}
                sx={{ 
                  borderRadius: '20px',
                  textTransform: 'none',
                  fontSize: '12px',
                  bgcolor: '#1976d2'
                }}
              >
                Logs
              </Button>
            </Box>
            
            {/* Seção de Etiquetas */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Etiquetas
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selectedTicket.contact?.tags?.length > 0 ? (
                  selectedTicket.contact.tags.map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag.tag || tag}
                      size="small"
                      sx={{ 
                        fontSize: '0.7rem',
                        bgcolor: tag.color || '#e3f2fd',
                        color: '#1976d2'
                      }}
                    />
                  ))
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Nenhuma etiqueta
                  </Typography>
                )}
              </Box>
            </Box>
            
            {/* Informações do Ticket */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                TICKET #{selectedTicket.id}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.8rem' }}>
                {selectedTicket.body}
              </Typography>
              <Chip
                label={selectedTicket.queue?.name || 'N/A'}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem' }}
              />
              {selectedTicket.user && (
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Atribuído a: {selectedTicket.user.name || selectedTicket.user.email || 'N/A'}
                  </Typography>
                </Box>
              )}
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {formatTime(selectedTicket.lastMessageAt)}
                </Typography>
              </Box>
            </Box>
            
            {/* Botão de atender ticket */}
            {selectedTicket.status !== 'open' && (
              <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={() => handleAcceptTicket(selectedTicket.id)}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    py: 1.5
                  }}
                >
                  Atender Ticket
                </Button>
              </Box>
            )}
            
            {/* Etiquetas */}
            <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', mt: 'auto' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                ETIQUETAS
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Nenhuma etiqueta definida
              </Typography>
            </Box>
          </Box>
        )}
      </Drawer>
      );
    };

  return (
    <MainLayout>
      <Box sx={{ display: 'flex', height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
        {/* Sidebar de atendimentos */}
        <Sidebar />      
        
        {/* Conteúdo principal */}
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: detailsOpen && selectedTicket ? `calc(100% - ${DETAILS_WIDTH}px)` : '100%',
            transition: theme.transitions.create(['width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.standard,
            }),
          }}
        >
          {/* Área principal - Chat */}
          <ChatWindow ticket={selectedTicket} />
        </Box>
        
        {/* Painel de detalhes */}
        <DetailsPanel
          selectedTicket={selectedTicket}
          setDetailsOpen={setDetailsOpen}
          detailsOpen={detailsOpen}
          theme={theme}
          formatTime={formatTime}
        />
      </Box>
      
      {/* Modal de Logs */}
      <Dialog
        open={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
            maxHeight: '600px'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon color="primary" />
            <Typography variant="h6">
              Logs Ticket: {selectedTicket?.id}
            </Typography>
          </Box>
          <IconButton onClick={() => setLogsModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
            {ticketLogs.length > 0 ? (
              <Timeline position="right">
                {ticketLogs.map((log, index) => {
                  const logConfig = messagesLog[log.type] || {
                    message: 'Ação desconhecida',
                    color: '#9e9e9e',
                    icon: <TimelineIcon />
                  };
                  
                  return (
                    <TimelineItem key={log.id || index}>
                      <TimelineOppositeContent
                        sx={{ m: 'auto 0', fontSize: '0.8rem' }}
                        align="right"
                        variant="body2"
                        color="text.secondary"
                      >
                        {formatDateTime(log.createdAt)}
                      </TimelineOppositeContent>
                      <TimelineSeparator>
                        <TimelineDot sx={{ bgcolor: logConfig.color }}>
                          {logConfig.icon}
                        </TimelineDot>
                        {index < ticketLogs.length - 1 && <TimelineConnector />}
                      </TimelineSeparator>
                      <TimelineContent sx={{ py: '12px', px: 2 }}>
                        <Typography variant="h6" component="span" sx={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {log.user?.name || 'Bot'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                          {logConfig.message}
                        </Typography>
                      </TimelineContent>
                    </TimelineItem>
                  );
                })}
              </Timeline>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <Typography variant="body2" color="text.secondary">
                  Nenhum log encontrado para este ticket.
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLogsModalOpen(false)} color="inherit">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  )
};

export default Atendimento;