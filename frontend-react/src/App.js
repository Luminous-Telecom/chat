import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { store } from './store';
import PrivateRoute from './components/common/PrivateRoute';
import MainLayout from './components/common/Layout/MainLayout';
import NotificationProvider from './components/common/Notifications/NotificationProvider';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import Atendimento from './pages/Atendimento';
import Chat from './pages/Chat';
import Channels from './pages/Channels';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NotificationProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <Dashboard />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/tickets"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <Tickets />
                    </MainLayout>
                  </PrivateRoute>
                }
              />

              <Route
                path="/channels"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <Channels />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/atendimento"
                element={
                  <PrivateRoute>
                    <Atendimento />
                  </PrivateRoute>
                }
              />
              <Route
                path="/chat/:ticketId"
                element={
                  <PrivateRoute>
                    <Chat />
                  </PrivateRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
