import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../components/common/Layout/MainLayout';
import ChatWindow from '../components/ChatWindow';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { ticketService } from '../services/api';

const Chat = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTicket = async () => {
      try {
        if (ticketId) {
          const response = await ticketService.getById(ticketId);
          setTicket(response);
        }
      } catch (error) {
        console.error('Erro ao carregar ticket:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [ticketId]);

  const handleBack = () => {
    navigate('/atendimento');
  };

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Typography>Carregando...</Typography>
        </Box>
      </MainLayout>
    );
  }

  if (!ticket) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Typography>Ticket não encontrado</Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header do Chat */}
        <Paper 
          elevation={1} 
          sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center', 
            borderRadius: 0,
            borderBottom: '1px solid #e0e0e0'
          }}
        >
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <PersonIcon sx={{ mr: 2, color: 'text.secondary' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {ticket.name || ticket.contact?.name || 'Contato sem nome'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Ticket #{ticket.id} • Status: {ticket.status}
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Divider />

        {/* Área do Chat */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <ChatWindow selectedTicket={ticket} />
        </Box>
      </Box>
    </MainLayout>
  );
};

export default Chat;