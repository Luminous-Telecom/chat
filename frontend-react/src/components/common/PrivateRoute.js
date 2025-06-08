import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { initializeAuth } from '../../store/authSlice';

const PrivateRoute = ({ children }) => {
  const dispatch = useDispatch();
  const { isAuthenticated, loading, token } = useSelector((state) => state.auth);

  useEffect(() => {
    // Inicializa a autenticação verificando o localStorage
    if (!isAuthenticated && !loading) {
      dispatch(initializeAuth());
    }
  }, [dispatch, isAuthenticated, loading]);

  // Se está carregando, mostra loading
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Se não tem token, redireciona para login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Se está autenticado, renderiza os children
  if (isAuthenticated) {
    return children;
  }

  // Fallback para loading
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <CircularProgress />
    </Box>
  );
};

export default PrivateRoute;