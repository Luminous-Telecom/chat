import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  List,
  ListItem,
  Avatar,
  CircularProgress,
  Divider,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Link
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  SupportAgent as SupportAgentIcon,
  Schedule as ScheduleIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  AudioFile as AudioIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  VideoFile as VideoIcon,
  AttachFile as FileIcon,
  Download as DownloadIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  Visibility as VisibilityIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiEmotionsIcon,
  FlashOn as FlashOnIcon,
  Mic as MicIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ticketService } from '../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmojiPicker from 'emoji-picker-react';
import useMessageSocket from '../hooks/useMessageSocket';
import { debounce } from '../utils';

const ChatWindow = ({ ticket }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(null);
  const [scheduledMessage, setScheduledMessage] = useState(''); 
  const [audioRecording, setAudioRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [fileInputRef] = useState(React.createRef());
  const messagesEndRef = useRef(null);
  const audioRef = useRef({});
  const waveformRefs = useRef({});
  const [autoScroll, setAutoScroll] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  // Callbacks para eventos de mensagem
  const handleNewMessage = useCallback((message) => {
    setMessages(prevMessages => {
      // Verificar se a mensagem já existe para evitar duplicatas
      const messageExists = prevMessages.some(msg => msg.id === message.id);
      if (messageExists) return prevMessages;
      
      const updatedMessages = [...prevMessages, message];
      
      // Marcar como lida se não for do usuário
      if (!message.fromMe && markMessageAsRead) {
        markMessageAsRead(message.id, ticket.id);
      }
      
      return updatedMessages;
    });
    
    // Auto scroll para nova mensagem
    setTimeout(() => scrollToBottom(), 100);
  }, [ticket?.id]);

  const handleMessageUpdate = useCallback((updatedMessage) => {
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
      )
    );
  }, []);

  const handleTypingIndicator = useCallback((data) => {
    if (!data.fromMe) {
      setIsTyping(data.isTyping);
    }
  }, []);

  // Hook para gerenciar mensagens via socket
  const { 
    sendTypingIndicator, 
    markMessageAsRead, 
    sendMessage: sendMessageSocket,
    isConnected 
  } = useMessageSocket(ticket, handleNewMessage, handleMessageUpdate, handleTypingIndicator);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current && autoScroll) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto' 
      });
    }
  };

  // Detectar se o usuário scrollou para cima
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
    setAutoScroll(isAtBottom);
  };

  // Indicador de digitação
  const handleTyping = () => {
    // Emitir evento de digitação via socket
    if (sendTypingIndicator && ticket?.id) {
      sendTypingIndicator(ticket.id, true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      // Parar indicador de digitação
      if (sendTypingIndicator && ticket?.id) {
        sendTypingIndicator(ticket.id, false);
      }
    }, 1000);
  };

  // Prevenir recarregamento desnecessário das mensagens
  const ticketIdRef = useRef(null);
  const isFirstLoad = useRef(true);
  
  useEffect(() => {
    if (ticket?.id && ticket.id !== ticketIdRef.current) {
      ticketIdRef.current = ticket.id;
      isFirstLoad.current = true;
      setMessages([]);
      loadMessages();
    } else if (!ticket?.id) {
      // Limpar mensagens quando não há ticket selecionado
      setMessages([]);
      ticketIdRef.current = null;
      isFirstLoad.current = true;
    }
  }, [ticket]);

  useEffect(() => {
    if (messages.length > 0) {
      // Na primeira carga, vai direto para a última mensagem sem animação
      if (isFirstLoad.current) {
        scrollToBottom(false);
        isFirstLoad.current = false;
      } else {
        // Para novas mensagens, usa scroll suave
        scrollToBottom(true);
      }
    }
  }, [messages]);

  // Cleanup para evitar memory leaks
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Otimização: Debounce para carregamento de mensagens
  const debouncedLoadMessages = useCallback(
    debounce(async () => {
      if (!ticket?.id) return;
      
      setLoading(true);
      try {
        const response = await ticketService.getMessages(ticket.id, {
          pageNumber: 1,
          pageSize: 50
        });
        
        const newMessages = response.messages || [];
        // Ordenar mensagens por data de criação (mais antigas primeiro)
        const sortedMessages = newMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(sortedMessages);
      } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
        // Fallback com mensagens simuladas apenas em desenvolvimento
        if (process.env.NODE_ENV === 'development') {
          const simulatedMessages = [
            {
              id: 1,
              body: ticket.body || 'Olá, preciso de ajuda!',
              fromMe: false,
              createdAt: new Date().toISOString(),
              contact: ticket.contact
            },
            {
              id: 2,
              body: 'Olá! Como posso ajudá-lo hoje?',
              fromMe: true,
              createdAt: new Date().toISOString(),
              user: { name: 'Atendente' }
            }
          ];
          setMessages(simulatedMessages);
        }
      } finally {
        setLoading(false);
      }
    }, 300),
    [ticket?.id]
  );

  // Substituir loadMessages original
  const loadMessages = debouncedLoadMessages;



  // Melhorar handleSendMessage com retry automático
  const handleSendMessage = async (retryCount = 0) => {
    if (!newMessage.trim() || !ticket?.id || sending) return;

    // Se não for uma tentativa de retry, setar sending como true
    if (retryCount === 0) {
      setSending(true);
    }

    try {
      const response = await ticketService.sendMessage(ticket.id, {
        body: newMessage.trim()
      });
      
      // Emitir evento de nova mensagem via socket
      if (sendMessageSocket && response.data) {
        sendMessageSocket(ticket.id, response.data);
      }
      
      setNewMessage('');
      
      // Parar indicador de digitação
      if (sendTypingIndicator) {
        sendTypingIndicator(ticket.id, false);
      }

      // Resetar sending apenas se não for uma tentativa de retry
      if (retryCount === 0) {
        setSending(false);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      
      // Retry automático até 2 tentativas
      if (retryCount < 2) {
        setTimeout(() => {
          handleSendMessage(retryCount + 1);
        }, 1000 * (retryCount + 1));
      } else {
        // Mostrar erro ao usuário após tentativas falharem
        alert('Erro ao enviar mensagem. Verifique sua conexão e tente novamente.');
        // Resetar sending apenas na última tentativa
        setSending(false);
      }
    }
  };

  const handleScheduleMessage = async () => {
    if (!scheduledMessage.trim() || !scheduleDate || !ticket?.id) {
      alert('Por favor, preencha a mensagem e selecione uma data/hora.');
      return;
    }

    try {
      await ticketService.sendMessage(ticket.id, {
        body: scheduledMessage.trim(),
        scheduleDate: scheduleDate.toISOString(),
        fromMe: true
      });
      
      setScheduledMessage('');
      setScheduleDate(null);
      setScheduleModalOpen(false);
      
      // Recarregar mensagens para mostrar a mensagem agendada
      loadMessages();
    } catch (error) {
      console.error('Erro ao agendar mensagem:', error);
      alert('Erro ao agendar mensagem. Tente novamente.');
    }
  };

  const openScheduleModal = () => {
    setScheduleModalOpen(true);
    setScheduledMessage('');
    setScheduleDate(null);
  };

  const closeScheduleModal = () => {
    setScheduleModalOpen(false);
    setScheduledMessage('');
    setScheduleDate(null);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };



  const formatMessageTime = (dateString) => {
    try {
      return format(new Date(dateString), 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  // Função para lidar com upload de arquivos
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Verificar tamanho do arquivo (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Tamanho máximo: 10MB');
      return;
    }

    // Criar preview do arquivo
    const fileUrl = URL.createObjectURL(file);
    const fileType = file.type.split('/')[0]; // image, video, audio, etc.
    
    // Criar mensagem temporária com arquivo
    const tempFileMessage = {
      id: Date.now(),
      body: `📎 ${file.name}`,
      mediaUrl: fileUrl,
      mediaType: fileType,
      fileName: file.name,
      fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      fromMe: true,
      timestamp: new Date(),
      ticketId: ticket.id,
      sending: true // Indicador de que está sendo enviado
    };

    // Adicionar mensagem temporária à lista
    setMessages(prev => [...prev, tempFileMessage]);
    setSending(true);
    
    try {
      // Preparar FormData para upload
      const formData = new FormData();
      formData.append('medias', file);
      formData.append('body', `📎 ${file.name}`);
      
      // Fazer upload real para o servidor
      const response = await ticketService.uploadFile(ticket.id, formData);
      
      // Atualizar mensagem com dados do servidor
      setMessages(prev => prev.map(msg => 
        msg.id === tempFileMessage.id 
          ? { ...response, id: response.id || tempFileMessage.id, sending: false }
          : msg
      ));
      
      // Enviar via socket se disponível
      if (sendMessageSocket && response) {
        sendMessageSocket(ticket.id, response);
      }
      
      console.log('Arquivo enviado com sucesso:', file.name);
      
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      
      // Remover mensagem temporária em caso de erro
      setMessages(prev => prev.filter(msg => msg.id !== tempFileMessage.id));
      
      // Mostrar erro para o usuário
      alert('Erro ao enviar arquivo. Tente novamente.');
    } finally {
      setSending(false);
      // Limpar o input
      event.target.value = '';
    }
  };

  // Função para inserir emoji
  const handleEmojiSelect = (emojiData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setEmojiPickerOpen(false);
  };

  // Função para iniciar gravação de áudio
  const startAudioRecording = async () => {
    try {
      // Verificar se o navegador suporta as APIs necessárias
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Seu navegador não suporta gravação de áudio');
      }

      if (!window.MediaRecorder) {
        throw new Error('Seu navegador não suporta MediaRecorder');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        // Aqui você enviaria o áudio
        console.log('Audio recorded:', blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioRecording(true);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      alert('Erro ao acessar o microfone. Verifique as permissões do navegador.');
    }
  };

  // Função para parar gravação de áudio
  const stopAudioRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setAudioRecording(false);
      setMediaRecorder(null);
    }
  };

  // Fechar emoji picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerOpen && !event.target.closest('[data-emoji-picker]')) {
        setEmojiPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [emojiPickerOpen]);

  if (!ticket) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#f5f5f5'
        }}
      >
        <Box
          component="img"
          src="/logo-empresa.png"
          alt="Izing Logo"
          sx={{
            width: '200px',
            height: 'auto',
            opacity: 0.6,
            mb: 2
          }}
        />
        <Typography variant="h6" color="text.secondary" sx={{ opacity: 0.7 }}>
          Selecione um atendimento para iniciar
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#f5f5f5'
      }}
    >
      {/* Header do chat */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          borderRadius: 0,
          borderBottom: '1px solid #e0e0e0'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar 
            src={ticket.profilePicUrl}
            sx={{ bgcolor: '#1976d2', width: 50, height: 50 }}
          >
            {!ticket.profilePicUrl && 
              (ticket.name?.charAt(0) || 'U')
            }
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {ticket.name || 'Usuário'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {ticket.number || 'Número não disponível'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Ticket #{ticket.id || 'N/A'}
            </Typography>
            {ticket.user && (
              <Typography variant="caption" color="text.secondary" display="block">
                Atribuído a: {ticket.user.name || ticket.user.email || 'N/A'}
              </Typography>
            )}
          </Box>

        </Box>
      </Paper>

      {/* Área de mensagens */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 1,
          backgroundColor: '#e5ddd5',
          minHeight: 0,
          position: 'relative'
        }}
        onScroll={handleScroll}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%'
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
              {messages.map((message) => (
                <ListItem
                  key={message.id}
                  sx={{
                    display: 'flex',
                    justifyContent: message.fromMe ? 'flex-end' : 'flex-start',
                    mb: 1,
                    p: 0
                  }}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 0.5,
                      maxWidth: '70%',
                      backgroundColor: message.scheduleDate && message.status === 'pending'
                        ? '#fff3e0'
                        : message.fromMe
                        ? '#dcf8c6'
                        : '#ffffff',
                      borderRadius: message.fromMe
                        ? '18px 18px 4px 18px'
                        : '18px 18px 18px 4px',
                      border: message.scheduleDate && message.status === 'pending'
                        ? '1px solid #ff9800'
                        : 'none'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: message.mediaType === 'audio' ? 'center' : 'space-between', gap: 1 }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        {message.scheduleDate && (
                          <Chip
                            icon={<ScheduleIcon />}
                            label={`Programado para: ${format(new Date(message.scheduleDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`}
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ mb: 1, fontSize: '0.7rem' }}
                          />
                        )}
                        {/* Renderizar mídia se existir */}
                        {message.mediaUrl && message.mediaType && (
                          <Box sx={{ mb: message.mediaType === 'audio' ? 0 : 1, display: 'flex', justifyContent: 'center' }}>
                            {message.mediaType === 'image' && (
                              <Box
                                component="img"
                                src={message.mediaUrl}
                                alt="Imagem"
                                sx={{
                                  maxWidth: '300px',
                                  maxHeight: '300px',
                                  width: 'auto',
                                  height: 'auto',
                                  borderRadius: '8px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => window.open(message.mediaUrl, '_blank')}
                              />
                            )}
                            {message.mediaType === 'audio' && (
                              <Box 
                                data-audio-container
                                sx={{ 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  gap: 1, 
                                  minWidth: '200px',
                                  maxWidth: '280px',
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none',
                                  MozUserSelect: 'none',
                                  msUserSelect: 'none'
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <IconButton 
                                    size="small" 
                                    sx={{ 
                                      bgcolor: '#25d366', 
                                      color: 'white',
                                      width: 32,
                                      height: 32,
                                      '&:hover': {
                                        bgcolor: '#128c7e'
                                      }
                                    }}
                                    onClick={(e) => {
                                      const audio = e.currentTarget.closest('[data-audio-container]').querySelector('audio');
                                      
                                      if (!audio) return;
                                      
                                      if (audio.paused) {
                                        audio.play();
                                      } else {
                                        audio.pause();
                                      }
                                    }}
                                    className="audio-play-button"
                                  >
                                    <PlayArrowIcon sx={{ fontSize: 18 }} className="play-icon" />
                                    <PauseIcon sx={{ fontSize: 18, display: 'none' }} className="pause-icon" />
                                  </IconButton>
                                  <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                     <Box 
                                        sx={{ 
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '2px',
                                          flexGrow: 1, 
                                          height: 20,
                                          cursor: 'pointer',
                                          px: 1,
                                          userSelect: 'none',
                                          WebkitUserSelect: 'none',
                                          MozUserSelect: 'none',
                                          msUserSelect: 'none'
                                        }}
                                        onClick={(e) => {
                                          const audio = e.currentTarget.closest('[data-audio-container]').querySelector('audio');
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const clickX = e.clientX - rect.left;
                                          const width = rect.width;
                                          const percentage = clickX / width;
                                          if (audio && audio.duration) {
                                            audio.currentTime = percentage * audio.duration;
                                          }
                                        }}
                                        className="audio-waveform"
                                      >
                                        {[4, 8, 12, 6, 10, 14, 8, 16, 10, 6, 12, 8, 14, 10, 16, 12, 8, 6, 10, 14, 8, 12, 16, 10, 6, 8, 12, 14, 10, 16].map((height, index) => (
                                          <Box
                                            key={index}
                                            sx={{
                                              width: '2px',
                                              height: `${height}px`,
                                              bgcolor: 'rgba(0,0,0,0.3)',
                                              borderRadius: '1px',
                                              transition: 'background-color 0.1s'
                                            }}
                                            className={`wave-bar wave-bar-${index}`}
                                          />
                                        ))}
                                      </Box>
                                   </Box>
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      fontSize: '0.6rem', 
                                      color: '#25d366',
                                      cursor: 'pointer',
                                      fontWeight: 'bold',
                                      minWidth: '20px',
                                      textAlign: 'center',
                                      userSelect: 'none',
                                      WebkitUserSelect: 'none',
                                      MozUserSelect: 'none',
                                      msUserSelect: 'none',
                                      '&:hover': {
                                        bgcolor: 'rgba(37, 211, 102, 0.1)',
                                        borderRadius: '4px'
                                      }
                                    }}
                                    className="audio-speed"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      
                                      const container = e.currentTarget.closest('[data-audio-container]');
                                      const audio = container?.querySelector('audio');
                                      const speedText = e.currentTarget;
                                      
                                      if (!audio) return;
                                       
                                       let currentSpeed = parseFloat(speedText.textContent.replace('x', ''));
                                       let newSpeed;
                                       
                                       if (currentSpeed === 1) newSpeed = 1.5;
                                       else if (currentSpeed === 1.5) newSpeed = 2;
                                       else newSpeed = 1;
                                       
                                       audio.playbackRate = newSpeed;
                                       speedText.textContent = `${newSpeed}x`;
                                    }}
                                  >
                                    1x
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mt: 0.5, userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      fontSize: '0.7rem', 
                                      color: 'text.secondary',
                                      ml: 0,
                                      userSelect: 'none',
                                      WebkitUserSelect: 'none',
                                      MozUserSelect: 'none',
                                      msUserSelect: 'none'
                                    }}
                                    className="audio-duration"
                                  >
                                    0:00
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ 
                                      fontSize: '0.7rem',
                                      userSelect: 'none',
                                      WebkitUserSelect: 'none',
                                      MozUserSelect: 'none',
                                      msUserSelect: 'none'
                                    }}
                                  >
                                    {formatMessageTime(message.createdAt)}
                                  </Typography>
                                </Box>
                                <audio 
                                  style={{ display: 'none' }}
                                  crossOrigin="anonymous"
                                  onTimeUpdate={(e) => {
                                     const audio = e.target;
                                     const progress = (audio.currentTime / audio.duration) * 100;
                                     const container = audio.parentElement;
                                     const durationText = container.querySelector('.audio-duration');
                                     const waveBars = container.querySelectorAll('.wave-bar');
                                     
                                     // Atualizar tempo
                                     if (durationText) {
                                       const currentMinutes = Math.floor(audio.currentTime / 60);
                                       const currentSeconds = Math.floor(audio.currentTime % 60);
                                       const totalMinutes = Math.floor(audio.duration / 60);
                                       const totalSeconds = Math.floor(audio.duration % 60);
                                       durationText.textContent = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')} / ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
                                     }
                                     
                                     // Animar apenas as cores das ondas, mantendo as alturas originais
                                     const progressIndex = Math.floor((progress / 100) * waveBars.length);
                                     waveBars.forEach((bar, index) => {
                                       if (index <= progressIndex) {
                                         bar.style.backgroundColor = '#25d366';
                                       } else {
                                         bar.style.backgroundColor = 'rgba(0,0,0,0.3)';
                                       }
                                       // Manter a altura original da onda (não alterar)
                                     });
                                   }}
                                  onPlay={(e) => {
                                    const audio = e.target;
                                    const container = audio.parentElement;
                                    const playIcon = container.querySelector('.play-icon');
                                    const pauseIcon = container.querySelector('.pause-icon');
                                    
                                    if (playIcon) playIcon.style.display = 'none';
                                    if (pauseIcon) pauseIcon.style.display = 'block';
                                    
                                    // Garantir que o contexto de áudio esteja ativo (já criado no onLoadedMetadata)
                                    if (audio.audioContext && audio.audioContext.state === 'suspended') {
                                      audio.audioContext.resume();
                                    }
                                  }}
                                  onPause={(e) => {
                                    const container = e.target.parentElement;
                                    const playIcon = container.querySelector('.play-icon');
                                    const pauseIcon = container.querySelector('.pause-icon');
                                    if (playIcon) playIcon.style.display = 'block';
                                    if (pauseIcon) pauseIcon.style.display = 'none';
                                  }}
                                  onEnded={(e) => {
                                     const container = e.target.parentElement;
                                     const playIcon = container.querySelector('.play-icon');
                                     const pauseIcon = container.querySelector('.pause-icon');
                                     const waveBars = container.querySelectorAll('.wave-bar');
                                     const durationText = container.querySelector('.audio-duration');
                                     
                                     if (playIcon) playIcon.style.display = 'block';
                                     if (pauseIcon) pauseIcon.style.display = 'none';
                                     
                                     // Resetar ondas de áudio para alturas originais geradas dinamicamente
                                     waveBars.forEach((bar, index) => {
                                       bar.style.backgroundColor = 'rgba(0,0,0,0.3)';
                                       // Usar as alturas originais armazenadas ou fallback para altura padrão
                                       const originalHeight = e.target.originalWaveHeights ? e.target.originalWaveHeights[index] : 8;
                                       bar.style.height = `${originalHeight}px`;
                                     });
                                     
                                     // Resetar tempo para duração total
                                     if (durationText && e.target.duration) {
                                       const minutes = Math.floor(e.target.duration / 60);
                                       const seconds = Math.floor(e.target.duration % 60);
                                       durationText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                     }
                                   }}
                                  onLoadedMetadata={(e) => {
                                    const audio = e.target;
                                    const durationText = audio.parentElement.querySelector('.audio-duration');
                                    const waveBars = audio.parentElement.querySelectorAll('.wave-bar');
                                    
                                    if (durationText && audio.duration) {
                                      const minutes = Math.floor(audio.duration / 60);
                                      const seconds = Math.floor(audio.duration % 60);
                                      durationText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                    }
                                    
                                    // Gerar ondas sonoras com melhor performance
                                    if (waveBars.length > 0 && !audio.waveformGenerated) {
                                      try {
                                        // Cleanup de contextos anteriores
                                        if (audio.audioContext && audio.audioContext.state !== 'closed') {
                                          audio.audioContext.close();
                                        }
                                        
                                        // Criar contexto apenas se necessário
                                        let audioContext;
                                        try {
                                          audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                        } catch (contextError) {
                                          console.warn('AudioContext não disponível:', contextError);
                                          // Fallback para waveform estática simples
                                          generateFallbackWaveform(waveBars, audio.duration);
                                          return;
                                        }
                                        
                                        const analyser = audioContext.createAnalyser();
                                        
                                        // Verificar se já existe source
                                        if (!audio.audioSource) {
                                          try {
                                            const source = audioContext.createMediaElementSource(audio);
                                            audio.audioSource = source;
                                            audio.audioContext = audioContext;
                                          } catch (sourceError) {
                                            console.warn('Erro ao criar MediaElementSource:', sourceError);
                                            audioContext.close();
                                            generateFallbackWaveform(waveBars, audio.duration);
                                            return;
                                          }
                                        }
                                        
                                        analyser.fftSize = 256;
                                        audio.audioSource.connect(analyser);
                                        audio.audioSource.connect(audioContext.destination);
                                        
                                        // Gerar waveform otimizada
                                        generateOptimizedWaveform(waveBars, audio.duration, audio);
                                        
                                      } catch (error) {
                                        console.warn('Erro ao processar áudio:', error);
                                        // Fallback para waveform simples
                                        generateFallbackWaveform(waveBars, audio.duration);
                                      }
                                    }
                                  }}
                                >
                                  <source src={message.mediaUrl} type="audio/mpeg" />
                                  <source src={message.mediaUrl} type="audio/ogg" />
                                  <source src={message.mediaUrl} type="audio/wav" />
                                </audio>
                              </Box>
                            )}
                            {message.mediaType === 'video' && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <video 
                                  controls 
                                  style={{ 
                                    maxWidth: '300px', 
                                    maxHeight: '300px',
                                    borderRadius: '8px'
                                  }}
                                >
                                  <source src={message.mediaUrl} type="video/mp4" />
                                  <source src={message.mediaUrl} type="video/webm" />
                                  <source src={message.mediaUrl} type="video/ogg" />
                                  Seu navegador não suporta o elemento de vídeo.
                                </video>
                              </Box>
                            )}
                            {(message.mediaType === 'application' || message.mediaType === 'document' || message.fileName) && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: '8px', maxWidth: '300px' }}>
                                {message.fileName && message.fileName.toLowerCase().includes('.pdf') ? (
                                  <PdfIcon color="error" sx={{ fontSize: 32 }} />
                                ) : message.fileName && (message.fileName.toLowerCase().includes('.doc') || message.fileName.toLowerCase().includes('.docx')) ? (
                                  <FileIcon color="info" sx={{ fontSize: 32 }} />
                                ) : message.fileName && (message.fileName.toLowerCase().includes('.txt') || message.fileName.toLowerCase().includes('.rtf')) ? (
                                  <FileIcon color="secondary" sx={{ fontSize: 32 }} />
                                ) : (
                                  <FileIcon color="primary" sx={{ fontSize: 32 }} />
                                )}
                                <Box sx={{ flexGrow: 1 }}>
                                  <Typography variant="body2" fontWeight="medium" noWrap>
                                    {message.fileName || message.body || 'Documento'}
                                  </Typography>
                                  {message.fileSize && (
                                    <Typography variant="caption" color="text.secondary">
                                      {message.fileSize}
                                    </Typography>
                                  )}
                                  <Link 
                                    href={message.mediaUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem', mt: 0.5 }}
                                  >
                                    <DownloadIcon sx={{ fontSize: 16 }} />
                                    Baixar arquivo
                                  </Link>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        )}
                        
                        {/* Renderizar texto da mensagem */}
                        {message.body && !message.mediaUrl && (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              mb: 0.5,
                              color: message.scheduleDate && message.status === 'pending' ? '#e65100' : 'inherit'
                            }}
                          >
                            {message.body}
                          </Typography>
                        )}
                        
                        {/* Renderizar texto junto com mídia (para legendas) */}
                        {message.body && message.mediaUrl && message.mediaType !== 'application' && message.mediaType !== 'document' && message.mediaType !== 'audio' && message.mediaType !== 'image' && (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              mb: 0.5,
                              color: message.scheduleDate && message.status === 'pending' ? '#e65100' : 'inherit'
                            }}
                          >
                            {message.body}
                          </Typography>
                        )}
                      </Box>
                      {message.mediaType !== 'audio' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: 'flex-end', flexShrink: 0, ml: 1 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: '0.7rem' }}
                          >
                            {formatMessageTime(message.createdAt)}
                          </Typography>
                          {message.fromMe && (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {message.sending && (
                                <CircularProgress size={12} sx={{ color: 'grey.400' }} />
                              )}
                              {!message.sending && message.status === 'pending' && (
                                <CheckIcon sx={{ fontSize: 12, color: 'grey.400' }} />
                              )}
                              {!message.sending && message.status === 'sended' && (
                                <CheckIcon sx={{ fontSize: 12, color: 'grey.600' }} />
                              )}
                              {!message.sending && message.status === 'received' && (
                                <DoneAllIcon sx={{ fontSize: 12, color: 'grey.600' }} />
                              )}
                              {!message.sending && message.status === 'read' && (
                                <DoneAllIcon sx={{ fontSize: 12, color: '#1976d2' }} />
                              )}
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </ListItem>
              ))}
              {isTyping && (
                <ListItem>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.7 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.400' }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                    <Box sx={{ 
                      bgcolor: 'white', 
                      borderRadius: 2, 
                      p: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5
                    }}>
                      <Typography variant="body2" color="text.secondary">
                        Digitando
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.2 }}>
                        {[0, 1, 2].map((i) => (
                          <Box
                            key={i}
                            sx={{
                              width: 4,
                              height: 4,
                              borderRadius: '50%',
                              bgcolor: 'grey.400',
                              animation: 'pulse 1.4s ease-in-out infinite',
                              animationDelay: `${i * 0.2}s`,
                              '@keyframes pulse': {
                                '0%, 80%, 100%': { opacity: 0.3 },
                                '40%': { opacity: 1 }
                              }
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </ListItem>
              )}
              <div ref={messagesEndRef} />
              
              {/* Botão para voltar ao final */}
              {!autoScroll && (
                <IconButton
                  onClick={() => {
                    setAutoScroll(true);
                    scrollToBottom();
                  }}
                  sx={{
                    position: 'absolute',
                    bottom: 80,
                    right: 16,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark'
                    },
                    boxShadow: 2
                  }}
                >
                  <SendIcon sx={{ transform: 'rotate(90deg)' }} />
                </IconButton>
              )}
            </List>
        )}
      </Box>

      {/* Campo de entrada de mensagem - só aparece se o ticket estiver sendo atendido */}
      {ticket?.status === 'open' && (
        <Paper
          elevation={1}
          sx={{
            p: 1.5,
            borderRadius: 0,
            borderTop: '1px solid #e0e0e0',
            bgcolor: 'white'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>            
            {/* Input de arquivo oculto */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            />

            {/* Botão de anexo */}
            <IconButton
              size="small"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
              sx={{ 
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': { bgcolor: 'primary.dark' },
                mb: 0.5
              }}
            >
              <AttachFileIcon fontSize="small" />
            </IconButton>

            {/* Botão de emoji */}
            <Box sx={{ position: 'relative' }} data-emoji-picker>
              <IconButton
                size="small"
                disabled={sending}
                onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                sx={{ mb: 0.5 }}
              >
                <EmojiEmotionsIcon fontSize="small" />
              </IconButton>
              
              {/* Emoji Picker simples */}
              {emojiPickerOpen && (
                <Box
                  data-emoji-picker
                  sx={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    mb: 1,
                    zIndex: 1000
                  }}
                >
                  <EmojiPicker
                    onEmojiClick={handleEmojiSelect}
                    width={280}
                    height={350}
                    searchDisabled={true}
                    skinTonesDisabled={true}
                    previewConfig={{
                      showPreview: false
                    }}
                    lazyLoadEmojis={true}
                    emojiStyle="native"
                    categories={[
                      'smileys_people',
                      'animals_nature',
                      'food_drink',
                      'activities',
                      'travel_places',
                      'objects',
                      'symbols'
                    ]}
                    style={{
                      '--epr-category-navigation-button-size': '30px',
                      '--epr-emoji-size': '26px',
                      '--epr-emoji-padding': '6px',
                      '--epr-category-label-height': '32px',
                      '--epr-emoji-gap': '4px',
                      '--epr-category-label-padding': '6px 10px'
                    }}
                  />
                </Box>
              )}
            </Box>
            {/* Campo de texto principal */}
            <TextField
              fullWidth
              multiline
              maxRows={6}
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newMessage.trim()) {
                    handleSendMessage();
                  }
                }
              }}
              disabled={sending}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '20px',
                  bgcolor: '#f5f5f5',
                  '& fieldset': {
                    borderColor: 'transparent'
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.23)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                    borderWidth: '1px'
                  }
                },
                '& .MuiInputBase-input': {
                  padding: '12px 16px',
                  fontSize: '14px'
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {/* Botão de mensagens rápidas */}
                    <IconButton
                      size="small"
                      disabled={sending}
                      sx={{ mr: 0.5 }}
                    >
                      <FlashOnIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {/* Botão de agendamento */}
            <IconButton
              onClick={openScheduleModal}
              disabled={sending}
              size="small"
              sx={{ mb: 0.5 }}
            >
              <ScheduleIcon fontSize="small" />
            </IconButton>

            {/* Botão de áudio */}
            <IconButton
              onMouseDown={startAudioRecording}
              onMouseUp={stopAudioRecording}
              onMouseLeave={stopAudioRecording}
              disabled={sending}
              size="small"
              sx={{
                mb: 0.5,
                bgcolor: audioRecording ? 'error.main' : 'grey.300',
                color: 'white',
                '&:hover': {
                  bgcolor: audioRecording ? 'error.dark' : 'grey.400'
                }
              }}
            >
              <MicIcon fontSize="small" />
            </IconButton>

            {/* Botão de envio */}
            <IconButton
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              sx={{
                bgcolor: newMessage.trim() ? 'primary.main' : 'grey.300',
                color: 'white',
                '&:hover': {
                  bgcolor: newMessage.trim() ? 'primary.dark' : 'grey.400'
                },
                '&:disabled': {
                  bgcolor: 'grey.300',
                  color: 'grey.500'
                },
                mb: 0.5
              }}
            >
              {sending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SendIcon fontSize="small" />
              )}
            </IconButton>
          </Box>

          {/* Hint para quebra de linha */}
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              fontSize: '11px', 
              ml: 6, 
              mt: 0.5,
              display: 'block'
            }}
          >
            Pressione Enter para enviar, Shift + Enter para quebrar linha
          </Typography>
        </Paper>
      )}

      {/* Modal de Agendamento de Mensagem */}
      <Dialog
        open={scheduleModalOpen}
        onClose={closeScheduleModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon color="primary" />
            <Typography variant="h6">Agendar Mensagem</Typography>
          </Box>
          <IconButton onClick={closeScheduleModal} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
              <DateTimePicker
                label="Data e Hora do Agendamento"
                value={scheduleDate}
                onChange={setScheduleDate}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    variant="outlined"
                  />
                )}
                minDateTime={new Date()}
                ampm={false}
              />
            </LocalizationProvider>
            
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Mensagem"
              placeholder="Digite a mensagem que será enviada..."
              value={scheduledMessage}
              onChange={(e) => setScheduledMessage(e.target.value)}
              variant="outlined"
            />
            
            {scheduleDate && (
              <Chip
                icon={<ScheduleIcon />}
                label={`Agendado para: ${format(scheduleDate, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`}
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeScheduleModal} color="inherit">
            Cancelar
          </Button>
          <Button
            onClick={handleScheduleMessage}
            variant="contained"
            color="primary"
            disabled={!scheduledMessage.trim() || !scheduleDate}
            startIcon={<ScheduleIcon />}
          >
            Agendar Mensagem
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatWindow;

// Funções auxiliares para waveform
const generateOptimizedWaveform = (waveBars, duration, audio) => {
  const staticHeights = [];
  
  for (let i = 0; i < waveBars.length; i++) {
    const position = i / waveBars.length;
    const timePosition = position * (duration || 30);
    
    // Algoritmo melhorado para gerar alturas mais realistas
    const baseHeight = 8 + Math.sin(timePosition * 0.5) * 6;
    const variation = Math.sin(timePosition * 2) * 4;
    const noise = (Math.random() - 0.5) * 3;
    
    const height = Math.max(4, Math.min(20, baseHeight + variation + noise));
    staticHeights.push(height);
    
    waveBars[i].style.height = `${height}px`;
    waveBars[i].style.backgroundColor = 'rgba(0,0,0,0.3)';
  }
  
  audio.originalWaveHeights = staticHeights;
  audio.waveformGenerated = true;
};

const generateFallbackWaveform = (waveBars, duration) => {
  const staticHeights = [];
  
  for (let i = 0; i < waveBars.length; i++) {
    const height = 8 + Math.random() * 12;
    staticHeights.push(height);
    
    waveBars[i].style.height = `${height}px`;
    waveBars[i].style.backgroundColor = 'rgba(0,0,0,0.3)';
  }
};