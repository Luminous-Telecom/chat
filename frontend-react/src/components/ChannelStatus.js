import React from 'react';
import {
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
import {
  QrCode as QrCodeIcon,
  WifiOff as WifiOffIcon,
  Wifi as WifiIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ChannelStatus = ({ item }) => {
  const formatDate = (date, formatStr) => {
    return format(parseISO(date), formatStr, { locale: ptBR });
  };

  const getStatusIcon = () => {
    switch (item.status) {
      case 'qrcode':
        return <QrCodeIcon sx={{ fontSize: 40, color: 'primary.main' }} />;
      case 'DISCONNECTED':
        return <WifiOffIcon sx={{ fontSize: 40, color: 'error.main' }} />;
      case 'CONNECTED':
        return <WifiIcon sx={{ fontSize: 40, color: 'success.main' }} />;
      case 'PAIRING':
      case 'TIMEOUT':
        return <WarningIcon sx={{ fontSize: 40, color: 'error.main' }} />;
      case 'OPENING':
        return <CircularProgress size={40} sx={{ color: 'success.main' }} />;
      default:
        return <WarningIcon sx={{ fontSize: 40, color: 'warning.main' }} />;
    }
  };

  const getStatusMessage = () => {
    switch (item.status) {
      case 'qrcode':
        return {
          title: 'Esperando leitura do QR Code',
          description: "Clique no botão 'QR CODE' e leia o QR Code com o seu celular para iniciar a sessão"
        };
      case 'DISCONNECTED':
        let description = 'Falha ao iniciar comunicação para este canal.';
        if (item.type === 'whatsapp') {
          description += ' Certifique-se de que seu celular esteja conectado à internet e tente novamente, ou solicite um novo QR Code';
        } else if (item.type === 'telegram') {
          description += ' Tente conectar novamente. Caso o erro permaneça, confirme se o token está correto.';
        } else if (item.type === 'instagram') {
          description += ' Tente conectar novamente. Caso o erro permaneça, confirme se as credenciais estão corretas.';
        }
        return {
          title: 'Desconectado',
          description
        };
      case 'CONNECTED':
        return {
          title: 'Conexão estabelecida!',
          description: 'Canal funcionando normalmente'
        };
      case 'PAIRING':
      case 'TIMEOUT':
        return {
          title: 'A conexão com o celular foi perdida',
          description: "Certifique-se de que seu celular esteja conectado à internet e o WhatsApp esteja aberto, ou clique no botão 'Desconectar' para obter um novo QR Code"
        };
      case 'OPENING':
        if (item.type === 'whatsapp') {
          return {
            title: 'Aguardando QR Code',
            description: 'Preparando QR Code para leitura. Clique no botão "QR CODE" quando aparecer.'
          };
        }
        return {
          title: 'Estabelecendo conexão',
          description: 'Isso poderá demorar um pouco...'
        };
      default:
        return {
          title: 'Status desconhecido',
          description: 'Verifique a conexão'
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', p: 2 }}>
      <Box sx={{ mr: 2, mt: 0.5 }}>
        {getStatusIcon()}
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'medium', mb: 1 }}>
          {statusMessage.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {statusMessage.description}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Última Atualização: {formatDate(item.updatedAt, 'dd/MM/yyyy HH:mm')}
        </Typography>
      </Box>
    </Box>
  );
};

export default ChannelStatus;