import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Grid,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  CircularProgress,
  Tooltip,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  QrCode as QrCodeIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  WhatsApp as WhatsAppIcon,
  Telegram as TelegramIcon,
  Instagram as InstagramIcon
} from '@mui/icons-material';
import { channelService } from '../services/channelService';
import { chatFlowService } from '../services/chatFlowService';
import ChannelStatus from '../components/ChannelStatus';
import QRCode from 'qrcode'; // Adicionar esta importação
import useSocket from '../hooks/useSocket';
import { useNotification } from '../components/common/Notifications/NotificationProvider';
import { addDisconnectedChannel, removeDisconnectedChannel } from '../store/notificationSlice';

const Channels = () => {
  const dispatch = useDispatch();
  const { showNotification } = useNotification();
  const socket = useSocket();
  const [channels, setChannels] = useState([]);
  const [chatFlows, setChatFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'whatsapp',
    tokenTelegram: '',
    instagramUser: '',
    instagramKey: '',
    isDefault: false
  });

  // Adicionar estado para controle do QR code
  const [qrCodeState, setQrCodeState] = useState({
    lastUpdate: null,
    isExpired: false,
    reconnectAttempts: 0
  });

  const channelTypes = [
    { label: 'WhatsApp', value: 'whatsapp', icon: <WhatsAppIcon /> },
    { label: 'Telegram', value: 'telegram', icon: <TelegramIcon /> },
    { label: 'Instagram', value: 'instagram', icon: <InstagramIcon /> }
  ];

  // Definir loadChannels primeiro
  const loadChannels = useCallback(async () => {
    try {
      const response = await channelService.list();
      setChannels(response.data);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
      showNotification({
        type: 'error',
        title: 'Erro ao Carregar Canais',
        message: error.message || 'Não foi possível carregar a lista de canais.'
      });
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const loadChatFlows = useCallback(async () => {
    try {
      const response = await chatFlowService.list();
      setChatFlows(response.data.chatFlow || []);
    } catch (error) {
      console.error('Erro ao carregar fluxos:', error);
      showNotification({
        type: 'error',
        title: 'Erro ao Carregar Fluxos',
        message: error.message || 'Não foi possível carregar a lista de fluxos.'
      });
    }
  }, [showNotification]);

  // Agora podemos usar loadChannels nos outros useCallbacks
  const handleStartSession = useCallback(async (channelId) => {
    try {
      await channelService.startSession(channelId);
      loadChannels();
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
      showNotification({
        type: 'error',
        title: 'Erro ao Iniciar Sessão',
        message: error.message || 'Não foi possível iniciar a sessão.'
      });
    }
  }, [loadChannels, showNotification]);

  const handleRequestNewQrCode = useCallback(async (channelId) => {
    try {
      await channelService.requestNewQrCode(channelId);
      setQrCodeState(prev => ({
        ...prev,
        isExpired: false,
        lastUpdate: Date.now()
      }));
    } catch (error) {
      console.error('Erro ao solicitar novo QR code:', error);
      showNotification({
        type: 'error',
        title: 'Erro ao Solicitar QR Code',
        message: error.message || 'Não foi possível solicitar um novo QR code.'
      });
    }
  }, [showNotification]);

  // Primeiro useEffect com handleStartSession na dependência
  useEffect(() => {
    loadChannels();
    loadChatFlows();

    const handleWhatsappSessionUpdate = (event) => {
      const data = event.detail;
      
      if (data && (data.action === 'update' || data.action === 'session')) {
        loadChannels();
        
        if (data.session && (data.session.status === 'DISCONNECTED' || !data.session.status)) {
          dispatch(addDisconnectedChannel(data.session.id));
          showNotification({
            type: 'error',
            title: 'Canal Desconectado',
            message: `O canal ${data.session.name} foi desconectado.`,
            persistent: true,
            actions: [
              {
                label: 'Reconectar',
                onClick: () => handleStartSession(data.session.id)
              }
            ]
          });
        } else if (data.session && (data.session.status === 'CONNECTED' || data.session.status === 'OPEN')) {
          dispatch(removeDisconnectedChannel(data.session.id));
        }
        
        if (qrModalOpen && selectedChannel && data.session) {
          const updatedChannel = data.session;
          if (updatedChannel.id === selectedChannel.id && 
              (updatedChannel.status === 'CONNECTED' || updatedChannel.status === 'OPEN' || updatedChannel.status === 'AUTHENTICATED')) {
            setQrModalOpen(false);
            setSelectedChannel(null);
          }
        }
      }
    };

    window.addEventListener('whatsappSessionUpdate', handleWhatsappSessionUpdate);

    return () => {
      window.removeEventListener('whatsappSessionUpdate', handleWhatsappSessionUpdate);
    };
  }, [loadChannels, loadChatFlows, qrModalOpen, selectedChannel, dispatch, handleStartSession, showNotification]);

  // Segundo useEffect com todas as dependências necessárias
  useEffect(() => {
    if (!selectedChannel || !qrModalOpen || !socket?.connected) return;

    const channelId = selectedChannel.id;
    const tenantId = localStorage.getItem('tenantId');
    let expiryCheckInterval;

    const handleQrCodeUpdate = (data) => {
      if (data.session.id === channelId) {
        const now = Date.now();
        setQrCodeState(prev => ({
          ...prev,
          lastUpdate: now,
          isExpired: data.session.status === 'EXPIRED'
        }));

        setSelectedChannel(prev => ({
          ...prev,
          ...data.session
        }));

        if (data.session.status === 'EXPIRED') {
          handleRequestNewQrCode(channelId);
        }
      }
    };

    const handleHeartbeat = (data) => {
      if (data.session.id === channelId) {
        setQrCodeState(prev => ({
          ...prev,
          lastUpdate: Date.now()
        }));
      }
    };

    try {
      socket.on(`${tenantId}:whatsappSession`, handleQrCodeUpdate);
      socket.on(`${tenantId}:whatsappSession:heartbeat`, handleHeartbeat);

      expiryCheckInterval = setInterval(() => {
        const now = Date.now();
        if (qrCodeState.lastUpdate && (now - qrCodeState.lastUpdate) > 60000) {
          setQrCodeState(prev => ({
            ...prev,
            isExpired: true
          }));
          handleRequestNewQrCode(channelId);
        }
      }, 5000);

      return () => {
        if (socket?.connected) {
          socket.off(`${tenantId}:whatsappSession`, handleQrCodeUpdate);
          socket.off(`${tenantId}:whatsappSession:heartbeat`, handleHeartbeat);
        }
        if (expiryCheckInterval) {
          clearInterval(expiryCheckInterval);
        }
      };
    } catch (error) {
      console.error('Erro ao configurar WebSocket:', error);
      return () => {
        if (expiryCheckInterval) {
          clearInterval(expiryCheckInterval);
        }
      };
    }
  }, [
    selectedChannel,
    qrModalOpen,
    socket?.connected,
    handleRequestNewQrCode,
    qrCodeState.lastUpdate,
    socket
  ]);

  const handleOpenModal = (channel = null) => {
    if (channel) {
      setSelectedChannel(channel);
      setFormData({ ...channel });
    } else {
      setSelectedChannel(null);
      setFormData({
        name: '',
        type: 'whatsapp',
        tokenTelegram: '',
        instagramUser: '',
        instagramKey: '',
        isDefault: false
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedChannel(null);
    setFormData({
      name: '',
      type: 'whatsapp',
      tokenTelegram: '',
      instagramUser: '',
      instagramKey: '',
      isDefault: false
    });
  };

  const handleSaveChannel = async () => {
    try {
      if (selectedChannel) {
        await channelService.update(selectedChannel.id, formData);
      } else {
        await channelService.create(formData);
      }
      handleCloseModal();
      loadChannels();
    } catch (error) {
      console.error('Erro ao salvar canal:', error);
    }
  };

  const handleStopSession = async (channelId) => {
    try {
      await channelService.stopSession(channelId);
      loadChannels();
    } catch (error) {
      console.error('Erro ao parar sessão:', error);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (window.confirm('Tem certeza que deseja excluir este canal?')) {
      try {
        await channelService.delete(channelId);
        loadChannels();
      } catch (error) {
        console.error('Erro ao excluir canal:', error);
      }
    }
  };

  // FUNÇÃO CORRIGIDA
  const handleShowQrCode = async (channel) => {
    try {
      
      // Primeiro, vamos tentar iniciar a sessão
      await channelService.startSession(channel.id);
      
      // Função para verificar se o QR code está disponível
      const checkForQrCode = async (attempts = 0) => {
        if (attempts >= 15) {
          throw new Error('Timeout: QR Code não foi gerado após 45 segundos');
        }
        
        // Usar getSession para obter o status e QR code
        const response = await channelService.getSession(channel.id);
        
        const qrcode = response.data?.qrcode;
        const status = response.data?.status;
        
        // Se a sessão está conectada, não precisa de QR code
        if (status === 'CONNECTED' || status === 'OPEN') {
          throw new Error('Canal já está conectado');
        }
        
        // Verificar se temos dados de QR code
        if (qrcode && typeof qrcode === 'string' && qrcode.length > 10) {
          
          // Se já é uma imagem base64, usar como está
          if (qrcode.startsWith('data:image/')) {
            return qrcode;
          }
          
          // Se são dados do WhatsApp (formato: 2@xxx,xxx,1), gerar QR Code
          if (qrcode.startsWith('2@') && qrcode.includes(',')) {
            
            try {
              const qrCodeDataURL = await QRCode.toDataURL(qrcode, {
                type: 'png',
                quality: 0.92,
                margin: 2,
                width: 300,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });
              
              return qrCodeDataURL;
            } catch (qrError) {
              console.error('Erro ao gerar QR Code:', qrError);
              throw new Error('Erro ao gerar QR Code a partir dos dados');
            }
          }
          
          // Se é outro tipo de dados, tentar gerar QR Code mesmo assim
          try {
            const qrCodeDataURL = await QRCode.toDataURL(qrcode, {
              type: 'png',
              quality: 0.92,
              margin: 2,
              width: 300,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            
            return qrCodeDataURL;
          } catch (qrError) {
            console.error('Erro ao gerar QR Code genérico:', qrError);
            // Continuar tentando
          }
        }
        
        // Continuar tentando se não temos dados ainda ou se houve erro
        if (status === 'INITIALIZING' || status === 'QRCODE' || status === 'OPENING' || !qrcode) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          return checkForQrCode(attempts + 1);
        }
        
        // Aguardar e tentar novamente para outros casos
        await new Promise(resolve => setTimeout(resolve, 3000));
        return checkForQrCode(attempts + 1);
      };
      
      const qrcode = await checkForQrCode();
      setSelectedChannel({ ...channel, qrcode });
      setQrModalOpen(true);
      
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      console.error('Detalhes do erro:', error.response?.data);
      
      if (error.message.includes('já está conectado')) {
        alert('Este canal já está conectado ao WhatsApp.');
      } else if (error.message.includes('Timeout')) {
        alert('Timeout: O QR Code não foi gerado. Tente novamente.');
      } else if (error.message.includes('Erro ao gerar QR Code')) {
        alert('Erro ao gerar QR Code. Verifique se os dados estão corretos.');
      } else {
        alert(`Erro ao obter QR Code: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  const handleUpdateChannelBot = async (channelId, chatFlowId) => {
    try {
      await channelService.update(channelId, { chatFlowId });
      loadChannels();
    } catch (error) {
      console.error('Erro ao atualizar bot do canal:', error);
    }
  };

  const getChannelIcon = (type) => {
    const channelType = channelTypes.find(ct => ct.value === type);
    return channelType ? channelType.icon : <WhatsAppIcon />;
  };

  // Função para limpar cache da sessão
  const handleClearSessionCache = async (channelId) => {
    try {
      await channelService.clearSessionCache(channelId);
      showNotification({
        type: 'success',
        title: 'Cache Limpo',
        message: 'O cache da sessão foi limpo com sucesso.'
      });
      // Recarregar a lista de canais
      loadChannels();
    } catch (error) {
      console.error('Erro ao limpar cache da sessão:', error);
      showNotification({
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível limpar o cache da sessão.'
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Canais
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenModal()}
        >
          Adicionar Canal
        </Button>
      </Box>

      <Grid container spacing={3}>
          {channels.map((channel) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={channel.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                    {getChannelIcon(channel.type)}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="div">
                      {channel.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {channel.type}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenModal(channel)}
                  >
                    <EditIcon />
                  </IconButton>
                </Box>

                <Divider sx={{ my: 2 }} />

                <ChannelStatus item={channel} />

                {channel.type === 'messenger' && channel.fbObject && (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Página:</strong> {channel.fbObject.name || 'Nenhuma página configurada'}
                  </Typography>
                )}

                {channel.number && (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Número:</strong> {channel.number}
                  </Typography>
                )}

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Bot</InputLabel>
                  <Select
                    value={channel.chatFlowId || ''}
                    label="Bot"
                    onChange={(e) => handleUpdateChannelBot(channel.id, e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Nenhum</em>
                    </MenuItem>
                    {Array.isArray(chatFlows) && chatFlows.map((flow) => (
                      <MenuItem key={flow.id} value={flow.id}>
                        {flow.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </CardContent>

              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                {channel.type !== 'messenger' && (
                  <>
                    {(channel.status === 'qrcode' && channel.qrcode && channel.qrcode.length > 10) && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<QrCodeIcon />}
                        onClick={() => handleShowQrCode(channel)}
                      >
                        QR Code
                      </Button>
                    )}

                    {(channel.status === 'DISCONNECTED' || !channel.status) && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<PlayIcon />}
                        onClick={() => handleStartSession(channel.id)}
                      >
                        Conectar
                      </Button>
                    )}

                    {(channel.status === 'CONNECTED' || channel.status === 'OPEN') && (
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<StopIcon />}
                        onClick={() => handleStopSession(channel.id)}
                      >
                        Desconectar
                      </Button>
                    )}

                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={() => handleClearSessionCache(channel.id)}
                    >
                      Limpar Cache
                    </Button>
                  </>
                )}

                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteChannel(channel.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Modal de Criação/Edição */}
      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedChannel ? 'Editar Canal' : 'Adicionar Canal'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={formData.type}
                label="Tipo"
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                disabled={!!selectedChannel}
              >
                {channelTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {type.icon}
                      <Typography sx={{ ml: 1 }}>{type.label}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Nome"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={{ mb: 2 }}
            />

            {formData.type === 'telegram' && (
              <TextField
                fullWidth
                label="Token Telegram"
                value={formData.tokenTelegram}
                onChange={(e) => setFormData({ ...formData, tokenTelegram: e.target.value })}
                sx={{ mb: 2 }}
              />
            )}

            {formData.type === 'instagram' && (
              <>
                <TextField
                  fullWidth
                  label="Usuário Instagram"
                  value={formData.instagramUser}
                  onChange={(e) => setFormData({ ...formData, instagramUser: e.target.value })}
                  helperText="Seu usuário do Instagram (sem @)"
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Senha Instagram"
                  type="password"
                  value={formData.instagramKey}
                  onChange={(e) => setFormData({ ...formData, instagramKey: e.target.value })}
                  sx={{ mb: 2 }}
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancelar</Button>
          <Button onClick={handleSaveChannel} variant="contained">
            {selectedChannel ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal QR Code */}
      <Dialog 
        open={qrModalOpen} 
        onClose={() => {
          setQrModalOpen(false);
          setQrCodeState({
            lastUpdate: null,
            isExpired: false,
            reconnectAttempts: 0
          });
        }}
      >
        <DialogTitle>
          QR Code - {selectedChannel?.name}
          {qrCodeState.isExpired && (
            <Typography variant="caption" color="error" sx={{ ml: 2 }}>
              QR Code expirado
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedChannel?.qrcode ? (
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <img
                src={selectedChannel.qrcode}
                alt="QR Code"
                style={{ 
                  maxWidth: '300px', 
                  maxHeight: '300px', 
                  width: '100%', 
                  height: 'auto',
                  opacity: qrCodeState.isExpired ? 0.5 : 1,
                  transition: 'opacity 0.3s ease'
                }}
                onError={(e) => {
                  console.error('Error loading QR code:', selectedChannel.qrcode);
                  e.target.parentNode.innerHTML = '<div style="padding: 20px; text-align: center; color: #f44336;">Erro ao carregar QR Code. Dados inválidos.</div>';
                }}
              />
              <Typography variant="body2" sx={{ mt: 2 }}>
                {qrCodeState.isExpired 
                  ? 'QR Code expirado. Tentando gerar um novo...'
                  : 'Escaneie o QR Code com seu WhatsApp'}
              </Typography>
              {qrCodeState.isExpired && (
                <CircularProgress size={20} sx={{ ml: 1 }} />
              )}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Gerando QR Code...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => handleRequestNewQrCode(selectedChannel?.id)}
            disabled={!qrCodeState.isExpired}
          >
            Solicitar Novo QR Code
          </Button>
          <Button onClick={() => setQrModalOpen(false)}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Channels;