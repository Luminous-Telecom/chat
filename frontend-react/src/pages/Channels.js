import React, { useState, useEffect } from 'react';
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
  Alert
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

const Channels = () => {
  const [channels, setChannels] = useState([]);
  const [chatFlows, setChatFlows] = useState([]);
  const [, setLoading] = useState(false);
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

  const channelTypes = [
    { label: 'WhatsApp', value: 'whatsapp', icon: <WhatsAppIcon /> },
    { label: 'Telegram', value: 'telegram', icon: <TelegramIcon /> },
    { label: 'Instagram', value: 'instagram', icon: <InstagramIcon /> }
  ];

  useEffect(() => {
    loadChannels();
    loadChatFlows();

    // Listener para atualizações de sessão WhatsApp via socket
    const handleWhatsappSessionUpdate = (event) => {
      const data = event.detail;
      
      // Recarrega a lista de canais quando há mudança de status
      if (data && (data.action === 'update' || data.action === 'session')) {
        loadChannels();
        
        // Se o modal QR está aberto e o canal foi conectado, fechar o modal
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

    // Cleanup
    return () => {
      window.removeEventListener('whatsappSessionUpdate', handleWhatsappSessionUpdate);
    };
  }, [qrModalOpen, selectedChannel]);

  // UseEffect para monitorar mudanças no selectedChannel e fechar modal quando conectado
  useEffect(() => {
    if (qrModalOpen && selectedChannel) {
      // Verificar periodicamente o status do canal
      const checkChannelStatus = async () => {
        try {
          const response = await channelService.getSession(selectedChannel.id);
          const currentStatus = response.data?.status;
          
          if (currentStatus === 'CONNECTED' || currentStatus === 'OPEN' || currentStatus === 'AUTHENTICATED') {
            setQrModalOpen(false);
            setSelectedChannel(null);
            // Recarregar a lista de canais para atualizar o status
            loadChannels();
          }
        } catch (error) {
          console.error('Erro ao verificar status do canal:', error);
        }
      };

      // Verificar imediatamente
      checkChannelStatus();
      
      // Verificar a cada 3 segundos enquanto o modal estiver aberto
      const interval = setInterval(checkChannelStatus, 3000);
      
      return () => clearInterval(interval);
    }
  }, [qrModalOpen, selectedChannel]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const response = await channelService.list();
      setChannels(response.data);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatFlows = async () => {
    try {
      const response = await chatFlowService.list();
      setChatFlows(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar chat flows:', error);
      setChatFlows([]);
    }
  };

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

  const handleStartSession = async (channelId) => {
    try {
      await channelService.startSession(channelId);
      loadChannels();
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
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
      <Dialog open={qrModalOpen} onClose={() => setQrModalOpen(false)}>
        <DialogTitle>QR Code - {selectedChannel?.name}</DialogTitle>
        <DialogContent>
          {selectedChannel?.qrcode ? (
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <img
                src={selectedChannel.qrcode}
                alt="QR Code"
                style={{ maxWidth: '300px', maxHeight: '300px', width: '100%', height: 'auto' }}
                onError={(e) => {
                  console.error('Error loading QR code:', selectedChannel.qrcode);
                  e.target.parentNode.innerHTML = '<div style="padding: 20px; text-align: center; color: #f44336;">Erro ao carregar QR Code. Dados inválidos.</div>';
                }}
              />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Escaneie o QR Code com seu WhatsApp
              </Typography>
            </Box>
          ) : (
            <Alert severity="info">
              QR Code não disponível. Tente reconectar o canal.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrModalOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Channels;