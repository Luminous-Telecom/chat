import axios from 'axios';
import type { DashboardData, DashboardFilters, Fila } from '../types/dashboard';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

export const dashboardApi = {
  getFilas: async (): Promise<Fila[]> => {
    const { data } = await api.get('/filas');
    return data;
  },

  getDashboardData: async (filters: DashboardFilters): Promise<DashboardData> => {
    const { data } = await api.get('/dashboard', {
      params: {
        dataInicio: filters.dataInicio.toISOString(),
        dataFim: filters.dataFim.toISOString(),
        filas: filters.filas.join(','),
      },
    });
    return data;
  },
}; 