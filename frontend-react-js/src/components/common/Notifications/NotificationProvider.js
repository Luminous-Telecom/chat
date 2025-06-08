import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Slide,
  IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const hideNotification = useCallback((id) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, open: false }
          : notification
      )
    );

    // Remove from array after animation
    setTimeout(() => {
      setNotifications(prev =>
        prev.filter(notification => notification.id !== id)
      );
    }, 300);
  }, []);

  const showNotification = useCallback(({
    type = 'info',
    title,
    message,
    duration = 5000,
    persistent = false,
    actions = []
  }) => {
    const id = Date.now() + Math.random();
    const notification = {
      id,
      type,
      title,
      message,
      open: true,
      actions
    };

    setNotifications(prev => [...prev, notification]);

    // Auto hide if not persistent
    if (!persistent && duration > 0) {
      setTimeout(() => {
        hideNotification(id);
      }, duration);
    }

    return id;
  }, [hideNotification]);

  const hideAllNotifications = useCallback(() => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, open: false }))
    );

    setTimeout(() => {
      setNotifications([]);
    }, 300);
  }, []);

  // Convenience methods
  const showSuccess = useCallback((message, options = {}) => {
    return showNotification(message, { ...options, type: 'success' });
  }, [showNotification]);

  const showError = useCallback((message, options = {}) => {
    return showNotification(message, { ...options, type: 'error' });
  }, [showNotification]);

  const showWarning = useCallback((message, options = {}) => {
    return showNotification(message, { ...options, type: 'warning' });
  }, [showNotification]);

  const showInfo = useCallback((message, options = {}) => {
    return showNotification(message, { ...options, type: 'info' });
  }, [showNotification]);

  const contextValue = {
    showNotification,
    hideNotification,
    hideAllNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    notifications
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={notification.open}
          autoHideDuration={notification.persistent ? null : notification.duration}
          onClose={() => hideNotification(notification.id)}
          TransitionComponent={SlideTransition}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            '& .MuiSnackbarContent-root': {
              padding: 0
            }
          }}
        >
          <Alert
            severity={notification.type}
            onClose={() => hideNotification(notification.id)}
            action={
              notification.action || (
                <IconButton
                  size="small"
                  aria-label="close"
                  color="inherit"
                  onClick={() => hideNotification(notification.id)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )
            }
            sx={{
              width: '100%',
              minWidth: 300,
              maxWidth: 500
            }}
          >
            {notification.title && (
              <AlertTitle>{notification.title}</AlertTitle>
            )}
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;