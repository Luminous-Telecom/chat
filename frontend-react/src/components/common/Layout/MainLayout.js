import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  useTheme,
  useMediaQuery,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  AccessTime as AccessTimeIcon,
  Message as MessageIcon,
  Folder as FolderIcon,
  Group as GroupIcon,
  WhatsApp as WhatsAppIcon,
  Assessment as AssessmentIcon,
  FlashOn as FlashOnIcon,
  SmartToy as SmartToyIcon,
  LocalOffer as LocalOfferIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  LightMode,
  DarkMode,
  AccountCircle,
  ExitToApp,
  Dashboard as ViewDashboardIcon,
  CallSplit as CallSplitIcon
} from '@mui/icons-material';
import { logout } from '../../../store/authSlice';
import useSocket from '../../../hooks/useSocket';
import { queueService } from '../../../services/api';
import { setQueueTicketCounts } from '../../../store/notificationSlice';

const drawerWidth = 240;
const miniDrawerWidth = 64;

const MainLayout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { totalUnreadCount } = useSelector((state) => state.notifications);
  const { disconnectedChannels } = useSelector((state) => state.notifications);
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [miniState, setMiniState] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [queueTicketCounts] = useState({});
  const [notifications] = useState({ count: 0, tickets: [] });
  const [notificationsPending] = useState({ count: 0 });
  
  const socket = useSocket();
  const tenantId = localStorage.getItem('tenantId');

  // Menu items principais
  const menuItems = [
    {
      title: 'Dashboard',
      caption: '',
      icon: <DashboardIcon />,
      path: '/',
      name: 'dashboard',
      routeName: 'home-dashboard'
    },
    {
      title: 'Atendimentos na Fila',
      caption: 'Tickets em espera',
      icon: <AccessTimeIcon />,
      path: '/atendimento?status=pending',
      name: 'atendimento-pending',
      routeName: 'atendimento',
      query: { status: 'pending' },
      badge: Object.values(queueTicketCounts).reduce((sum, count) => sum + count, 0)
    },
    {
      title: 'Atendimentos em Andamento',
      caption: 'Lista de atendimentos',
      icon: <MessageIcon />,
      path: '/atendimento?status=open',
      name: 'atendimento-open',
      routeName: 'atendimento',
      query: { status: 'open' }
    },
    {
      title: 'Atendimentos Finalizados',
      caption: 'Histórico de atendimentos',
      icon: <FolderIcon />,
      path: '/atendimento?status=closed',
      name: 'atendimento-closed',
      routeName: 'atendimento',
      query: { status: 'closed' }
    },
    {
      title: 'Contatos',
      caption: 'Lista de contatos',
      icon: <GroupIcon />,
      path: '/contacts',
      name: 'contacts',
      routeName: 'contatos'
    },
  ];

  // Menu items administrativos
  const adminMenuItems = [
    {
      title: 'Canais',
      caption: '',
      icon: <WhatsAppIcon />,
      path: '/channels',
      name: 'channels',
      routeName: 'sessoes'
    },
    {
      title: 'Painel Atendimentos',
      caption: '',
      icon: <ViewDashboardIcon />,
      path: '/panel',
      name: 'panel',
      routeName: 'painel-atendimentos'
    },
    {
      title: 'Relatórios',
      caption: '',
      icon: <AssessmentIcon />,
      path: '/reports',
      name: 'reports',
      routeName: 'relatorios'
    },
    {
      title: 'Usuarios',
      caption: '',
      icon: <GroupIcon />,
      path: '/users',
      name: 'users',
      routeName: 'usuarios'
    },
    {
      title: 'Filas',
      caption: '',
      icon: <CallSplitIcon />,
      path: '/queues',
      name: 'queues',
      routeName: 'filas'
    },
    {
      title: 'Mensagens Rápidas',
      caption: '',
      icon: <FlashOnIcon />,
      path: '/quick-messages',
      name: 'quick-messages',
      routeName: 'mensagens-rapidas'
    },
    {
      title: 'Chatbot',
      caption: '',
      icon: <SmartToyIcon />,
      path: '/chatbot',
      name: 'chatbot',
      routeName: 'chat-flow'
    },
    {
      title: 'Etiquetas',
      caption: '',
      icon: <LocalOfferIcon />,
      path: '/tags',
      name: 'tags',
      routeName: 'etiquetas'
    },
    {
      title: 'Horário de Atendimento',
      caption: '',
      icon: <AccessTimeIcon />,
      path: '/schedule',
      name: 'schedule',
      routeName: 'horarioAtendimento'
    },
    {
      title: 'Configurações',
      caption: '',
      icon: <SettingsIcon />,
      path: '/settings',
      name: 'settings',
      routeName: 'configuracoes'
    },
  ];

  // Carrega contadores iniciais
  useEffect(() => {
    const loadQueueCounts = async () => {
      try {
        const response = await queueService.getUnreadCount();
        dispatch(setQueueTicketCounts(response));
      } catch (error) {
        console.error('Erro ao carregar contadores:', error);
      }
    };

    if (user) {
      loadQueueCounts();
    }
  }, [user, dispatch]);

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDrawerOpen(!drawerOpen);
    }
  };

  const handleMiniToggle = () => {
    setMiniState(!miniState);
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (event) => {
    setNotificationAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchorEl(null);
  };

  const handleUserMenuClick = (event) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    handleUserMenuClose();
  };

  const handleMenuItemClick = (item) => {
    // Comportamento padrão de navegação
    if (item.query) {
      navigate({
        pathname: '/atendimento',
        search: new URLSearchParams(item.query).toString()
      });
    } else {
      navigate(item.path);
    }
    
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const isActiveRoute = (item) => {
    if (item.query) {
      const currentParams = new URLSearchParams(location.search);
      const itemParams = new URLSearchParams(item.query);
      return location.pathname === '/atendimento' && 
             Array.from(itemParams.entries()).every(([key, value]) => 
               currentParams.get(key) === value
             );
    }
    return location.pathname === item.path;
  };

  const handleAdminModalOpen = () => {
    setAdminModalOpen(true);
  };

  const handleAdminModalClose = () => {
    setAdminModalOpen(false);
  };

  const handleThemeToggle = () => {
    setDarkMode(!darkMode);
    // Aqui você pode implementar a lógica para alternar o tema
  };

  const isAdmin = user?.profile === 'admin';

  const currentDrawerWidth = miniState ? miniDrawerWidth : drawerWidth;

  const drawer = (
    <Box sx={{ width: currentDrawerWidth, transition: 'width 0.3s' }}>
      {/* Header do Menu com Toggle */}
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: miniState ? 'center' : 'flex-start' }}>
        <Tooltip title={miniState ? 'Expandir Menu' : 'Recolher Menu'} placement="right">
          <IconButton onClick={handleMiniToggle}>
            <MenuIcon />
          </IconButton>
        </Tooltip>
        {!miniState && (
          <Typography variant="h6" sx={{ ml: 1 }}>Izing</Typography>
        )}
      </Box>
      
      {/* Menu Principal com Notificações */}
      <List>        
        {/* Seção de Notificações */}
        <Tooltip title={miniState ? 'Notificações' : ''} placement="right">
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleNotificationClick}
              sx={{ 
                justifyContent: miniState ? 'center' : 'flex-start',
                '&:hover': {
                  backgroundColor: 'primary.light',
                },
              }}
            >
              <ListItemIcon sx={{ 
                minWidth: miniState ? 'auto' : 40,
                '& .MuiSvgIcon-root': {
                  fontSize: '1.2rem'
                }
              }}>
                {(totalUnreadCount > 0 || disconnectedChannels.length > 0) ? (
                  <Badge 
                    badgeContent={totalUnreadCount + disconnectedChannels.length} 
                    color="error"
                    sx={{
                      '& .MuiBadge-badge': {
                        backgroundColor: disconnectedChannels.length > 0 ? '#f44336' : '#1976d2'
                      }
                    }}
                  >
                    <NotificationsIcon />
                  </Badge>
                ) : (
                  <NotificationsIcon />
                )}
              </ListItemIcon>
              {!miniState && (
                <ListItemText 
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}
                      >
                        Notificações
                      </Typography>
                      {disconnectedChannels.length > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            bgcolor: 'error.main',
                            color: 'white',
                            px: 0.5,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: '0.65rem'
                          }}
                        >
                          {disconnectedChannels.length} desconectado{disconnectedChannels.length > 1 ? 's' : ''}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              )}
            </ListItemButton>
          </ListItem>
        </Tooltip>
        
        {/* Itens do Menu Principal */}
        {menuItems.map((item) => (
          <Tooltip key={item.name} title={miniState ? item.title : ''} placement="right">
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => handleMenuItemClick(item)}
                selected={isActiveRoute(item)}
                sx={{ 
                  justifyContent: miniState ? 'center' : 'flex-start',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: miniState ? 'auto' : 40,
                  color: isActiveRoute(item) ? 'white' : 'inherit',
                  '& .MuiSvgIcon-root': {
                    fontSize: '1.2rem'
                  }
                }}>
                  {item.badge && item.badge > 0 ? (
                    <Badge badgeContent={item.badge} color="error">
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                {!miniState && (
                  <ListItemText 
                    primary={item.title}
                    secondary={item.caption}
                    primaryTypographyProps={{
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}
                    secondaryTypographyProps={{
                      fontSize: '0.65rem'
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          </Tooltip>
        ))}
        
        {/* Menu Administrativo */}
        {isAdmin && (
          <>
            {miniState ? (
              // Versão mini do menu admin - apenas ícone de configurações
              <>
              <Tooltip title="Administração" placement="right">
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={handleAdminModalOpen}
                    sx={{ 
                      justifyContent: 'center',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ 
                      minWidth: 'auto',
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.2rem'
                      }
                    }}>
                      <SettingsIcon />
                    </ListItemIcon>
                  </ListItemButton>
                </ListItem>
              </Tooltip>
              </>
            ) : (
              // Versão expandida do menu admin - sempre oculto, abre modal
              <>
              <ListItem disablePadding>
                <ListItemButton 
                  onClick={handleAdminModalOpen}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'primary.light',
                    },
                  }}
                >
                  <ListItemIcon sx={{
                    minWidth: 40,
                    '& .MuiSvgIcon-root': {
                      fontSize: '1.2rem'
                    }
                  }}>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Administração"
                    primaryTypographyProps={{
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}
                  />
                </ListItemButton>
                </ListItem>
                </>
              )}
            </>
          )}
      </List>

      {/* Seção do Usuário */}
      <Box sx={{ mt: 'auto', p: miniState ? 1 : 2 }}>
        <Tooltip title={miniState ? 'Usuário' : ''} placement="right">
          <ListItem disablePadding>
            <ListItemButton onClick={handleUserMenuClick} sx={{ justifyContent: miniState ? 'center' : 'flex-start' }}>
              <ListItemIcon sx={{ 
                minWidth: miniState ? 'auto' : 40,
                '& .MuiSvgIcon-root': {
                  fontSize: '1.2rem'
                }
              }}>
                <Avatar sx={{ width: 32, height: 32 }}>
                  {user?.name?.charAt(0) || <AccountCircle />}
                </Avatar>
              </ListItemIcon>
              {!miniState && (
                <ListItemText 
                  primary={user?.name || 'Usuário'}
                  secondary="Perfil"
                  primaryTypographyProps={{
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                  secondaryTypographyProps={{
                    fontSize: '0.65rem'
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        </Tooltip>
        
        <Tooltip title={miniState ? (darkMode ? 'Modo Claro' : 'Modo Escuro') : ''} placement="right">
          <ListItem disablePadding>
            <ListItemButton onClick={handleThemeToggle} sx={{ justifyContent: miniState ? 'center' : 'flex-start' }}>
              <ListItemIcon sx={{ 
                minWidth: miniState ? 'auto' : 40,
                '& .MuiSvgIcon-root': {
                  fontSize: '1.2rem'
                }
              }}>
                {darkMode ? <LightMode /> : <DarkMode />}
              </ListItemIcon>
              {!miniState && (
                <ListItemText 
                  primary={darkMode ? 'Modo Claro' : 'Modo Escuro'}
                  primaryTypographyProps={{
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      {/* Não precisamos mais do drawer de atendimentos */}
      
      {/* Botão de menu quando drawer está fechado */}
      {!drawerOpen && !isMobile && (
        <IconButton
          onClick={handleDrawerToggle}
          sx={{
            position: 'fixed',
            top: 16,
            left: 16, // Posição fixa sem considerar drawer de atendimento
            zIndex: theme.zIndex.drawer + 1,
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          }}
        >
          <MenuIcon />
        </IconButton>
      )}

      {/* Modal de Administração */}
      <Dialog
        open={adminModalOpen}
        onClose={handleAdminModalClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            minHeight: '60vh'
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SettingsIcon sx={{ mr: 1 }} />
            Configurações Administrativas
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {adminMenuItems.map((item) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.name}>
                <ListItemButton
                  onClick={() => {
                    handleMenuItemClick(item);
                    handleAdminModalClose();
                  }}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 2,
                    height: '100px',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      borderColor: 'primary.main',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    },
                  }}
                  selected={isActiveRoute(item)}
                >
                  <ListItemIcon sx={{
                    color: isActiveRoute(item) ? 'white' : 'primary.main',
                    minWidth: 'auto',
                    mb: 1,
                    '& .MuiSvgIcon-root': {
                      fontSize: '2rem'
                    }
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  <Typography
                    variant="body2"
                    align="center"
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: isActiveRoute(item) ? 'white' : 'text.primary'
                    }}
                  >
                    {item.title}
                  </Typography>
                </ListItemButton>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAdminModalClose} color="primary">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
      <Box
        component="nav"
        sx={{ 
          width: isMobile ? 0 : (drawerOpen ? currentDrawerWidth : 0), 
          flexShrink: 0,
          transition: 'width 0.3s'
        }}
        aria-label="navigation"
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: 250,
              height: '100vh'
            },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop Drawer */}
        <Drawer
          variant="persistent"
          open={drawerOpen}
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: currentDrawerWidth,
              height: '100vh',
              transition: 'width 0.3s',
              overflowX: 'hidden',
              zIndex: 1300
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginLeft: isMobile ? 0 : (drawerOpen ? (miniState ? 0 : `${currentDrawerWidth}px`) : 0),
          width: isMobile ? '100%' : (drawerOpen ? `calc(100% - ${currentDrawerWidth}px)` : '100%'
          ),
          transition: 'width 0.3s, margin 0.3s',
          height: '100vh',
          backgroundColor: 'background.default',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: 'white',
            borderRadius: 0,
            boxShadow: 0
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;