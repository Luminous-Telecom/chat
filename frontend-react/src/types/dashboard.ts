export interface Fila {
  id: number;
  name: string;
  color: string;
}

export interface TicketChannel {
  channel: string;
  count: number;
}

export interface UserDetail {
  id: number;
  name: string;
  totalTickets: number;
  activeTickets: number;
  avgResponseTime: number;
  avgResolutionTime: number;
}

export interface DashboardData {
  totalAtendimentos: number;
  atendimentosAtivos: number;
  atendimentosReceptivos: number;
  novosContatos: number;
  tma: number;
  tme: number;
  atendimentosPorCanal: TicketChannel[];
  distribuicaoPorFila: {
    fila: string;
    quantidade: number;
  }[];
  evolucaoAtendimentos: {
    data: string;
    quantidade: number;
  }[];
  desempenhoPorUsuario: UserDetail[];
}

export interface DashboardFilters {
  dataInicio: Date;
  dataFim: Date;
  filas: number[];
} 